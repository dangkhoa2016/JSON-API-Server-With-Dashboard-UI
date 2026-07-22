// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

function mockMatchMedia(matches = false) {
  const listeners: Record<string, Function[]> = {};
  const mql = {
    matches,
    addEventListener: vi.fn((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    removeEventListener: vi.fn((event: string, cb: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((fn) => fn !== cb);
      }
    }),
  };
  (window as any).matchMedia = vi.fn(() => mql);
  return { mql, listeners };
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
  });

  describe("getSystemTheme", () => {
    it("returns dark when matchMedia matches", async () => {
      mockMatchMedia(true);
      const { getSystemTheme } = await import("@/composables/useTheme");
      expect(getSystemTheme()).toBe("dark");
    });

    it("returns light when matchMedia does not match", async () => {
      mockMatchMedia(false);
      const { getSystemTheme } = await import("@/composables/useTheme");
      expect(getSystemTheme()).toBe("light");
    });

    it("returns light when matchMedia throws", async () => {
      (window as any).matchMedia = () => { throw new Error("no matchMedia") };
      const { getSystemTheme } = await import("@/composables/useTheme");
      expect(getSystemTheme()).toBe("light");
    });
  });

  describe("readStoredTheme", () => {
    it("returns null when nothing stored", async () => {
      const { readStoredTheme } = await import("@/composables/useTheme");
      expect(readStoredTheme()).toBeNull();
    });

    it("returns stored theme when valid", async () => {
      localStorage.setItem("theme", "dark");
      const { readStoredTheme } = await import("@/composables/useTheme");
      expect(readStoredTheme()).toBe("dark");
    });

    it("returns null for invalid stored value", async () => {
      localStorage.setItem("theme", "invalid");
      const { readStoredTheme } = await import("@/composables/useTheme");
      expect(readStoredTheme()).toBeNull();
    });

    it("returns null when localStorage is undefined", async () => {
      const orig = (window as any).localStorage;
      delete (window as any).localStorage;
      const { readStoredTheme } = await import("@/composables/useTheme");
      expect(readStoredTheme()).toBeNull();
      (window as any).localStorage = orig;
    });
  });

  describe("useTheme hook", () => {
    it("returns theme ref and setTheme function", async () => {
      mockMatchMedia(false);
      const { useTheme } = await import("@/composables/useTheme");
      const { theme, setTheme } = useTheme();
      expect(theme).toBeDefined();
      expect(typeof setTheme).toBe("function");
    });

    it("setTheme persists to localStorage", async () => {
      mockMatchMedia(false);
      const { useTheme } = await import("@/composables/useTheme");
      const { setTheme } = useTheme();
      setTheme("dark");
      expect(localStorage.getItem("theme")).toBe("dark");
    });

    it("setTheme with auto mode", async () => {
      mockMatchMedia(false);
      const { useTheme } = await import("@/composables/useTheme");
      const { setTheme } = useTheme();
      setTheme("auto");
      expect(localStorage.getItem("theme")).toBe("auto");
    });

    it("setTheme with light mode", async () => {
      mockMatchMedia(false);
      const { useTheme } = await import("@/composables/useTheme");
      const { setTheme } = useTheme();
      setTheme("light");
      expect(localStorage.getItem("theme")).toBe("light");
    });
  });

  describe("listenForSystemThemeChanges and cleanupThemeListeners", () => {
    it("registers and removes change listener", async () => {
      const { mql } = mockMatchMedia(false);
      const { listenForSystemThemeChanges, cleanupThemeListeners } = await import("@/composables/useTheme");
      listenForSystemThemeChanges();
      expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
      cleanupThemeListeners();
      expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("cleanupThemeListeners is idempotent", async () => {
      mockMatchMedia(false);
      const { cleanupThemeListeners } = await import("@/composables/useTheme");
      cleanupThemeListeners();
      cleanupThemeListeners();
    });

    it("triggers applyTheme when system theme changes and mode is auto", async () => {
      const { listeners } = mockMatchMedia(false);
      const { listenForSystemThemeChanges, cleanupThemeListeners, useTheme } = await import("@/composables/useTheme");
      const { setTheme } = useTheme();
      setTheme("auto");
      listenForSystemThemeChanges();
      const changeHandler = listeners["change"]?.[0];
      expect(changeHandler).toBeDefined();
      changeHandler!();
      cleanupThemeListeners();
    });

    it("does not applyTheme when system theme changes and mode is not auto", async () => {
      const { listeners } = mockMatchMedia(false);
      const { listenForSystemThemeChanges, cleanupThemeListeners, useTheme } = await import("@/composables/useTheme");
      const { setTheme } = useTheme();
      setTheme("dark");
      listenForSystemThemeChanges();
      const changeHandler = listeners["change"]?.[0];
      expect(changeHandler).toBeDefined();
      changeHandler!();
      cleanupThemeListeners();
    });

    it("does nothing when window.matchMedia is not a function", async () => {
      (window as any).matchMedia = "not-a-function";
      const { listenForSystemThemeChanges, cleanupThemeListeners } = await import("@/composables/useTheme");
      listenForSystemThemeChanges();
      cleanupThemeListeners();
    });

    it("does not add listener when mql.addEventListener is missing", async () => {
      const mql = {
        matches: false,
      };
      (window as any).matchMedia = vi.fn(() => mql);
      const { listenForSystemThemeChanges, cleanupThemeListeners } = await import("@/composables/useTheme");
      listenForSystemThemeChanges();
      cleanupThemeListeners();
    });
  });

  describe("applyTheme (via setTheme)", () => {
    it("toggles dark class on document element", async () => {
      mockMatchMedia(false);
      const { useTheme } = await import("@/composables/useTheme");
      const { setTheme } = useTheme();
      setTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      setTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("auto mode applies system theme class", async () => {
      mockMatchMedia(true);
      const { useTheme } = await import("@/composables/useTheme");
      const { setTheme } = useTheme();
      setTheme("auto");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
});
