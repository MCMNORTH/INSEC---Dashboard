import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/vide.ts") } },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5432/insec_test",
      AUTH_SECRET: "secret-de-test-secret-de-test-0123456789",
      STORAGE_DRIVER: "database",
      APP_TIMEZONE: "Africa/Nouakchott",
      SMTP_HOST: "",
    },
  },
});
