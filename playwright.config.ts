import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3137",
    headless: true,
    actionTimeout: 15_000,
    viewport: { width: 1440, height: 980 },
    trace: "retain-on-failure",
  },
  reporter: [["list"]],
  webServer: {
    command: "node tests/fixtures/serve.mjs",
    url: "http://localhost:3137/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
