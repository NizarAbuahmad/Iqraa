/**
 * A generated evaluation is stored as a ministry paper: one block per type, in
 * the usual order. The model returns a mixed paper in whatever order it likes
 * and the mock rotates types, so a stored paper used to read MCQ, written,
 * true/false, MCQ… with no block for the teacher screen to head.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/modules/assessment/__tests__/paperOrder.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { EXAM_TYPE_ORDER, inPaperOrder } from "../paperOrder.ts";
import { QUESTION_TYPES } from "../questionTypes.ts";

const q = (id: string, type: string) => ({ id, type });
const ids = (xs: { id: string }[]) => xs.map(x => x.id).join(",");

describe("inPaperOrder", () => {
  it("groups a mixed paper into ministry blocks", () => {
    const paper = [
      q("a", "short_answer"), q("b", "multiple_choice"), q("c", "true_false"),
      q("d", "multiple_choice"), q("e", "fill_blank"), q("f", "matching"), q("g", "open_ended"),
    ];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), "b,d,c,f,e,a,g");
  });

  it("keeps the generator's own sequence inside a type", () => {
    const paper = [q("1", "true_false"), q("2", "multiple_choice"), q("3", "true_false"), q("4", "multiple_choice")];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), "2,4,1,3");
  });

  it("does not touch its input", () => {
    const paper = [q("a", "short_answer"), q("b", "multiple_choice")];
    inPaperOrder(paper, x => x.type);
    assert.equal(ids(paper), "a,b");
  });

  it("puts a type it does not know last, never first", () => {
    const paper = [q("x", "from_the_future"), q("a", "short_answer"), q("b", "multiple_choice")];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), "b,a,x");
  });

  it("is already in order for a one-type paper", () => {
    const paper = [q("1", "multiple_choice"), q("2", "multiple_choice")];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), "1,2");
  });
});

describe("EXAM_TYPE_ORDER", () => {
  it("lists every question type the registry defines, once", () => {
    // A type added to the registry and not here would sort after everything
    // else silently; this is the one place that notices.
    assert.deepEqual([...EXAM_TYPE_ORDER].sort(), Object.keys(QUESTION_TYPES).sort());
    assert.equal(new Set(EXAM_TYPE_ORDER).size, EXAM_TYPE_ORDER.length);
  });
});

describe("the server and the app order a paper identically", () => {
  // Two copies, as with QuestionType: the server stores the order, the app
  // heads its blocks by it. Read as text for the reason questionTypeParity
  // gives — importing the mobile module would not load under node:test.
  it("EXAM_TYPE_ORDER matches artifacts/mobile/services/examBlocks.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(here, "../../../../../mobile/services/examBlocks.ts");
    const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const match = /EXAM_TYPE_ORDER[^=]*=\s*\[([\s\S]*?)\]/.exec(source);
    assert.ok(match, "no EXAM_TYPE_ORDER found in the mobile file");
    const mobile = [...match[1]!.matchAll(/'([a-z_]+)'/g)].map(m => m[1]!);
    assert.ok(mobile.length >= 8, "mobile list looks empty — has the shape changed?");
    assert.deepEqual(mobile, [...EXAM_TYPE_ORDER]);
  });
});
