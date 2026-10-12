/**
 * Real book questions on the live model path.
 *
 * What these pin:
 *  1. Nothing is planned or drawn unless the flag is on, the subject is maths,
 *     a lesson with items is selected and a matching type was requested.
 *  2. The plan is at most half the paper and never more than is eligible.
 *  3. A draw is never a near-duplicate of a model question, never an unrequested
 *     type, and never carries a `check`.
 *  4. A regeneration prefers items the teacher has not seen, and falls back to
 *     repeats before returning a short paper.
 *  5. The assembled paper is exactly as long as was asked, the model's surplus
 *     is cut BEFORE the book questions are added, and with no book questions the
 *     model's paper passes through untouched.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { bookItemsForLesson } from "@workspace/curriculum/bookItems";
import type { CurriculumObjective } from "@workspace/curriculum";
import {
  assembleLivePaper,
  drawBookQuestions,
  isBookItemsLiveOn,
  planBookDraw,
  previousBookItemIds,
} from "../bookQuestions.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";
import { validateGenerated } from "../validator.ts";

const SYSTEMS = "kbl-math-s1-nccd-u1_l1";
const DERIVATIVES = "kbl-math-s2-nccd-u6_l2";

const objective = (id: string, lessonId?: string): CurriculumObjective =>
  ({
    id,
    description: "objective",
    descriptionAr: "هدف",
    bloomsSource: "defaulted",
    skills: [],
    ...(lessonId ? { lessonId } : {}),
  }) as unknown as CurriculumObjective;

/** Deterministic rng so a failing draw is reproducible. */
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

/** A model-written question: distinct wording per index, valid for the validator. */
const modelQuestion = (i: number, objectiveId: string): GeneratedQuestion => ({
  type: "short_answer",
  body: { prompt: `سؤال رقم ${i}: اشرح باستعمال المفردة الخاصة ${"أ".repeat(i + 1)} كلمة مميزة${i}` },
  expectedAnswer: { modelAnswer: `إجابة ${i}`, keyConcepts: [`مفهوم${i}`] },
  rubric: { criteria: [{ label: "صحة", marks: 3 }] },
  objectiveId,
  competencyKey: "application",
  difficulty: "standard",
  marks: 3,
  skill: null,
  gradingMode: "ai_rubric",
  aiMetadata: { generator: "llm" },
});

const BOTH = ["multiple_choice", "short_answer"] as const;
const plan = (over: Partial<Parameters<typeof planBookDraw>[0]> = {}) =>
  planBookDraw({
    objectives: [objective("o1", SYSTEMS)],
    assessmentTypes: [...BOTH],
    count: 10,
    subjectId: "mathematics",
    enabled: true,
    ...over,
  });

const saved = process.env["BOOK_ITEMS_LIVE"];
afterEach(() => {
  if (saved === undefined) delete process.env["BOOK_ITEMS_LIVE"];
  else process.env["BOOK_ITEMS_LIVE"] = saved;
});

describe("isBookItemsLiveOn", () => {
  it("is on only for exactly 'true', read per call", () => {
    delete process.env["BOOK_ITEMS_LIVE"];
    assert.equal(isBookItemsLiveOn(), false);
    for (const v of ["1", "TRUE", "yes", "", "false"]) {
      process.env["BOOK_ITEMS_LIVE"] = v;
      assert.equal(isBookItemsLiveOn(), false, v);
    }
    process.env["BOOK_ITEMS_LIVE"] = "true";
    assert.equal(isBookItemsLiveOn(), true);
  });
});

describe("planBookDraw", () => {
  it("plans nothing unless every condition holds", () => {
    assert.ok(plan() > 0, "the baseline must plan something");
    assert.equal(plan({ enabled: false }), 0, "flag off");
    assert.equal(plan({ subjectId: "chemistry" }), 0, "not maths");
    assert.equal(plan({ subjectId: undefined }), 0, "no subject");
    assert.equal(plan({ objectives: [objective("o1")] }), 0, "no lessonId");
    assert.equal(plan({ objectives: [objective("o1", "kbl-math-s1-nccd-u4_l1")] }), 0, "lesson without items");
    assert.equal(plan({ assessmentTypes: ["true_false", "fill_blank"] }), 0, "no matching type");
  });

  it("is at most half the paper", () => {
    assert.equal(plan({ count: 1 }), 0);
    assert.equal(plan({ count: 4 }), 2);
    assert.equal(plan({ count: 7 }), 3);
  });

  it("is never more than what is eligible, counted per requested type", () => {
    const only = (kind: "exercise" | "unit-test-mcq") =>
      bookItemsForLesson(DERIVATIVES).filter(i => i.kind === kind).length;
    assert.equal(plan({ objectives: [objective("o1", DERIVATIVES)], assessmentTypes: ["short_answer"], count: 100 }), only("exercise"));
    // Derivatives have no unit-test choices, so asking only for choices plans none.
    assert.equal(plan({ objectives: [objective("o1", DERIVATIVES)], assessmentTypes: ["multiple_choice"], count: 100 }), only("unit-test-mcq"));
  });

  it("counts a lesson once however many objectives point at it", () => {
    const one = plan({ count: 100 });
    const two = plan({ count: 100, objectives: [objective("o1", SYSTEMS), objective("o2", SYSTEMS)] });
    assert.equal(two, one);
  });
});

describe("drawBookQuestions", () => {
  const draw = (over: Partial<Parameters<typeof drawBookQuestions>[0]> = {}) =>
    drawBookQuestions({
      objectives: [objective("o1", SYSTEMS)],
      assessmentTypes: [...BOTH],
      difficulty: "standard",
      k: 4,
      accepted: [],
      rng: lcg(7),
      ...over,
    });

  it("draws k distinct, labelled book questions with no check", () => {
    const qs = draw();
    assert.equal(qs.length, 4);
    assert.equal(new Set(qs.map(q => q.aiMetadata["bookItemId"])).size, 4);
    for (const q of qs) {
      assert.equal(q.aiMetadata["generator"], "book");
      assert.equal(q.check ?? null, null);
    }
  });

  it("assigns competency and marks by kind", () => {
    for (const q of draw({ k: 6 })) {
      if (q.type === "multiple_choice") {
        assert.deepEqual([q.competencyKey, q.marks], ["understanding", 2]);
      } else {
        assert.deepEqual([q.competencyKey, q.marks], ["application", 3]);
      }
    }
  });

  it("draws only the requested types", () => {
    assert.ok(draw({ assessmentTypes: ["short_answer"], k: 5 }).every(q => q.type === "short_answer"));
    assert.ok(draw({ assessmentTypes: ["multiple_choice"], k: 5 }).every(q => q.type === "multiple_choice"));
    assert.deepEqual(draw({ assessmentTypes: ["true_false"] }), []);
  });

  it("returns nothing for k <= 0 or objectives without a lesson", () => {
    assert.deepEqual(draw({ k: 0 }), []);
    assert.deepEqual(draw({ objectives: [objective("o1")] }), []);
  });

  it("stops short, rather than looping, when the pool is spent", () => {
    const qs = draw({ k: 500 });
    assert.ok(qs.length > 0 && qs.length < 500, `${qs.length} drawn`);
  });

  it("is reproducible for a seed", () => {
    const ids = (seed: number) => draw({ rng: lcg(seed) }).map(q => q.aiMetadata["bookItemId"]);
    assert.deepEqual(ids(11), ids(11));
  });

  it("prefers items the teacher has not seen, and falls back to repeats before coming up short", () => {
    const first = draw({ k: 3 });
    const seen = new Set(first.map(q => String(q.aiMetadata["bookItemId"])));
    const next = draw({ k: 3, avoidIds: seen });
    assert.equal(next.length, 3);
    assert.ok(next.every(q => !seen.has(String(q.aiMetadata["bookItemId"]))), "should have preferred unseen items");

    const everything = new Set(bookItemsForLesson(SYSTEMS).map(i => i.id));
    const repeated = draw({ k: 3, avoidIds: everything });
    assert.equal(repeated.length, 3, "all seen: repeats are better than a short paper");
  });

  it("is never rejected by the validator against model questions, over many seeds", () => {
    for (const lesson of [SYSTEMS, "kbl-math-s1-nccd-u1_l2", DERIVATIVES]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const o = objective("o1", lesson);
        const model = [0, 1, 2, 3, 4].map(i => modelQuestion(i, "o1"));
        const book = drawBookQuestions({
          objectives: [o], assessmentTypes: [...BOTH], difficulty: "standard",
          k: 5, accepted: model, rng: lcg(seed),
        });
        assert.ok(book.length > 0, `${lesson} seed ${seed}: nothing drawn, so this proves nothing`);
        const { rejected } = validateGenerated([...model, ...book], {
          allowedObjectiveIds: ["o1"],
          allowedTypes: [...BOTH],
        });
        assert.deepEqual(rejected, [], `${lesson} seed ${seed}: ${JSON.stringify(rejected)}`);
      }
    }
  });
});

describe("assembleLivePaper", () => {
  const model = (n: number) => Array.from({ length: n }, (_, i) => modelQuestion(i, "o1"));
  const bookFor = (accepted: readonly GeneratedQuestion[], k: number) =>
    drawBookQuestions({
      objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], difficulty: "standard",
      k, accepted, rng: lcg(3),
    });

  it("with no book questions planned, passes the model's paper through untouched", () => {
    const m = model(12);
    const out = assembleLivePaper({ modelQuestions: m, requested: 10, k: 0, draw: () => assert.fail("must not draw") });
    assert.deepEqual(out.questions, m);
    assert.equal(out.trimmed, 0);
    assert.equal(out.drawn, 0);
  });

  it("is exactly as long as asked, model first, book after", () => {
    const out = assembleLivePaper({ modelQuestions: model(6), requested: 10, k: 4, draw: a => bookFor(a, 4) });
    assert.equal(out.questions.length, 10);
    assert.deepEqual(out.questions.slice(0, 6).map(q => q.aiMetadata["generator"]), Array(6).fill("llm"));
    assert.deepEqual(out.questions.slice(6).map(q => q.aiMetadata["generator"]), Array(4).fill("book"));
    assert.equal(out.drawn, 4);
  });

  it("cuts the model's surplus BEFORE adding the book questions", () => {
    const out = assembleLivePaper({ modelQuestions: model(9), requested: 10, k: 4, draw: a => bookFor(a, 4) });
    assert.equal(out.trimmed, 3, "9 returned, 6 allowed");
    assert.equal(out.questions.length, 10);
    assert.equal(out.questions.filter(q => q.aiMetadata["generator"] === "book").length, 4, "no book question was cut");
  });

  it("hands the draw only the questions that survive the cut", () => {
    let seen = -1;
    assembleLivePaper({ modelQuestions: model(9), requested: 10, k: 4, draw: a => { seen = a.length; return []; } });
    assert.equal(seen, 6);
  });

  it("keeps every book question when the model delivers fewer than asked", () => {
    const out = assembleLivePaper({ modelQuestions: model(2), requested: 10, k: 4, draw: a => bookFor(a, 4) });
    assert.equal(out.questions.length, 6);
    assert.equal(out.drawn, 4);
  });
});

describe("previousBookItemIds", () => {
  it("collects the ids of earlier book questions and ignores everything else", () => {
    const ids = previousBookItemIds([
      { aiMetadata: { generator: "book", bookItemId: "bi-a" } },
      { aiMetadata: { generator: "llm" } },
      { aiMetadata: null },
      { aiMetadata: { bookItemId: 5 } },
    ]);
    assert.deepEqual([...ids], ["bi-a"]);
  });
});
