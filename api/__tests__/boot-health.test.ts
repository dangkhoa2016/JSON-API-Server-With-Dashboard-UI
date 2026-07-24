import { describe, it, expect } from "vitest";

import app from "../boot";

describe("GET /api/health - healthy", () => {
  it("returns 200 with healthy status when database is connected", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("healthy");
    expect(body.db).toBe("connected");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("uptime");
  });
});
