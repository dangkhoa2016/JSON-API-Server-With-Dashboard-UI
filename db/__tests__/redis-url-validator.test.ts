import { describe, it, expect } from "vitest";
import { validateRedisUrl } from "../redis-url";

describe("validateRedisUrl", () => {
  it("returns null for valid redis:// URLs", () => {
    expect(validateRedisUrl("redis://cache:6379/0")).toBeNull();
    expect(validateRedisUrl("redis://localhost:6379")).toBeNull();
    expect(validateRedisUrl("redis://host:6379/")).toBeNull();
  });

  it("returns null for valid rediss:// URLs with userinfo and db index", () => {
    expect(validateRedisUrl("rediss://user:pass@host:6379/1")).toBeNull();
  });

  it("returns null when host is present with no port", () => {
    expect(validateRedisUrl("redis://host")).toBeNull();
  });

  it("rejects non-URL strings", () => {
    expect(validateRedisUrl("not-a-url")).not.toBeNull();
  });

  it("rejects non-redis schemes", () => {
    expect(validateRedisUrl("http://host:6379")).not.toBeNull();
  });

  it("rejects missing host", () => {
    expect(validateRedisUrl("redis:///0")).not.toBeNull();
  });

  it("rejects ports out of range", () => {
    expect(validateRedisUrl("redis://host:99999")).not.toBeNull();
    expect(validateRedisUrl("redis://host:0")).not.toBeNull();
  });

  it("rejects empty value", () => {
    expect(validateRedisUrl("")).not.toBeNull();
  });

  it("rejects non-numeric db index", () => {
    expect(validateRedisUrl("redis://host/abc")).not.toBeNull();
  });
});
