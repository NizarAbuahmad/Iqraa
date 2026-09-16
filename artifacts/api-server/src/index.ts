import app from "./app";
import { logger } from "./lib/logger";
import { hydrateSpendFromStore } from "./lib/aiBudget.ts";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/*
 * SESSION_SECRET signs every access token, so a guessable one forges every
 * session in the product — and nothing would say so. `authMiddleware` checks
 * only that the variable is *present*, which `local-dev-session-secret-change-me`
 * satisfies as happily as 32 random bytes.
 *
 * Refused at boot rather than warned about, in the same shape as PORT above.
 * A warning in a log nobody greps is how a placeholder reaches production and
 * stays there; a container that will not start is noticed in minutes. The
 * deploy order makes that safe to insist on — deploy.yml ships the API first
 * and stops if it fails, so a bad value costs a failed deploy rather than a
 * live outage.
 *
 * 32 characters, not an entropy estimate: the length of a hex-encoded 16-byte
 * secret, and long enough that every placeholder in this repo's own
 * .env.example fails it.
 */
const MIN_SESSION_SECRET_LENGTH = 32;
const sessionSecret = process.env["SESSION_SECRET"];

if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}

if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
  // Never the value, and never a prefix of it — the length alone says what is
  // wrong, and this message reaches logs that have leaked before.
  throw new Error(
    `SESSION_SECRET is ${sessionSecret.length} characters; at least ` +
      `${MIN_SESSION_SECRET_LENGTH} are required. Generate one with ` +
      `\`openssl rand -hex 32\` and set it on the service.`,
  );
}

// Load the month's spend before serving. Awaited rather than fired off: a
// request arriving in the gap would be measured against a total of zero, which
// is the exact failure this replaces. It never rejects — an unreachable table
// logs and leaves the guard counting from zero for this process.
await hydrateSpendFromStore();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
