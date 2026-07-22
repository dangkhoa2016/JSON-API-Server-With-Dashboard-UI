import { describe, it, expect } from "vitest";
import { formatSettingValue } from "../inspect-db";

describe("formatSettingValue", () => {
  it("masks private setting when reveal is false", () => {
    const result = formatSettingValue(
      { key: "APP_SECRET", value: "mysecret", isPublic: false, type: "string", label: "App Secret", description: "", group: "general" },
      false
    );
    expect(result).toBe("********");
  });

  it("shows public setting value without reveal", () => {
    const result = formatSettingValue(
      { key: "REDIS_HOST", value: "localhost", isPublic: true, type: "string", label: "Redis Host", description: "", group: "redis" },
      false
    );
    expect(result).toBe("localhost");
  });

  it("shows private setting value when reveal is true", () => {
    const result = formatSettingValue(
      { key: "APP_SECRET", value: "mysecret", isPublic: false, type: "string", label: "App Secret", description: "", group: "general" },
      true
    );
    expect(result).toBe("mysecret");
  });
});
