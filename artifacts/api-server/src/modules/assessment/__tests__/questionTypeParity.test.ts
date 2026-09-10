/**
 * `QuestionType` exists twice, and both copies must list the same types.
 *
 * `lib/db/src/schema/evaluations.ts` is the definition; `artifacts/mobile/
 * services/evaluations.ts` hand-copies it, because `@workspace/db` is Drizzle
 * and `pg` and the client must not depend on the database layer to share one
 * string union.
 *
 * The copy is fine. The *drift* is not, and it is silent in the dangerous
 * direction: adding a type server-side compiles everywhere, ships, and the
 * teacher's picker simply never offers it — no error, no warning, just a
 * feature that is not there. That is exactly how `read_aloud` behaved for the
 * first twenty minutes of its existence, and how `mockGenerator.ts` came to
 * hold a stale copy of `BankUsePolicy`.
 *
 * Read as text rather than imported: the point is to check the file a person
 * edits, and importing the mobile module would drag `apiClient` and its
 * `expo-*` imports into a node:test run that cannot load them.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QUESTION_TYPES } from "../questionTypes.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../../..");

/**
 * The members of the first `export type QuestionType = 'a' | 'b';` in a file.
 *
 * Comments are stripped before the union is matched. Both unions carry
 * per-member doc comments, and the terminating `;` is found non-greedily — so
 * a semicolon in ordinary prose ("read a passage aloud; the recording is
 * transcribed") ends the match early and silently drops every member after it.
 * That is not hypothetical: it is what this function did on its first run.
 */
function unionMembers(file: string): string[] {
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const match = /export type QuestionType\s*=([\s\S]*?);/.exec(source);
  assert.ok(match, `no QuestionType union found in ${file}`);
  return [...match[1]!.matchAll(/["']([a-z_]+)["']/g)].map(m => m[1]!);
}

describe("QuestionType stays in sync across the two packages", () => {
  const mobile = path.join(repoRoot, "artifacts/mobile/services/evaluations.ts");
  const db = path.join(repoRoot, "lib/db/src/schema/evaluations.ts");

  it("finds a union in both files", () => {
    // Guards the test itself: a regex that silently matches nothing would make
    // every assertion below trivially true.
    assert.ok(unionMembers(db).length >= 8, "db union looks empty — has the shape changed?");
    assert.ok(unionMembers(mobile).length >= 8, "mobile union looks empty — has the shape changed?");
  });

  it("lists the same types in both", () => {
    assert.deepEqual(
      [...unionMembers(mobile)].sort(),
      [...unionMembers(db)].sort(),
      "artifacts/mobile/services/evaluations.ts and lib/db/src/schema/evaluations.ts disagree"
        + " — a type the client does not know is a type the teacher can never pick",
    );
  });

  it("gives every declared type a registry entry", () => {
    // The other half of the same failure: a type in the union with no module
    // has no validation and no student projection, and `moduleFor` returns
    // undefined at the point where a question is about to be shown.
    assert.deepEqual(
      Object.keys(QUESTION_TYPES).sort(),
      [...unionMembers(db)].sort(),
    );
  });
});
