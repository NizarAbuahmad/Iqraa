import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { HELD_READS } from "../heldReads.ts";

/**
 * A held route keeps one database connection for as long as its handler runs, so only routes
 * that read, and never call a model, another service or a push, may mount holdScopedConnection.
 * The list lives in lib/heldReads.ts with a reason per route; adding to it means editing this
 * pin's source of truth, which is where a reviewer asks "does this handler wait on anything?".
 */
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const MOUNT = /router\.get\(\s*"([^"]+)"\s*,\s*holdScopedConnection\b/g;
const CALLS_OUT = /\b(fetch|sendExpoPush|pushWithin|generateContent|streamChat|openai)\b/i;
/** The held scope is READ ONLY, and a transaction would take a second pool slot. */
const WRITES = /\.(insert|update|delete|transaction)\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** Every held mount: its route and the source from the mount to the handler's closing `});`. */
function mounts(): Array<{ route: string; body: string }> {
  return sources(path.join(src, "routes")).flatMap(file => {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(MOUNT)].map(m => {
      // A route handler ends with `});` at column 0; the +4 keeps that closer inside the slice.
      const close = text.indexOf("\n});", m.index!);
      return { route: `GET ${m[1]}`, body: text.slice(m.index!, close === -1 ? undefined : close + 4) };
    });
  });
}

describe("which routes may hold a database connection", () => {
  test("exactly the allow-listed routes mount holdScopedConnection", () => {
    assert.deepEqual(mounts().map(m => m.route).sort(), Object.keys(HELD_READS).sort());
  });

  test("every entry is a GET and none is a model or chat route", () => {
    for (const key of Object.keys(HELD_READS)) {
      assert.match(key, /^GET \//);
      assert.doesNotMatch(key, /^GET \/(generate|chat)/);
    }
  });

  test("no held handler calls a model, another service or a push", () => {
    for (const { route, body } of mounts()) {
      assert.doesNotMatch(body, CALLS_OUT, `${route} waits on something outside the database`);
    }
  });

  test("no held handler writes or opens a transaction", () => {
    for (const { route, body } of mounts()) {
      assert.doesNotMatch(
        body,
        WRITES,
        `${route} writes or opens a transaction, but a held scope is READ ONLY and .transaction( takes a second pool slot`,
      );
    }
  });

  test("the guards catch what they are for", () => {
    assert.match("await db.insert(x)", WRITES, "an insert must trip the write guard");
    assert.match("await pushWithin(a, b)", CALLS_OUT, "a push must trip the calls-out guard");
  });

  test("every entry has a reason", () => {
    for (const [route, reason] of Object.entries(HELD_READS)) assert.ok(reason.length > 20, route);
  });
});
