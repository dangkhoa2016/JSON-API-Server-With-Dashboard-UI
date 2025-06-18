import { createRouter, publicQuery } from "./middleware";
import { jsonServerRouter } from "./jsonServerRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  json: jsonServerRouter,
});

export type AppRouter = typeof appRouter;
