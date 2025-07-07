import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { sql } from "drizzle-orm";

import app from "../boot";
import { getDb } from "../queries/connection";
import { setupTestDatabase, seedTestData, clearTestDatabase } from "./helpers";

type JsonBody = Record<string, unknown>;

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase();
  await seedTestData();
});

describe("REST API - /api/:resource", () => {
  describe("GET /api/:resource", () => {
    it("lists all resources", async () => {
      const res = await app.request("/api/users");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data).toHaveLength(3);
      expect(body.data[0]).toHaveProperty("id");
      expect(body.data[0]).toHaveProperty("name");
    });

    it("returns 404 for invalid resource", async () => {
      const res = await app.request("/api/invalid");
      expect(res.status).toBe(404);
      const body = await res.json() as JsonBody;
      expect(body.error).toBe("Resource not found");
    });

    it("supports _page and _limit pagination", async () => {
      const res = await app.request("/api/users?_page=1&_limit=2");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data).toHaveLength(2);
    });

    it("supports _sort and _order", async () => {
      const res = await app.request("/api/users?_sort=name&_order=asc");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data[0].name).toBe("Clementine Bauch");
      expect(body.data[2].name).toBe("Leanne Graham");
    });

    it("sorts in descending order", async () => {
      const res = await app.request("/api/users?_sort=name&_order=desc");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data[0].name).toBe("Leanne Graham");
    });

    it("sorts without order param", async () => {
      const res = await app.request("/api/users?_sort=name");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data[0].name).toBe("Clementine Bauch");
    });

    it("sorts by non-existent column", async () => {
      const res = await app.request("/api/users?_sort=nonexistent");
      expect(res.status).toBe(200);
      expect((await res.json() as JsonBody).data.length).toBe(3);
    });

    it("paginates with limit but no page", async () => {
      const res = await app.request("/api/users?_limit=2");
      expect(res.status).toBe(200);
      expect((await res.json() as JsonBody).data).toHaveLength(2);
    });

    it("returns empty list for non-matching filter", async () => {
      const res = await app.request("/api/users?name=__NOBODY__");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it("supports full-text search via q param", async () => {
      const res = await app.request("/api/users?q=Leanne");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Leanne Graham");
    });

    it("escapes % in q search param", async () => {
      const res = await app.request("/api/users?q=%25");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data).toHaveLength(0);
    });

    it("escapes _ in q search param", async () => {
      const res = await app.request("/api/users?q=_");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.data).toHaveLength(0);
    });
  });

  describe("GET /api/:resource/:id", () => {
    it("returns a single resource by id", async () => {
      const res = await app.request("/api/users/1");
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.id).toBe(1);
      expect(body.name).toBe("Leanne Graham");
    });

    it("returns 404 for non-existent id", async () => {
      const res = await app.request("/api/users/9999");
      expect(res.status).toBe(404);
      const body = await res.json() as JsonBody;
      expect(body.error).toBe("Not found");
    });

    it("returns 404 for invalid id", async () => {
      const res = await app.request("/api/users/abc");
      expect(res.status).toBe(404);
    });

    it("returns 404 for invalid resource", async () => {
      const res = await app.request("/api/invalid/1");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/:resource", () => {
    it("creates a new resource", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New User", username: "newuser", email: "new@test.com" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as JsonBody;
      expect(body.id).toBe(4);
      expect(body.name).toBe("New User");
    });

    it("rejects request with body larger than 50MB", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": "52428801" },
      });
      expect(res.status).toBe(413);
      const body = await res.json() as JsonBody;
      expect(body.error).toBe("Request body too large");
    });

    it("returns 404 for invalid resource", async () => {
      const res = await app.request("/api/invalid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/:resource/:id", () => {
    it("replaces a resource", async () => {
      const res = await app.request("/api/users/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated User", email: "updated@test.com" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.name).toBe("Updated User");
      expect(body.email).toBe("updated@test.com");
    });

    it("returns 404 for non-existent id", async () => {
      const res = await app.request("/api/users/9999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for invalid id", async () => {
      const res = await app.request("/api/users/abc", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects PUT request with body larger than 50MB", async () => {
      const res = await app.request("/api/users/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Content-Length": String(51 * 1024 * 1024) },
        body: JSON.stringify({ name: "oversized" }),
      });
      expect(res.status).toBe(413);
      const body = await res.json() as JsonBody;
      expect(body.error).toBe("Request body too large");
    });
  });

  describe("PATCH /api/:resource/:id", () => {
    it("partially updates a resource", async () => {
      const res = await app.request("/api/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "new-phone-number" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as JsonBody;
      expect(body.phone).toBe("new-phone-number");
      expect(body.name).toBe("Leanne Graham");
    });

    it("returns 404 for non-existent id", async () => {
      const res = await app.request("/api/users/9999", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for invalid id", async () => {
      const res = await app.request("/api/users/abc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects PATCH request with body larger than 50MB", async () => {
      const res = await app.request("/api/users/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Content-Length": String(51 * 1024 * 1024) },
        body: JSON.stringify({ name: "oversized" }),
      });
      expect(res.status).toBe(413);
      const body = await res.json() as JsonBody;
      expect(body.error).toBe("Request body too large");
    });
  });

  describe("DELETE /api/:resource/:id", () => {
    it("deletes a resource", async () => {
      const res = await app.request("/api/users/1", { method: "DELETE" });
      expect(res.status).toBe(204);

      const checkRes = await app.request("/api/users/1");
      expect(checkRes.status).toBe(404);
    });

    it("returns 204 even for non-existent id", async () => {
      const res = await app.request("/api/users/9999", { method: "DELETE" });
      expect(res.status).toBe(204);
    });

    it("returns 404 for invalid id", async () => {
      const res = await app.request("/api/users/abc", { method: "DELETE" });
      expect(res.status).toBe(404);
    });
  });

  describe("all /api/* fallback", () => {
    it("returns 404 for unsupported methods on /api/:resource", async () => {
      const res = await app.request("/api/unknown", { method: "PATCH" });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/:resource body size limit", () => {
    it("returns 413 for request body larger than 50MB", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": String(51 * 1024 * 1024) },
        body: JSON.stringify({ name: "oversized" }),
      });
      expect(res.status).toBe(413);
      const body = await res.json() as JsonBody;
      expect(body.error).toBe("Request body too large");
    });
  });
});

describe("REST API - multiple resources", () => {
  it("handles posts resource", async () => {
    const res = await app.request("/api/posts");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(3);
  });

  it("handles comments resource", async () => {
    const res = await app.request("/api/comments");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(2);
  });

  it("handles albums resource", async () => {
    const res = await app.request("/api/albums");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(2);
  });

  it("handles photos resource", async () => {
    const res = await app.request("/api/photos");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(2);
  });

  it("handles todos resource", async () => {
    const res = await app.request("/api/todos");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(3);
  });

  it("filters posts by userId", async () => {
    const res = await app.request("/api/posts?userId=1");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(2);
  });

  it("filters todos by completed status (0/1)", async () => {
    const res = await app.request("/api/todos?completed=1");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(2);
  });

  it("filters users with wildcard", async () => {
    const res = await app.request("/api/users?name=*Leanne*");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Leanne Graham");
  });

  it("serves tRPC ping endpoint via HTTP", async () => {
    const res = await app.request("/api/trpc/ping");
    expect(res.status).toBe(200);
    const body = await res.json() as JsonBody;
    expect(body.result.data.json.ok).toBe(true);
    expect(body.result.data.json).toHaveProperty("ts");
  });
});
