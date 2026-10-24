/**
 * Shapes pino's JSON so Google Cloud Logging, and through it Cloud Error
 * Reporting, understand it. Cloud Run reads whatever the process writes to
 * stdout; pino's own shape (`level: 50`, `msg`, no stack field) is parsed as an
 * unleveled entry, so nothing the API logged ever reached Error Reporting.
 *
 * Kept separate from logger.ts so the mapping can be tested without building a
 * logger (logger.ts picks a transport at import time).
 */

// pino label → Cloud Logging severity. `trace` has no equivalent below DEBUG.
const SEVERITY: Record<string, string> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

export function severityOf(label: string): { severity: string } {
  return { severity: SEVERITY[label] ?? "DEFAULT" };
}

/**
 * Error Reporting groups an ERROR-or-above entry by the stack trace it finds in
 * `stack_trace`. Every call site logs `{ err }`, which pino's `err` serializer
 * has already turned into `{ type, message, stack }` by the time this runs, so
 * the stack is copied up one level rather than rebuilt.
 */
export function withStackTrace(entry: Record<string, unknown>): Record<string, unknown> {
  const stack = (entry["err"] as { stack?: unknown } | undefined)?.stack;
  return typeof stack === "string" ? { ...entry, stack_trace: stack } : entry;
}
