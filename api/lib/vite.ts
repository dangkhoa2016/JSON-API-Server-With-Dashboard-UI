import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs/promises";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

let cachedIndexHtml: string | null = null;

async function getIndexHtml(distPath: string): Promise<string> {
  if (cachedIndexHtml !== null) return cachedIndexHtml;
  const indexPath = path.resolve(distPath, "index.html");
  cachedIndexHtml = await fs.readFile(indexPath, "utf-8");
  return cachedIndexHtml;
}

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound(async (c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const content = await getIndexHtml(distPath);
    return c.html(content);
  });
}

export function resetIndexHtmlCache() {
  cachedIndexHtml = null;
}
