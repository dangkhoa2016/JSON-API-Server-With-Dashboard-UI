import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DEFAULT_DATABASE_URL } from "./db/config";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  },
});
