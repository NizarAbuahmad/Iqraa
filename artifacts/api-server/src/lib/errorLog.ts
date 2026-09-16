/**
 * In-memory recent-error ring buffer. Fed automatically by every
 * logger.error(...) / logger.fatal(...) call app-wide (see logger.ts's pino
 * hook) plus the catch-all Express error handler in app.ts, so no route has
 * to opt in individually.
 *
 * Exists so "what broke recently" is a GET request (see
 * routes/health.ts → /healthz/errors) instead of scrolling raw Render logs.
 * In-memory only: resets on restart, not shared across instances — same
 * tradeoff as aiBudget.ts's spend counter, good enough for a single-process
 * pilot, not a substitute for real log aggregation once that's worth setting up.
 */

export type RecordedError = {
  timestamp: string;
  message: string;
  detail?: Record<string, unknown>;
};

const MAX_ERRORS = 50;
const recent: RecordedError[] = [];

/**
 * What may be kept from a log call's context object.
 *
 * This used to spread the whole thing. That is more than the route's docstring
 * promises ("no request bodies") and more than it should hold: every
 * `logger.error({ ... })` in this codebase decides, by accident, what
 * `/healthz/errors` will serve. At least one call site passes an address —
 * `logger.error({ userId, email }, "verification email not sent")` — and a
 * Postgres unique-violation arrives with the offending value inside
 * `err.message`, so "no request bodies" was true only in the narrowest sense.
 *
 * An allowlist instead: identifiers that say *where* something broke, never
 * the content that broke it. The route is `ADMIN_DEBUG_KEY`-gated, so this is
 * defence in depth rather than the only thing standing between a leak and a
 * reader — but a debugging endpoint is exactly the kind of thing that gets
 * opened up later, and the time to bound it is before that.
 */
const KEPT_DETAIL_KEYS: readonly string[] = [
  "url",
  "limiter",
  "userId",
  "attemptId",
  "evaluationId",
  "threadId",
  "kind",
  "code",
  "status",
];

function summarizeDetail(detail: unknown): Record<string, unknown> | undefined {
  if (detail == null || typeof detail !== "object") return undefined;
  const obj = detail as Record<string, unknown>;

  const kept: Record<string, unknown> = {};
  for (const key of KEPT_DETAIL_KEYS) {
    if (key in obj) kept[key] = obj[key];
  }

  const err = obj["err"] ?? obj["error"];
  if (err instanceof Error) {
    // `message` only, and no `cause`: a driver error's message can still carry
    // a value, but dropping it entirely would leave "something threw" with
    // nothing to act on. The name and message are the smallest thing that is
    // still worth reading.
    kept["err"] = { name: err.name, message: err.message };
  }

  return Object.keys(kept).length > 0 ? kept : undefined;
}

export function recordError(message: string, detail?: unknown): void {
  recent.push({
    timestamp: new Date().toISOString(),
    message,
    detail: summarizeDetail(detail),
  });
  if (recent.length > MAX_ERRORS) recent.shift();
}

/** Newest first. */
export function getRecentErrors(): RecordedError[] {
  return [...recent].reverse();
}
