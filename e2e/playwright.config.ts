import { defineConfig } from "@playwright/test";

const API_PORT = 8099;
const WEB_PORT = 8098;

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL is not set. Point it at a THROWAWAY Postgres database that already has the " +
      "migrations applied and `seed:assessment` run — the test creates users and wipes rate_limit_buckets.",
  );
}

export default defineConfig({
  testDir: "./tests",
  // One journey, two browsers, a real server: generous, but a hang must not eat the CI budget.
  timeout: 150_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // CI installs Playwright's own Chromium; locally use the Chrome that is already on the machine.
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node ../artifacts/api-server/dist/index.mjs",
      url: `http://localhost:${API_PORT}/api/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        // Must not be "production": that turns off the localhost CORS allowance and the
        // verification-code log line.
        NODE_ENV: "development",
        DATABASE_URL: databaseUrl,
        SESSION_SECRET: "e2e-session-secret-not-used-anywhere-else-0123456789",
        // The OpenAI client throws at import without a key; this value is never sent anywhere
        // because AI_LIVE_MODE is off and evaluations use the deterministic generator.
        OPENAI_API_KEY: "sk-e2e-placeholder-never-used",
        AI_LIVE_MODE: "false",
        STUDENT_ACCOUNTS: "false",
        RESEND_API_KEY: "",
        MATH_VERIFIER_URL: "",
      },
    },
    {
      command: "node serve.mjs",
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { WEB_PORT: String(WEB_PORT) },
    },
  ],
});
