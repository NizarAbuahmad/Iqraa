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

import * as pkg from "@workspace/exam-paper";

import { QUIZ_TYPE_ORDER } from "../../../lib/generationShape.ts";
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

describe("the server and the app share one list, not two copies", () => {
  // The lists live in `lib/exam-paper`. The real guard for the API's two
  // exports is identity: they are the package's own arrays, not equal copies.
  // (The app's two exports get the same assertion in
  // `mobile/services/__tests__/examBlocks.test.ts` and `quizMinistryOrder.test.ts`,
  // which can import the mobile modules under node:test.)
  it("the API's EXAM_TYPE_ORDER and QUIZ_TYPE_ORDER are the package's own arrays", () => {
    assert.equal(EXAM_TYPE_ORDER, pkg.EXAM_TYPE_ORDER);
    assert.equal(QUIZ_TYPE_ORDER, pkg.QUIZ_TYPE_ORDER);
  });

  // The source-text checks below add two things the identity asserts cannot:
  // the two mobile files import from the package and carry no
  // `EXAM_TYPE_ORDER` / `QUIZ_TYPE_ORDER` literal, and the API's own modules
  // declare none either. A list under another name is not caught.
  const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("examBlocks.ts and quizPaper.ts import their lists from lib/exam-paper", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const mobile = (file: string) => strip(readFileSync(path.resolve(here, "../../../../../mobile/services", file), "utf8"));
    for (const [file, name] of [["examBlocks.ts", "EXAM_TYPE_ORDER"], ["quizPaper.ts", "QUIZ_TYPE_ORDER"]] as const) {
      const source = mobile(file);
      assert.match(source, /from '@workspace\/exam-paper'/, `${file} no longer imports from lib/exam-paper`);
      assert.doesNotMatch(source, new RegExp(`${name}[^=\\n]*=\\s*\\[`), `${file} has its own ${name} list again`);
    }
  });

  it("the API's own modules do not declare a list of their own either", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const read = (rel: string) => strip(readFileSync(path.resolve(here, rel), "utf8"));
    assert.doesNotMatch(read("../paperOrder.ts"), /EXAM_TYPE_ORDER[^=\n]*=\s*\[/);
    assert.doesNotMatch(read("../../../lib/generationShape.ts"), /QUIZ_TYPE_ORDER[^=\n]*=\s*(\[|\w+ as const)/);
  });
});
