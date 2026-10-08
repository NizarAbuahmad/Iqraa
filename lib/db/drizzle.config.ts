import { defineConfig } from "drizzle-kit";

// `generate` diffs the schema against migrations/meta and never connects, so it
// must work without a URL. Commands that do connect (`push`) check for one in
// their own wrapper scripts.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
