import { TRPCError } from "@trpc/server";

const STATUS_MAP: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
};

export function toHttpError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof TRPCError) {
    const status = STATUS_MAP[error.code] || 500;
    const message = status === 500 ? "Internal server error" : error.message;
    if (status === 500) {
      console.error("Internal server error:", error);
    }
    return { status, body: { ok: false, message } };
  }

  if (error instanceof SyntaxError) {
    return { status: 400, body: { ok: false, message: "Invalid JSON body" } };
  }

  console.error("Unknown error:", error);
  return { status: 500, body: { ok: false, message: "Internal server error" } };
}
