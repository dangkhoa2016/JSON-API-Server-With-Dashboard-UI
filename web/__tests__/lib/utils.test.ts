import { describe, it, expect } from "vitest";
import { cn, tryParseJson } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    const result = cn("foo", "bar");
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  it("handles empty inputs", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("deduplicates tailwind classes", () => {
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
  });

  it("handles conditional classes", () => {
    const enabled = false;
    const result = cn("foo", enabled && "bar", "baz");
    expect(result).toContain("foo");
    expect(result).not.toContain("bar");
    expect(result).toContain("baz");
  });
});

describe("tryParseJson", () => {
  it("parses valid JSON", () => {
    const result = tryParseJson('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("returns empty object for invalid JSON", () => {
    const result = tryParseJson("not json");
    expect(result).toEqual({});
  });

  it("returns empty object for empty string", () => {
    const result = tryParseJson("");
    expect(result).toEqual({});
  });
});
