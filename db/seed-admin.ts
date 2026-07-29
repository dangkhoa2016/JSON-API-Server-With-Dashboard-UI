import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { hash } from "@node-rs/argon2";
import { randomUUID } from "crypto";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { DEFAULT_DATABASE_URL } from "./config";

function generateRandomPassword(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function seedAdmin(db: LibSQLDatabase<typeof schema>) {
  const isProduction = process.env.NODE_ENV === "production";
  let username = process.env.ADMIN_USERNAME;
  let password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    if (isProduction) {
      throw new Error(
        "ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required in production",
      );
    }
    username = username || "admin";
    password = password || generateRandomPassword();
    console.log("--- Development Mode ---");
    console.log(`  Admin username: ${username}`);
    console.log(`  Admin password: ${password}`);
    console.log("------------------------");
  }

  const passwordHash = await hash(password);

  await db
    .insert(schema.settings)
    .values({
      key: "ADMIN_USERNAME",
      value: username,
      type: "string",
      label: "Admin Username",
      description: "Username for admin login",
      group: "auth",
      isPublic: false,
    })
    .onConflictDoNothing();

  await db
    .insert(schema.settings)
    .values({
      key: "ADMIN_PASSWORD_HASH",
      value: passwordHash,
      type: "string",
      label: "Admin Password Hash",
      description: "Argon2 hash of admin password",
      group: "auth",
      isPublic: false,
    })
    .onConflictDoNothing();

  console.log(`Admin credentials seeded for user: ${username}`);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const client = createClient({ url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
  const db = drizzle(client, { schema });
  seedAdmin(db).catch(console.error).finally(() => client.close());
}
