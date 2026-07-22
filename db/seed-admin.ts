import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { hash } from "@node-rs/argon2";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL environment variable is required");
const client = createClient({ url: dbUrl });
const db = drizzle(client, { schema });

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required");

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

seedAdmin().catch(console.error).finally(() => client.close());
