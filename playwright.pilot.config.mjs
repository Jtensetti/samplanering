import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/pilot",
  testMatch: "*.spec.mjs",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3320",
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          args: ["--no-sandbox", "--disable-gpu"],
        }
      : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/pilot-test-server.mjs",
    url: "http://127.0.0.1:3320/api/health",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
