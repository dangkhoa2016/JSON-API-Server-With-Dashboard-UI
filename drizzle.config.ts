import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DEFAULT_DATABASE_URL } from "./db/config.js";

const isTurso = (process.env.DATABASE_URL || "").startsWith("libsql://");

export default defineConfig({
  schema: "./db/schema.js",
  out: "./db/migrations",
  dialect: isTurso ? "turso" : "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  },
});
