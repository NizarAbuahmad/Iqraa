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
