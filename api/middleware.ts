import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { verifySession } from "./lib/adminAuth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

export const adminQuery = publicQuery.use(async (opts) => {
  const authHeader = opts.ctx.req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin authentication required" });
  }
  const token = authHeader.slice(7);
  const session = await verifySession(token);
  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired session" });
  }
  return opts.next();
});
