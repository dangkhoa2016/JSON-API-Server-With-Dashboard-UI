#!/usr/bin/env node
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema.js";
import { eq, ne, gt, gte, lt, lte, like, or } from "drizzle-orm";
import * as readline from "node:readline";
import { DEFAULT_DATABASE_URL } from "../db/config.js";

export function formatSettingValue(setting, reveal) {
  if (reveal) return setting.value || "(empty)";
  if (setting.isPublic) return setting.value || "(empty)";
  return "********";
}

const DB_PATH = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const revealMode = process.argv.includes("--reveal");
const client = createClient({ url: DB_PATH });
const db = drizzle(client, { schema });

const TABLES = {
  users: schema.users,
  posts: schema.posts,
  comments: schema.comments,
  albums: schema.albums,
  photos: schema.photos,
  todos: schema.todos,
  settings: schema.settings,
};

const COLS = {
  users: ["id", "name", "username", "email", "address", "phone", "website", "company"],
  posts: ["id", "userId", "title", "body"],
  comments: ["id", "postId", "name", "email", "body"],
  albums: ["id", "userId", "title"],
  photos: ["id", "albumId", "title", "url", "thumbnailUrl"],
  todos: ["id", "userId", "title", "completed"],
  settings: ["id", "key", "value", "type", "label", "description", "group", "isPublic"],
};

const OPERATORS = {
  "=": eq,
  "!=": ne,
  ">": gt,
  ">=": gte,
  "<": lt,
  "<=": lte,
  like,
};

function printTable(rows, cols) {
  if (rows.length === 0) { console.log("(empty)"); return; }
  const widths = {};
  for (const c of cols) {
    widths[c] = Math.min(60, Math.max(c.length, ...rows.map((r) => String(r[c] ?? "NULL").length)));
  }
  const sep = cols.map((c) => "-".repeat(widths[c])).join("-+-");
  console.log(cols.map((c) => c.padEnd(widths[c])).join(" | "));
  console.log(sep);
  for (const row of rows) {
    console.log(
      cols.map((c) => {
        const v = String(row[c] ?? "NULL");
        return (v.length > 60 ? v.slice(0, 57) + "..." : v).padEnd(widths[c]);
      }).join(" | "),
    );
  }
  console.log(`(${rows.length} row${rows.length !== 1 ? "s" : ""})`);
}

function validateTableName(name) {
  if (!(name in TABLES)) {
    throw new Error(`Unknown table: "${name}". Valid tables: ${Object.keys(TABLES).join(", ")}`);
  }
}

async function getCount(name) {
  validateTableName(name);
  const r = await client.execute(`SELECT COUNT(*) as cnt FROM ${name}`);
  return Number(r.rows[0]?.cnt ?? 0);
}

function printHelp() {
  console.log(`
Commands:
  tables                          List all tables with row counts
  schema <table>                  Show table schema (column info)
  select <table> [limit]          Show rows (default limit 20)
  where <table> <col> <op> <val>  Filter (op: =, !=, >, <, >=, <=, like)
  find <table> <col> <value>      Find by exact column value
  search <table> <term>           Search all text columns for a term
  count <table>                   Count rows in a table
  relationships                   Show table relationships

Settings commands:
  settings                        Show all settings (grouped view)
  settings <group>                Show settings in a specific group
  setting <key>                   Show full details of a setting by key

  help                            Show this help
  exit                            Quit

Usage:
  node scripts/inspect-db.js                  # interactive mode
  node scripts/inspect-db.js --tables
  node scripts/inspect-db.js --schema posts
  node scripts/inspect-db.js --select users 20
  node scripts/inspect-db.js --where posts userId = 1
  node scripts/inspect-db.js --find users id 3
  node scripts/inspect-db.js --search todos learn
  node scripts/inspect-db.js --count comments
  node scripts/inspect-db.js --relationships
  node scripts/inspect-db.js --settings
  node scripts/inspect-db.js --setting app_name
`);
}

async function execCommand(cmd, args) {
  try {
    switch (cmd) {
      case "tables": {
        console.log("");
        for (const name of Object.keys(TABLES)) {
          const count = await getCount(name);
          console.log(`  ${name.padEnd(12)} ${count} rows`);
        }
        break;
      }
      case "schema": {
        const name = args[0];
        if (!name || !TABLES[name]) { console.log(`Unknown table: ${name}. Available: ${Object.keys(TABLES).join(", ")}`); break; }
        const r = await client.execute(`PRAGMA table_info('${name}')`);
        console.log("");
        printTable(r.rows, ["cid", "name", "type", "notnull", "dflt_value", "pk"]);
        break;
      }
      case "select": {
        const name = args[0];
        if (!name || !TABLES[name]) { console.log(`Unknown table: ${name}. Available: ${Object.keys(TABLES).join(", ")}`); break; }
        const rows = await db.select().from(TABLES[name]).limit(Number(args[1]) || 20);
        console.log("");
        printTable(rows, COLS[name]);
        break;
      }
      case "where": {
        const [name, col, op, ...valParts] = args;
        const val = valParts.join(" ");
        if (!name || !TABLES[name]) { console.log(`Unknown table: ${name}`); break; }
        if (!col || !COLS[name]?.includes(col)) { console.log(`Unknown column: ${col}`); break; }
        const opFn = OPERATORS[op || ""];
        if (!opFn) { console.log(`Invalid operator: ${op}. Use: ${Object.keys(OPERATORS).join(", ")}`); break; }
        const rows = await db.select().from(TABLES[name]).where(opFn(TABLES[name][col], val)).limit(50);
        console.log("");
        printTable(rows, COLS[name]);
        break;
      }
      case "find": {
        const [name, col, ...valParts] = args;
        return execCommand("where", [name, col, "=", ...valParts]);
      }
      case "search": {
        const [name, ...termParts] = args;
        const term = termParts.join(" ");
        if (!name || !TABLES[name]) { console.log(`Unknown table: ${name}`); break; }
        const table = TABLES[name];
        const conditions = COLS[name]
          .map((c) => table[c])
          .filter((col) => col?.getSQLType?.() === "text")
          .map((col) => like(col, `%${term}%`));
        if (conditions.length === 0) { console.log("No searchable columns."); break; }
        const condition = conditions.length === 1 ? conditions[0] : or(...conditions);
        const rows = await db.select().from(table).where(condition).limit(50);
        console.log("");
        printTable(rows, COLS[name]);
        break;
      }
      case "count": {
        const name = args[0];
        if (!name || !TABLES[name]) { console.log(`Unknown table: ${name}`); break; }
        console.log(`\n  ${name}: ${await getCount(name)} rows\n`);
        break;
      }
      case "relationships": {
        console.log(`
  users
    ├─< posts       (users.id = posts.userId)
    ├─< albums      (users.id = albums.userId)
    └─< todos       (users.id = todos.userId)

  posts
    ├─> author      (posts.userId = users.id)
    └─< comments    (posts.id = comments.postId)

  comments
    └─> post        (comments.postId = posts.id)

  albums
    ├─> author      (albums.userId = users.id)
    └─< photos      (albums.id = photos.albumId)

  photos
    └─> album       (photos.albumId = albums.id)

  todos
    └─> author      (todos.userId = users.id)
`);
        break;
      }
      case "settings": {
        const group = args[0];
        let query = db.select().from(schema.settings);
        if (group) {
          query = query.where(eq(schema.settings.group, group));
        }
        const rows = await query;
        if (rows.length === 0) {
          console.log(group ? `\n  No settings in group '${group}'.\n` : "\n  No settings found.\n");
          break;
        }

        const grouped = {};
        for (const row of rows) {
          const g = row.group || "(ungrouped)";
          if (!grouped[g]) grouped[g] = [];
          grouped[g].push(row);
        }

        for (const [g, items] of Object.entries(grouped)) {
          console.log(`\n  \x1b[1m[${g}]\x1b[0m`);
          for (const row of items) {
            const pub = row.isPublic ? "\x1b[32mpublic\x1b[0m" : "\x1b[90mprivate\x1b[0m";
            const val = formatSettingValue(row, revealMode);
            console.log(`    ${row.key?.padEnd(24)} = ${val}  (${row.type}, ${pub})`);
          }
        }
        console.log(`\n  (${rows.length} setting${rows.length !== 1 ? "s" : ""})\n`);
        break;
      }
      case "setting": {
        const key = args[0];
        if (!key) { console.log("Usage: setting <key>"); break; }
        const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
        if (rows.length === 0) { console.log(`\n  Setting '${key}' not found.\n`); break; }
        const s = rows[0];
        const pub = s.isPublic ? "Yes" : "No";
        console.log(`
  \x1b[1m${s.key}\x1b[0m
  ├─ value       : ${formatSettingValue(s, revealMode)}
  ├─ type        : ${s.type}
  ├─ label       : ${s.label || "(none)"}
  ├─ description : ${s.description || "(none)"}
  ├─ group       : ${s.group || "(ungrouped)"}
  └─ isPublic    : ${pub}
`);
        break;
      }
      case "help": printHelp(); break;
      default: console.log(`Unknown command: ${cmd}. Type 'help' for commands.`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

async function runBatch(args) {
  const cmd = args[0]?.replace(/^--/, "");
  const rest = args.slice(1);
  if (cmd === "help" || args.length === 0) { printHelp(); }
  else { await execCommand(cmd, rest); }
  client.close();
}

async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));

  console.log(`\n  DB Inspector — ${DB_PATH}\n`);
  while (true) {
    const input = (await ask("\x1b[36mdb>\x1b[0m ")).trim();
    if (!input) continue;
    if (input === "exit" || input === "q") break;
    const [cmd, ...args] = input.split(/\s+/);
    await execCommand(cmd.toLowerCase(), args);
  }
  client.close();
  rl.close();
}

const isBatch = process.argv.some((a) => a.startsWith("--"));
if (revealMode) {
  console.error("Warning: Revealing private settings. Output may contain secrets. Avoid sharing logs or screenshots.");
}
if (isBatch) {
  const batchArgs = process.argv.slice(2).filter(a => a !== "--reveal");
  runBatch(batchArgs).catch((err) => { console.error(err); process.exit(1); });
} else {
  interactive().catch((err) => { console.error(err); process.exit(1); });
}
