import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL = "file:./local.db";

export function getDb(url?: string) {
  const client = createClient({ url: url || process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
  return drizzle(client, { schema });
}

export type SeedDb = ReturnType<typeof getDb>;
