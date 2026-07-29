import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import { seedDatabase } from "./seed.js";
import { seedSettings } from "./seed-settings.js";
import { seedAdmin } from "./seed-admin.js";
import { DEFAULT_DATABASE_URL } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type DatabaseClient = ReturnType<typeof createClient>;

async function applyMigrations(client: DatabaseClient) {
  const migrationsDir = join(__dirname, "..", "..", "db", "migrations");
  const journalPath = join(migrationsDir, "meta", "_journal.json");
  const journal: { entries: Array<{ tag: string }> } = JSON.parse(
    readFileSync(journalPath, "utf-8"),
  );

  for (const entry of journal.entries) {
    const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
    const sql = readFileSync(sqlPath, "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await client.execute(stmt);
    }
    console.log(`Applied migration: ${entry.tag}`);
  }
}

export async function prepareDatabase(
  client: DatabaseClient,
): Promise<void> {
  try {
    console.log("Applying database migrations...");
    await applyMigrations(client);

    const db = drizzle(client, { schema });
    console.log("Seeding database...");
    await seedDatabase(db);
    await seedSettings(db);
    await seedAdmin(db);
    console.log("Database preparation complete!");
  } finally {
    client.close();
  }
}

export async function main(): Promise<void> {
  const url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  await prepareDatabase(createClient({ url }));
}

/* v8 ignore next 2 */
const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

/* v8 ignore next 5 */
if (isMainModule) {
  main().catch((error) => {
    console.error("Database preparation failed:", error);
    process.exit(1);
  });
}
