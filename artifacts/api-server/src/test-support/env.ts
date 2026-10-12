/**
 * Paths and constants shared by the DB-backed test helpers.
 *
 * The bundle (not the source) is what the DB tests boot: source files use
 * extensionless imports only esbuild resolves — see mountOrder.test.ts.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** artifacts/api-server */
export const serverRoot = path.resolve(here, "../..");
export const repoRoot = path.resolve(serverRoot, "../..");
export const bundleEntry = path.join(serverRoot, "dist", "index.mjs");
export const migrateScript = path.join(repoRoot, "lib", "db", "scripts", "migrate.mjs");

/** At least 32 characters: src/index.ts refuses a shorter SESSION_SECRET. Used by both the spawned server and the token minter. */
export const TEST_SESSION_SECRET = "db-test-secret-padded-to-clear-the-32-char-boot-check";
