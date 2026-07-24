import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { toHttpError } from "../lib/httpError";

describe("toHttpError", () => {
  it("maps TRPCError to known status", () => {
    const err = new TRPCError({ code: "NOT_FOUND", message: "missing" });
    expect(toHttpError(err)).toMatchObject({
      status: 404,
      body: { ok: false, message: "missing" },
    });
  });

  it("maps TRPCError INTERNAL_SERVER_ERROR to 500 and logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "boom",
    });
    const result = toHttpError(err);
    expect(result).toMatchObject({
      status: 500,
      body: { ok: false, message: "Internal server error" },
    });
    expect(spy).toHaveBeenCalledWith("Internal server error:", err);
    spy.mockRestore();
  });

  it("maps TRPCError with unmapped code to 500 and logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new TRPCError({
      code: "TIMEOUT" as any,
      message: "timeout",
    });
    const result = toHttpError(err);
    expect(result).toMatchObject({
      status: 500,
      body: { ok: false, message: "Internal server error" },
    });
    expect(spy).toHaveBeenCalledWith("Internal server error:", err);
    spy.mockRestore();
  });

  it("handles non-TRPCError by logging and returning 500", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("random failure");
    const result = toHttpError(err);
    expect(result).toMatchObject({
      status: 500,
      body: { ok: false, message: "Internal server error" },
    });
    expect(spy).toHaveBeenCalledWith("Unknown error:", err);
    spy.mockRestore();
  });
});
