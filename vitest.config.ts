import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "web"),
      "@db": path.resolve(templateRoot, "db"),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["web/**", "jsdom"],
    ],
    include: ["api/**/*.test.ts", "api/**/*.spec.ts", "db/**/*.test.ts", "db/**/*.spec.ts", "web/**/*.test.ts", "web/**/*.spec.ts"],
    setupFiles: ["api/__tests__/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["api/**", "contracts/**", "db/**", "web/**"],
      exclude: [
        "api/__tests__/**",
        "api/lib/vite.ts",
        "db/migrations/**",
        "db/seed.ts",
        "db/seed-settings.ts",
        "db/seed-admin.ts",
        "web/__tests__/**",
        "web/main.ts",
        "web/App.vue",
        "web/env.d.ts",
        "web/index.css",
        "web/providers/trpc.ts",
      ],
      reporter: ["text", "json", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
});