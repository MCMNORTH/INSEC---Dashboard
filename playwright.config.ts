import { defineConfig, devices } from "@playwright/test";

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5432/insec_e2e";
const PORT = Number(process.env.E2E_PORT ?? 3100);
// Permet d'utiliser un Chromium déjà installé (ex. PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome).
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", trace: "retain-on-failure", launchOptions },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/health/live`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL,
      AUTH_SECRET: "secret-e2e-secret-e2e-secret-e2e-0123456789",
      APP_URL: `http://localhost:${PORT}`,
      STORAGE_DRIVER: "database",
      CRON_SECRET: "cron-e2e",
      SMTP_HOST: "",
    },
  },
});
