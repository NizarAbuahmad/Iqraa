import { currentIdentity, openRequestScope, runInScope } from "@workspace/db";
import { makeHoldScopedConnection } from "../lib/heldConnection.js";
import { logger } from "../lib/logger.js";

/**
 * Hold one row-level-security connection for the whole request. Mount it, after authMiddleware,
 * ONLY on a GET route listed in lib/heldReads.ts: the handler keeps the connection until it
 * answers, so it must not wait on a model, another service or a push (heldReads.test.ts checks).
 * Inert while RLS_ENFORCE is off. How long each request held it is logged at debug level.
 */
export const holdScopedConnection = makeHoldScopedConnection({
  identity: currentIdentity,
  open: openRequestScope,
  run: runInScope,
  log: info => logger.debug(info, "held scope ended"),
});
