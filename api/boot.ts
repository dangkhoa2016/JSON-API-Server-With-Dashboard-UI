import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { rateLimitMiddleware } from "./lib/ratelimit";
import { VALID_RESOURCES } from "./jsonServerRouter";
import type { Context } from "hono";
import { serveStaticFiles } from "./lib/vite";

type Resource = typeof VALID_RESOURCES[number];

function getJsonCaller(c: Context) {
  const caller = appRouter.createCaller({ req: c.req.raw, resHeaders: new Headers() });
  const handlers: Record<Resource, (typeof caller.json)[Resource]> = {
    users: caller.json.users,
    posts: caller.json.posts,
    comments: caller.json.comments,
    albums: caller.json.albums,
    photos: caller.json.photos,
    todos: caller.json.todos,
  };
  return {
    list: (resource: Resource, filters: Record<string, string>) =>
      (handlers[resource] as any).list({
        filters,
        sort: filters._sort,
        order: filters._order,
        limit: filters._limit ? parseInt(filters._limit) : undefined,
        page: filters._page ? parseInt(filters._page) : undefined,
        q: filters.q,
      }),
    getById: (resource: Resource, id: number) => (handlers[resource] as any).getById({ id }),
    create: (resource: Resource, body: unknown) => (handlers[resource] as any).create(body),
    update: (resource: Resource, id: number, body: unknown) => (handlers[resource] as any).update({ id, data: body }),
    delete: (resource: Resource, id: number) => (handlers[resource] as any).delete({ id }),
  };
}

const app = new Hono<{ Bindings: HttpBindings }>();

// Global middleware
app.use(cors());

// Reject requests with body larger than 50MB
const MAX_BODY_SIZE = 50 * 1024 * 1024;
app.use(async (c, next) => {
  if (["POST", "PUT", "PATCH"].includes(c.req.method)) {
    const len = parseInt(c.req.header("content-length") || "0", 10);
    if (len > MAX_BODY_SIZE) {
      return c.json({ error: "Request body too large" }, 413);
    }
  }
  await next();
});

// Rate limiting for all API routes
app.use("/api/*", rateLimitMiddleware);

// tRPC handler
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// Admin REST routes — thin HTTP adapter wrapping admin tRPC procedures
function getAdminCaller(c: Context) {
  const caller = appRouter.createCaller({ req: c.req.raw, resHeaders: new Headers() });
  return caller.admin;
}

async function adminCall(c: Context, fn: (admin: ReturnType<typeof getAdminCaller>) => Promise<Response>): Promise<Response> {
  try {
    const admin = getAdminCaller(c);
    return await fn(admin);
  } catch (err) {
    return c.json({ ok: false, message: (err as Error).message });
  }
}

app.post("/api/admin/auth/login", async (c) => {
  const admin = getAdminCaller(c);
  const result = await admin.auth.login(await c.req.json());
  return c.json(result);
});

app.get("/api/admin/settings", async (c) => {
  const admin = getAdminCaller(c);
  const result = await admin.settings.list();
  return c.json(result);
});

app.get("/api/admin/settings/:key", async (c) => {
  const admin = getAdminCaller(c);
  const result = await admin.settings.getByKey({ key: c.req.param("key") });
  if (result === null) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

app.put("/api/admin/settings/:key", async (c) => {
  return adminCall(c, async (admin) => {
    const { value } = await c.req.json();
    const result = await admin.settings.update({ key: c.req.param("key"), value });
    return c.json(result);
  });
});

app.post("/api/admin/settings/reset/:key", async (c) => {
  return adminCall(c, async (admin) => {
    const result = await admin.settings.reset({ key: c.req.param("key") });
    return c.json(result);
  });
});

app.post("/api/admin/data/seed", async (c) => {
  return adminCall(c, async (admin) => {
    const result = await admin.data.seed();
    return c.json(result);
  });
});

app.post("/api/admin/data/reset", async (c) => {
  return adminCall(c, async (admin) => {
    const result = await admin.data.resetDatabase();
    return c.json(result);
  });
});

// REST API compatibility routes (mimic json-server style REST endpoints)
function validateResource(resource: string): resource is Resource {
  return (VALID_RESOURCES as readonly string[]).includes(resource);
}

app.get("/api/counts", async (c) => {
  const caller = appRouter.createCaller({ req: c.req.raw, resHeaders: new Headers() });
  const result = await caller.json.getCounts();
  return c.json(result);
});

app.get("/api/feature-cards", async (c) => {
  const caller = appRouter.createCaller({ req: c.req.raw, resHeaders: new Headers() });
  const result = await caller.json.getFeatureCards();
  return c.json(result);
});

app.get("/api/:resource", async (c) => {
  const resource = c.req.param("resource");
  if (!validateResource(resource)) return c.json({ error: "Resource not found" }, 404);

  const api = getJsonCaller(c);
  const result = await api.list(resource, c.req.query());
  return c.json(result);
});

app.get("/api/:resource/:id", async (c) => {
  const resource = c.req.param("resource");
  const id = parseInt(c.req.param("id"));
  if (!validateResource(resource) || isNaN(id)) return c.json({ error: "Not found" }, 404);

  const api = getJsonCaller(c);
  const result = await api.getById(resource, id);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

app.post("/api/:resource", async (c) => {
  const resource = c.req.param("resource");
  if (!validateResource(resource)) return c.json({ error: "Resource not found" }, 404);

  const api = getJsonCaller(c);
  const result = await api.create(resource, await c.req.json());
  return c.json(result, 201);
});

app.put("/api/:resource/:id", async (c) => {
  const resource = c.req.param("resource");
  const id = parseInt(c.req.param("id"));
  if (!validateResource(resource) || isNaN(id)) return c.json({ error: "Not found" }, 404);

  const api = getJsonCaller(c);
  const result = await api.update(resource, id, await c.req.json());
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

app.patch("/api/:resource/:id", async (c) => {
  const resource = c.req.param("resource");
  const id = parseInt(c.req.param("id"));
  if (!validateResource(resource) || isNaN(id)) return c.json({ error: "Not found" }, 404);

  const api = getJsonCaller(c);
  // Drizzle's .set() only updates columns present in the body — partial merge by default
  const result = await api.update(resource, id, await c.req.json());
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

app.delete("/api/:resource/:id", async (c) => {
  const resource = c.req.param("resource");
  const id = parseInt(c.req.param("id"));
  if (!validateResource(resource) || isNaN(id)) return c.json({ error: "Not found" }, 404);

  const api = getJsonCaller(c);
  await api.delete(resource, id);
  return c.body(null, 204);
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

const isMainModule = process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;

if (isMainModule || env.isProduction) {
  env.isProduction && serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
