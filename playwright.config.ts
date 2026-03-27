import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    headless: true
  },
  webServer: {
    command: "npm run dev",
    url: process.env.APP_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true
  }
});

