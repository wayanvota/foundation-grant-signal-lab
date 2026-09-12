import { defineConfig } from "@playwright/test";

const port = 4188;

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "*.e2e.spec.mjs",
  outputDir: "artifacts/playwright-e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: "artifacts/playwright-report" }]] : "line",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `PORT=${port} node test/e2e/fixture-server.mjs`,
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
