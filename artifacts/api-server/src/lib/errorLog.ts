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

function summarizeDetail(detail: unknown): Record<string, unknown> | undefined {
  if (detail == null || typeof detail !== "object") return undefined;
  const obj = detail as Record<string, unknown>;
  const err = obj.err ?? obj.error;
  if (err instanceof Error) {
    return { ...obj, err: { name: err.name, message: err.message } };
  }
  return obj;
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
