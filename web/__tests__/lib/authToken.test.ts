// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { setAuthToken, getAuthToken } from "@/lib/authToken"

describe("authToken", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("stores and retrieves auth token", () => {
    setAuthToken("my-token")
    expect(getAuthToken()).toBe("my-token")
  })

  it("removes token when set to null", () => {
    setAuthToken("my-token")
    setAuthToken(null)
    expect(getAuthToken()).toBeNull()
  })

  it("removes token when set to empty string", () => {
    setAuthToken("my-token")
    setAuthToken("")
    expect(getAuthToken()).toBeNull()
  })

  it("returns null when no token stored", () => {
    expect(getAuthToken()).toBeNull()
  })
})
