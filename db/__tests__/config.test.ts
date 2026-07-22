import { describe, it, expect, afterEach } from "vitest";
import { getDb, DEFAULT_DATABASE_URL } from "../config";

describe("db/config", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("exports DEFAULT_DATABASE_URL", () => {
    expect(DEFAULT_DATABASE_URL).toBe("file:./local.db");
  });

  it("getDb with explicit url returns a drizzle instance", () => {
    const db = getDb(":memory:");
    expect(db).toBeDefined();
    expect(db.select).toBeDefined();
    expect(db.insert).toBeDefined();
  });

  it("getDb uses DATABASE_URL env var when no url provided", () => {
    process.env.DATABASE_URL = ":memory:";
    const db = getDb();
    expect(db).toBeDefined();
    expect(db.select).toBeDefined();
  });

  it("getDb falls back to DEFAULT_DATABASE_URL when no env var set", () => {
    delete process.env.DATABASE_URL;
    const db = getDb();
    expect(db).toBeDefined();
    expect(db.select).toBeDefined();
  });
});
