/**
 * The routes that hold one row-level-security connection for the whole request
 * (middlewares/holdScopedConnection.ts), and why each is safe to. A route belongs here only if
 * its handler reads and then answers: no model call, no HTTP call, no push while it runs.
 * lib/__tests__/heldReads.test.ts pins this list to the routes that actually mount the middleware.
 */
export const HELD_READS: Record<string, string> = {
  "GET /messaging/threads":
    "the inbox: seven or eight reads in sequence, then an answer; attachment links are signed locally, with no network call",
};
