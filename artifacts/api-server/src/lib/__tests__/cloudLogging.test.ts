/**
 * What this guards: that an API error reaches Cloud Error Reporting.
 *
 * Cloud Run turns stdout JSON into log entries, and Error Reporting only picks
 * up an entry that is severity ERROR or higher AND carries a stack trace.
 * pino's default shape (`level: 50`, no severity, no stack field) satisfied
 * neither, so every logged error was invisible to it. These two functions are
 * what logger.ts hands pino in production.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { severityOf, withStackTrace } from "../cloudLogging.ts";

describe("severityOf", () => {
  it("maps every pino level to a Cloud Logging severity", () => {
    assert.deepEqual(
      ["trace", "debug", "info", "warn", "error", "fatal"].map((l) => severityOf(l).severity),
      ["DEBUG", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
    );
  });

  it("falls back to DEFAULT for a label it does not know", () => {
    assert.equal(severityOf("custom").severity, "DEFAULT");
  });
});

describe("withStackTrace", () => {
  it("copies a serialized err's stack up to stack_trace", () => {
    const out = withStackTrace({ err: { type: "Error", message: "boom", stack: "Error: boom\n    at x" }, url: "/a" });
    assert.equal(out["stack_trace"], "Error: boom\n    at x");
    assert.equal(out["url"], "/a", "the rest of the entry is kept");
  });

  it("leaves an entry with no stack alone", () => {
    const entry = { url: "/a" };
    assert.equal(withStackTrace(entry), entry);
    assert.deepEqual(withStackTrace({ err: { message: "no stack" } }), { err: { message: "no stack" } });
  });
});
