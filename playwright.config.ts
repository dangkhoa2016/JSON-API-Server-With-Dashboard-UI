import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./web/e2e",
  fullyParallel: false,
  retries: 1,
  timeout: 30000,
  webServer: {
    command: "yarn dev",
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
});
