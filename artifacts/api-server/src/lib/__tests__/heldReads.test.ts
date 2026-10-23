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

/** Every held mount: its file, its route and the source from the mount to the handler's closing `});`. */
function mounts(): Array<{ file: string; route: string; body: string }> {
  return sources(path.join(src, "routes")).flatMap(file => {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(MOUNT)].map(m => {
      // A route handler ends with `});` at column 0; the +4 keeps that closer inside the slice.
      const close = text.indexOf("\n});", m.index!);
      return { file: path.relative(src, file).split(path.sep).join("/"), route: `GET ${m[1]}`, body: text.slice(m.index!, close === -1 ? undefined : close + 4) };
    });
  });
}

/**
 * The parser above only understands `router.get("literal", holdScopedConnection, ...)`. A mount
 * in any other shape (a guard first, a template-literal path, router.use, router.route, app.ts,
 * a POST) would leave it blind, so this companion counts every use of the identifier in the
 * non-test sources and demands that each one is accounted for.
 */
const IDENT = /(?<![\w/])holdScopedConnection\b/g; // not a path segment such as ../middlewares/holdScopedConnection.js
/** Where the name is defined. The middleware exports it; the pure factory names its inner function the same. */
const DEFINITIONS: Record<string, number> = {
  "middlewares/holdScopedConnection.ts": 1,
  "lib/heldConnection.ts": 1,
};

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** How many uses of the identifier in `text` are not a definition, the one import, or a parsed mount. */
function unaccountedUses(file: string, text: string, parsedMounts: number): number {
  const code = withoutComments(text);
  const found = (code.match(IDENT) ?? []).length;
  const imports = parsedMounts > 0 ? 1 : 0;
  return found - (DEFINITIONS[file] ?? 0) - imports - parsedMounts;
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

  test("every use of holdScopedConnection in the sources is a definition, an import or a mount the parser saw", () => {
    const parsed = mounts();
    for (const abs of sources(src)) {
      const file = path.relative(src, abs).split(path.sep).join("/");
      const extra = unaccountedUses(file, readFileSync(abs, "utf8"), parsed.filter(m => m.file === file).length);
      assert.equal(extra, 0, `${file} uses holdScopedConnection in a way the allow-list parser cannot see (${extra} unaccounted); mount it as router.get("/path", holdScopedConnection, handler) and list the route in lib/heldReads.ts`);
    }
  });

  test("the occurrence count bites on a mount the parser cannot read", () => {
    const hidden = `import { holdScopedConnection } from "../middlewares/holdScopedConnection.js";\nrouter.get("/x", guard, holdScopedConnection, h);`;
    assert.equal([...hidden.matchAll(MOUNT)].length, 0, "the parser is blind to this shape");
    assert.equal(unaccountedUses("routes/x.ts", hidden, 0), 2, "so the count must flag it");
    const ok = `import { holdScopedConnection } from "../middlewares/holdScopedConnection.js";\nrouter.get("/x", holdScopedConnection, h);`;
    assert.equal(unaccountedUses("routes/x.ts", ok, [...ok.matchAll(MOUNT)].length), 0);
    assert.equal(unaccountedUses("routes/x.ts", `// holdScopedConnection is mentioned only here`, 0), 0, "a comment is not a use");
  });

  test("every entry has a reason", () => {
    for (const [route, reason] of Object.entries(HELD_READS)) assert.ok(reason.length > 20, route);
  });
});
