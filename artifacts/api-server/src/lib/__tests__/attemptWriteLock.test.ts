/**
 * A save racing a hand-in must not land after grading.
 *
 * `writeWhileOpen` is the save side: it re-reads `submitted_at` under the
 * attempt's row lock and only then writes. The lock itself is Postgres's, so
 * this suite (no database under `node --test`) checks the two things that are
 * ours: the read asks for the lock, and a paper found submitted is never
 * written to. The route wiring — every student write going through it, and the
 * hand-in taking the same lock with a conditional update — is pinned
 * structurally at the bottom, in the same posture as aiBudget.test.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

import { writeWhileOpen, type SqlExecutor } from "../attemptWriteLock.ts";

const dialect = new PgDialect();

function fakeDb(submittedAt: Date | null | undefined) {
  const queries: string[] = [];
  const tx: SqlExecutor = {
    async execute(query: SQL) {
      queries.push(dialect.sqlToQuery(query).sql);
      return { rows: submittedAt === undefined ? [] : [{ submitted_at: submittedAt }] };
    },
  };
  return {
    queries,
    db: { transaction: <T>(work: (t: SqlExecutor) => Promise<T>) => work(tx) },
  };
}

describe("writeWhileOpen", () => {
  it("writes to an open paper, under a row lock", async () => {
    const { db, queries } = fakeDb(null);
    let wrote = false;
    const result = await writeWhileOpen(db, "a1", async () => {
      wrote = true;
      return "saved";
    });
    assert.deepEqual(result, { open: true, value: "saved" });
    assert.ok(wrote);
    assert.match(queries[0]!, /from attempts where id = \$1 for update/i);
  });

  it("refuses a paper handed in since the request read it", async () => {
    const { db } = fakeDb(new Date());
    let wrote = false;
    const result = await writeWhileOpen(db, "a1", async () => {
      wrote = true;
    });
    assert.deepEqual(result, { open: false });
    assert.equal(wrote, false, "a submitted paper must not be written to");
  });

  it("refuses an attempt that no longer exists", async () => {
    const { db } = fakeDb(undefined);
    assert.deepEqual(await writeWhileOpen(db, "gone", async () => "x"), { open: false });
  });
});

describe("student exam routes (structural)", () => {
  const src = readFileSync(new URL("../../routes/studentAttempt.ts", import.meta.url), "utf8");
  const route = (marker: string) => {
    const start = src.indexOf(marker);
    assert.ok(start >= 0, `${marker} not found — renamed?`);
    const next = src.indexOf("\nrouter.", start + marker.length);
    return src.slice(start, next < 0 ? undefined : next);
  };

  it("saves answers only through the lock", () => {
    const save = route('router.put("/take/attempt/answers/:questionId"');
    assert.match(save, /writeWhileOpen\(db, attempt\.id/);
    assert.match(save, /already_submitted/);
    assert.doesNotMatch(save, /await db\s*\.insert\(attemptAnswers\)/, "an unlocked upsert is the race");
  });

  it("claims and saves read-aloud takes only through the lock", () => {
    const audio = route('router.post("/take/attempt/audio/:questionId"');
    assert.equal(audio.match(/writeWhileOpen\(db, attempt\.id/g)?.length, 2, "claim + save");
    assert.doesNotMatch(audio, /await db\s*\.insert\(attemptAnswers\)/);
  });

  it("hands in with a conditional update, which takes the same row lock", () => {
    const submit = route('router.post("/take/attempt/submit"');
    assert.match(submit, /db\.transaction/);
    assert.match(submit, /isNull\(attempts\.submittedAt\)/);
  });
});
