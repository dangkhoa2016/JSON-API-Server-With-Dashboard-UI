import { describe, it, expect, vi } from "vitest";

vi.mock("../queries/connection", () => ({
  getDb: () => {
    throw new Error("DB connection failed");
  },
}));

import app from "../boot";

describe("GET /api/health - unhealthy", () => {
  it("returns 503 when database is disconnected", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(503);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("unhealthy");
    expect(body.db).toBe("disconnected");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("uptime");
  });
});
