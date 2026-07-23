import { createRouter, publicQuery } from "./middleware";
import { jsonServerRouter } from "./jsonServerRouter";
import { adminRouter } from "./adminRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  json: jsonServerRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
