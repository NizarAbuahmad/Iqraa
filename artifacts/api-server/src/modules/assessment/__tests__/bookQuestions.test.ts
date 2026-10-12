/**
 * Real book questions on the live model path.
 *
 * What these pin:
 *  1. Nothing is planned or drawn unless the flag is on, the subject is maths,
 *     a lesson with items is selected and a matching type was requested.
 *  2. The plan is at most half the paper and never more than is eligible, and it
 *     is what the draw can DELIVER: near-duplicate book items are not both drawn,
 *     so counting raw items would ask the model for too few questions.
 *  3. A draw is never a near-duplicate of a model question, never an unrequested
 *     type, and never carries a `check`.
 *  4. A regeneration prefers items the teacher has not seen, and falls back to
 *     repeats before returning a short paper.
 *  5. The assembled paper is exactly as long as was asked, the model's surplus
 *     is cut BEFORE the book questions are added, and with no book questions the
 *     model's paper passes through untouched.
 *  6. With a `typeOrder` and at least one book question drawn, the combined paper
 *     is stably sorted into one block per type (the ministry layout the prompt
 *     asks for); with no `typeOrder`, or nothing drawn, nothing is reordered.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { bookItemsForLesson, displayMath, type BookItem } from "@workspace/curriculum/bookItems";
import type { CurriculumObjective } from "@workspace/curriculum";
import type { QuestionType } from "@workspace/db";
import {
  assembleLivePaper,
  bookItemsRecord,
  drawBookQuestions,
  isBookItemsLiveOn,
  liveSlot,
  mulberry32,
  PLAN_SEED,
  planBook,
  planBookDraw,
  summariseBook,
  previousBookItemIds,
} from "../bookQuestions.ts";
import type { GeneratedQuestion } from "../mockGenerator.ts";
import { DUPLICATE_THRESHOLD, promptOf, stemSimilarity, validateGenerated } from "../validator.ts";
import { allocateQuestions, COMPETENCY_KEYS, MARKS_BY_COMPETENCY, remainingQuota } from "../competency.ts";

const SYSTEMS = "kbl-math-s1-nccd-u1_l1";
const DERIVATIVES = "kbl-math-s2-nccd-u6_l2";
/** Every lesson that has served book items (lib/curriculum/src/data/book-items/). */
const LESSONS_WITH_ITEMS = [SYSTEMS, "kbl-math-s1-nccd-u1_l2", DERIVATIVES];

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

  it("plans what the draw can deliver, not how many items are eligible", () => {
    const o = [objective("o1", SYSTEMS)];
    const eligibleShort = bookItemsForLesson(SYSTEMS).filter(i => i.kind === "exercise").length;
    const planned = plan({ objectives: o, assessmentTypes: ["short_answer"], count: 40 });
    // The eight exercises are systems that read as near-duplicates of each other.
    assert.equal(eligibleShort, 8);
    assert.equal(planned, 4);
  });

  it("every lesson with book items: a draw of the planned size delivers exactly the plan", () => {
    const typeSets = [[...BOTH], ["short_answer"], ["multiple_choice"]] as const;
    for (const lesson of LESSONS_WITH_ITEMS) {
      assert.ok(bookItemsForLesson(lesson).length > 0, `${lesson} must have items`);
      for (const types of typeSets) {
        const o = [objective("o1", lesson)];
        const k = plan({ objectives: o, assessmentTypes: [...types], count: 40 });
        for (let seed = 1; seed <= 15; seed += 1) {
          const drawn = drawBookQuestions({
            objectives: o, assessmentTypes: [...types], difficulty: "standard",
            k, accepted: [], rng: lcg(seed),
          });
          assert.equal(drawn.length, k, `${lesson} [${types.join("+")}] seed ${seed}: planned ${k}, drew ${drawn.length}`);
        }
      }
    }
  });

  it("plans the same for the same request, and the plan holds at every difficulty", () => {
    // Today the plan does not vary with difficulty (tier only changes WHICH items
    // are drawn, not how many), so this pins plan == draw, not that it is read.
    assert.equal(plan({ count: 40 }), plan({ count: 40 }));
    for (const difficulty of ["basic", "standard", "advanced"] as const) {
      const o = [objective("o1", SYSTEMS)];
      const k = plan({ objectives: o, count: 40, difficulty });
      const drawn = drawBookQuestions({
        objectives: o, assessmentTypes: [...BOTH], difficulty, k, accepted: [], rng: lcg(5),
      });
      assert.equal(drawn.length, k, difficulty);
    }
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
        assert.deepEqual([q.competencyKey, q.marks], ["understanding", MARKS_BY_COMPETENCY["understanding"]]);
      } else {
        assert.deepEqual([q.competencyKey, q.marks], ["application", MARKS_BY_COMPETENCY["application"]]);
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

  it("never draws a book item the model has already written (clash against MODEL questions)", () => {
    const asModelQuestion = (instruction: string, stem: string): GeneratedQuestion => ({
      ...modelQuestion(0, "o1"),
      // Exactly the text `promptOf` reads from a book question's body.
      body: { prompt: displayMath(`${instruction}\n${stem}`) },
    });
    for (let seed = 1; seed <= 10; seed += 1) {
      const free = draw({ assessmentTypes: ["short_answer"], k: 8, rng: lcg(seed) });
      assert.ok(free.length > 0);
      const target = free[0]!;
      const item = bookItemsForLesson(SYSTEMS).find(i => i.id === target.aiMetadata["bookItemId"])!;
      const model = asModelQuestion(item.instruction, item.stem);
      // The model question really is what the validator would call a duplicate.
      assert.ok(stemSimilarity(promptOf(model), promptOf(target)) > DUPLICATE_THRESHOLD);

      const again = draw({ assessmentTypes: ["short_answer"], k: 8, rng: lcg(seed), accepted: [model] });
      const ids = again.map(q => q.aiMetadata["bookItemId"]);
      assert.ok(!ids.includes(item.id), `seed ${seed}: drew ${item.id} although the model already wrote it`);
      const { rejected } = validateGenerated([model, ...again], { allowedObjectiveIds: ["o1"], allowedTypes: [...BOTH] });
      assert.deepEqual(rejected, [], `seed ${seed}`);
    }
  });

  it("clash check covers multiple choice too: the only choice item is withheld when the model wrote it", () => {
    const [mcq] = bookItemsForLesson(SYSTEMS).filter(i => i.kind === "unit-test-mcq");
    assert.ok(mcq);
    const model: GeneratedQuestion = {
      ...modelQuestion(0, "o1"),
      body: { prompt: displayMath(`${mcq.instruction}\n${mcq.stem}`) },
    };
    assert.equal(draw({ assessmentTypes: ["multiple_choice"], k: 1 }).length, 1, "control: drawn without the clash");
    assert.deepEqual(draw({ assessmentTypes: ["multiple_choice"], k: 1, accepted: [model] }), []);
  });

  it("a partly seen lesson: unseen items first, then repeats, never twice and never a clash", () => {
    for (const lesson of [DERIVATIVES, SYSTEMS]) {
      const o = [objective("o1", lesson)];
      const items = bookItemsForLesson(lesson).filter(i => i.kind === "exercise");
      const free = (seed: number, avoidIds?: ReadonlySet<string>, k = 40) =>
        drawBookQuestions({
          objectives: o, assessmentTypes: ["short_answer"], difficulty: "standard",
          k, accepted: [], avoidIds, rng: lcg(seed),
        });
      for (let seed = 1; seed <= 20; seed += 1) {
        // See half the lesson, then ask for more than the unseen half can supply.
        const seen = new Set(items.slice(0, Math.ceil(items.length / 2)).map(i => i.id));
        const unseenDrawable = free(seed, new Set(items.slice(0, Math.ceil(items.length / 2)).map(i => i.id)), 1000)
          .filter(q => !seen.has(String(q.aiMetadata["bookItemId"])));
        const k = unseenDrawable.length + 2;
        const out = free(seed, seen, k);
        const ids = out.map(q => String(q.aiMetadata["bookItemId"]));
        assert.equal(out.length, k, `${lesson} seed ${seed}: short of ${k}`);
        assert.equal(new Set(ids).size, ids.length, `${lesson} seed ${seed}: an item came twice: ${ids}`);
        // Unseen items lead; only then do repeats follow.
        const firstSeen = ids.findIndex(id => seen.has(id));
        assert.ok(firstSeen === -1 || ids.slice(0, firstSeen).every(id => !seen.has(id)));
        assert.ok(ids.slice(0, unseenDrawable.length).every(id => !seen.has(id)), `${lesson} seed ${seed}: a repeat came before the unseen ones ran out`);
        // The repeats are not near-duplicates of what came before them either.
        for (let i = 0; i < out.length; i += 1) {
          for (let j = 0; j < i; j += 1) {
            assert.ok(
              stemSimilarity(promptOf(out[i]!), promptOf(out[j]!)) <= DUPLICATE_THRESHOLD,
              `${lesson} seed ${seed}: ${ids[i]} clashes with ${ids[j]}`,
            );
          }
        }
      }
    }
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

describe("planBook", () => {
  const FIXTURES: Array<[string, Parameters<typeof planBook>[0]]> = [];
  for (const lesson of LESSONS_WITH_ITEMS) {
    for (const types of [[...BOTH], ["short_answer"], ["multiple_choice"]] as QuestionType[][]) {
      for (const count of [1, 4, 7, 10, 40]) {
        FIXTURES.push([
          `${lesson} [${types.join("+")}] x${count}`,
          { objectives: [objective("o1", lesson)], assessmentTypes: types, count, subjectId: "mathematics", enabled: true },
        ]);
      }
    }
  }
  FIXTURES.push(
    ["flag off", { objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], count: 10, subjectId: "mathematics", enabled: false }],
    ["chemistry", { objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], count: 10, subjectId: "chemistry", enabled: true }],
    ["advanced", { objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], count: 10, subjectId: "mathematics", enabled: true, difficulty: "advanced" }],
  );

  it("k is exactly what planBookDraw returns, for every fixture", () => {
    for (const [name, req] of FIXTURES) assert.equal(planBook(req).k, planBookDraw(req), name);
  });

  it("the quota the route builds sums to the model's share (count - k) for every fixture, and its top-up rescale to what is missing", () => {
    let checked = 0;
    for (const [name, req] of FIXTURES) {
      const { k, supplied } = planBook(req);
      if (k === 0) continue;
      const newByCompetency = allocateQuestions(req.count, req.difficulty ?? "standard", supplied.byCompetency);
      const modelCount = req.count - k;
      assert.equal(COMPETENCY_KEYS.reduce((s, c) => s + newByCompetency[c], 0), modelCount, name);
      // A reply that wrote half of its share: the top-up quota sums to what is left.
      const half = Math.floor(modelCount / 2);
      const written = COMPETENCY_KEYS.flatMap(c => Array.from({ length: newByCompetency[c] }, () => ({ competencyKey: c }))).slice(0, half);
      const rest = remainingQuota(newByCompetency, written, modelCount - half);
      assert.equal(COMPETENCY_KEYS.reduce((s, c) => s + rest[c], 0), modelCount - half, name);
      checked += 1;
    }
    assert.ok(checked > 10, "the fixtures must exercise real plans");
  });

  it("supplied is the summary of a draw of k with the plan's own seed", () => {
    let nonEmpty = 0;
    for (const [name, req] of FIXTURES) {
      const { k, supplied } = planBook(req);
      const drawn = drawBookQuestions({
        objectives: req.objectives, assessmentTypes: req.assessmentTypes,
        difficulty: req.difficulty ?? "standard", k, accepted: [], rng: mulberry32(1),
      });
      assert.equal(drawn.length, k, name);
      const byType: Record<string, number> = {};
      const byCompetency: Record<string, number> = {};
      let marks = 0;
      for (const q of drawn) {
        byType[q.type] = (byType[q.type] ?? 0) + 1;
        byCompetency[q.competencyKey] = (byCompetency[q.competencyKey] ?? 0) + 1;
        marks += q.marks;
      }
      assert.deepEqual(supplied, { byType, byCompetency, marks }, name);
      if (k > 0) nonEmpty += 1;
    }
    assert.ok(nonEmpty > 10, "the fixtures must exercise real draws");
  });

  it("with every lesson that has items in one list, supplied is the summary of the SAME dry draw (PLAN_SEED, same avoidIds) as k", () => {
    // One lesson gives a pool so small that another seed draws the same items, so
    // a summary built from a second dry draw would go unnoticed. All lessons
    // together, over several type sets, counts and difficulties, make the draw
    // depend on the seed (a different seed changes the type mix, hence the summary).
    // Each list is also replayed as a regeneration: with the items the teacher was
    // shown in `avoidIds`, the dry run and its replay must agree on THAT draw.
    const lists = {
      "all lessons": LESSONS_WITH_ITEMS,
      "all lessons, reversed": [...LESSONS_WITH_ITEMS].reverse(),
      "all lessons twice": [...LESSONS_WITH_ITEMS, ...LESSONS_WITH_ITEMS],
    };
    const everyItem = LESSONS_WITH_ITEMS.flatMap(l => bookItemsForLesson(l));
    const avoidSets: Array<[string, ReadonlySet<string> | undefined]> = [
      ["first draw", undefined],
      ["mcq shown", new Set(everyItem.filter(i => i.kind === "unit-test-mcq").map(i => i.id))],
      ["every other item shown", new Set(everyItem.filter((_, i) => i % 2 === 0).map(i => i.id))],
      ["everything shown", new Set(everyItem.map(i => i.id))],
    ];
    let compared = 0;
    for (const [listName, lessons] of Object.entries(lists)) {
      const objectives = lessons.map((lesson, i) => objective(`o${i + 1}`, lesson));
      for (const [avoidName, avoidIds] of avoidSets) {
        for (const types of [[...BOTH], ["short_answer"], ["multiple_choice"]] as QuestionType[][]) {
          for (let count = 2; count <= 40; count += 1) {
            for (const difficulty of ["basic", "standard", "advanced"] as const) {
              const where = `${listName} (${avoidName}) ${types.join("+")} x${count} ${difficulty}`;
              const req = {
                objectives, assessmentTypes: types, count, subjectId: "mathematics", enabled: true, difficulty,
                ...(avoidIds ? { avoidIds } : {}),
              };
              const { k, supplied } = planBook(req);
              const replayed = drawBookQuestions({
                objectives, assessmentTypes: types, difficulty, k, accepted: [], rng: mulberry32(PLAN_SEED),
                ...(avoidIds ? { avoidIds } : {}),
              });
              assert.equal(replayed.length, k, where);
              assert.deepEqual(supplied, summariseBook(replayed), where);
              if (k > 0) compared += 1;
            }
          }
        }
      }
    }
    assert.ok(compared >= 1200, "the fixtures must exercise real draws");
  });

  it("on a regeneration the dry run avoids what the teacher was shown, and supplied is the summary of THAT draw", () => {
    // u1_l1 has ONE multiple-choice item. A first draw may use it; once it has been
    // shown, the real draw swaps it for an exercise, so a plan that ignored
    // `avoidIds` told the model "understanding 1" for a paper that has none.
    const mcId = bookItemsForLesson(SYSTEMS).filter(i => i.kind === "unit-test-mcq").map(i => i.id);
    assert.equal(mcId.length, 1, "the fixture relies on a lesson with a single multiple-choice item");
    const avoidIds = new Set(mcId);
    // With the derivatives lesson beside it the pool has enough exercises to take
    // its place (alone, u1_l1 has only four, so the item would come back as a repeat).
    const objectives = [objective("o1", SYSTEMS), objective("o2", DERIVATIVES)];
    const base = { objectives, assessmentTypes: [...BOTH], count: 10, subjectId: "mathematics", enabled: true };
    // Without avoidIds the plan does include the multiple-choice item (else this proves nothing).
    assert.deepEqual(planBook(base).supplied.byCompetency, { understanding: 1, application: 4 }, "first plan carries the MC item");

    const planned = planBook({ ...base, avoidIds });
    assert.ok(planned.k > 0);
    assert.equal(planned.supplied.byType.multiple_choice, undefined);
    assert.deepEqual(planned.supplied.byCompetency, { application: 5 });
    // The same draw the dry run made, replayed with the same avoidIds.
    const replayed = drawBookQuestions({
      objectives, assessmentTypes: [...BOTH], difficulty: "standard", k: planned.k, accepted: [],
      avoidIds, rng: mulberry32(PLAN_SEED),
    });
    assert.deepEqual(planned.supplied, summariseBook(replayed));
    // And the route's real draw (any seed, avoidIds the same) lands on that summary.
    for (let seed = 1; seed <= 25; seed += 1) {
      const real = drawBookQuestions({
        objectives, assessmentTypes: [...BOTH], difficulty: "standard", k: planned.k, accepted: [],
        avoidIds, rng: lcg(seed),
      });
      assert.deepEqual(summariseBook(real), planned.supplied, `seed ${seed}`);
    }
  });

  it("avoidIds that cover the whole pool fall back to repeats, as the real draw does", () => {
    const objectives = [objective("o1", SYSTEMS)];
    const avoidIds = new Set(bookItemsForLesson(SYSTEMS).map(i => i.id));
    const req = { objectives, assessmentTypes: [...BOTH], count: 10, subjectId: "mathematics", enabled: true, avoidIds };
    const planned = planBook(req);
    assert.ok(planned.k > 0, "a spent pool still plans repeats rather than nothing");
    const replayed = drawBookQuestions({
      objectives, assessmentTypes: [...BOTH], difficulty: "standard", k: planned.k, accepted: [],
      avoidIds, rng: mulberry32(PLAN_SEED),
    });
    assert.equal(replayed.length, planned.k);
    assert.deepEqual(planned.supplied, summariseBook(replayed));
  });

  it("returns results that are not aliased: changing one k = 0 result leaves the next one empty", () => {
    const req = { objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], count: 10, subjectId: "mathematics", enabled: false };
    const first = planBook(req);
    assert.equal(first.k, 0);
    first.supplied.byType.short_answer = 9;
    first.supplied.byCompetency.application = 9;
    first.supplied.marks = 9;
    const second = planBook(req);
    assert.deepEqual(second.supplied, { byType: {}, byCompetency: {}, marks: 0 });
    // Every route to "none" hands out its own object, not just the flag-off one.
    const chem = planBook({ ...req, enabled: true, subjectId: "chemistry" });
    chem.supplied.byType.multiple_choice = 1;
    assert.deepEqual(planBook({ ...req, enabled: true, subjectId: "chemistry" }).supplied.byType, {});
  });

  it("a plan of nothing has an empty summary", () => {
    const none = planBook({ objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], count: 10, subjectId: "mathematics", enabled: false });
    assert.deepEqual(none, { k: 0, supplied: { byType: {}, byCompetency: {}, marks: 0 } });
    assert.equal(planBook({ objectives: [objective("o1", SYSTEMS)], assessmentTypes: [...BOTH], count: 1, subjectId: "mathematics", enabled: true }).k, 0);
  });
});

describe("summariseBook", () => {
  const q = (type: QuestionType, competencyKey: GeneratedQuestion["competencyKey"], marks: number): GeneratedQuestion => ({
    ...modelQuestion(1, "o1"), type, competencyKey, marks,
  });

  it("counts type and competency and adds up marks", () => {
    const s = summariseBook([
      q("short_answer", "application", 3),
      q("short_answer", "application", 3),
      q("multiple_choice", "understanding", 2),
    ]);
    assert.deepEqual(s, {
      byType: { short_answer: 2, multiple_choice: 1 },
      byCompetency: { application: 2, understanding: 1 },
      marks: 8,
    });
  });

  it("lists only the types and competencies that are present", () => {
    const s = summariseBook([q("multiple_choice", "understanding", 2)]);
    assert.deepEqual(Object.keys(s.byType), ["multiple_choice"]);
    assert.deepEqual(Object.keys(s.byCompetency), ["understanding"]);
  });

  it("is empty for no questions", () => {
    assert.deepEqual(summariseBook([]), { byType: {}, byCompetency: {}, marks: 0 });
  });
});

describe("bookItemsRecord", () => {
  const quota = { knowledge: 2, understanding: 0, application: 1, critical_thinking: 2 };
  const supplied = { byType: { short_answer: 5 }, byCompetency: { application: 5 }, marks: 15 };

  it("stores the quota that was sent, beside the supplied summary", () => {
    const rec = bookItemsRecord({ enabled: true, planned: 5, supplied, quota, drawn: 5, ids: ["a", "b"] });
    assert.deepEqual(rec, { enabled: true, planned: 5, supplied, quota, drawn: 5, ids: ["a", "b"] });
    assert.notEqual(rec["quota"], quota, "a copy, not the caller's object");
  });

  it("has no quota when nothing was planned", () => {
    const empty = { byType: {}, byCompetency: {}, marks: 0 };
    assert.equal("quota" in bookItemsRecord({ enabled: false, planned: 0, supplied: empty, drawn: 0, ids: [] }), false);
    assert.equal("quota" in bookItemsRecord({ enabled: true, planned: 0, supplied: empty, quota, drawn: 0, ids: [] }), false);
  });
});

describe("the unit-test short-answer kind on the live path", () => {
  const lesson = "kbl-synthetic-lesson";
  const unitTestOpen = (id: string, number: number, stem: string): BookItem => ({
    id,
    lessonId: lesson,
    source: { sourceId: "math-s1-teacher-guide", page: 47, bookPage: 47, unit: 1, number },
    kind: "unit-test",
    instruction: "أحل نظام المعادلتين الآتي",
    stem,
    printedAnswer: "(1, 2)",
    computedAnswer: "(1, 2)",
    check: null,
    tier: "medium",
    tierSource: "default",
    status: "verified",
    verificationSource: "sympy+book",
  });
  // Different enough that the validator's similarity does not see them as twins.
  const POOL = [
    unitTestOpen("syn-a", 6, "y = 4x\ny = 5 - x^2"),
    unitTestOpen("syn-b", 7, "y - x = 15\nx^2 + y^2 = 64"),
    unitTestOpen("syn-c", 9, "y = -x^2 - x + 12\ny = x^2 + 7x + 12"),
  ];
  const itemsFor = (id: string): readonly BookItem[] => (id === lesson ? POOL : []);

  it("is application, three marks", () => {
    assert.deepEqual(liveSlot("unit-test"), { competency: "application", marks: MARKS_BY_COMPETENCY.application });
    assert.equal(liveSlot("unit-test").marks, 3);
    // The other kinds are unchanged.
    assert.equal(liveSlot("exercise").competency, "application");
    assert.equal(liveSlot("unit-test-mcq").competency, "understanding");
  });

  it("counts toward the plan for a short-answer-only request, and not for a choice-only one", () => {
    const base = { objectives: [objective("o1", lesson)], count: 100, subjectId: "mathematics", enabled: true, itemsFor };
    const short = planBook({ ...base, assessmentTypes: ["short_answer"] });
    assert.ok(short.k > 0, "a unit-test item must make a short-answer request plan something");
    assert.equal(short.supplied.byType.short_answer, short.k);
    assert.equal(short.supplied.byCompetency.application, short.k);
    assert.equal(short.supplied.marks, short.k * 3);
    assert.equal(planBook({ ...base, assessmentTypes: ["multiple_choice"] }).k, 0);
  });

  it("is capped by the eligible count and by half the paper", () => {
    const base = { objectives: [objective("o1", lesson)], assessmentTypes: ["short_answer"] as QuestionType[], subjectId: "mathematics", enabled: true, itemsFor };
    // Never more than is eligible; it may be fewer, because the plan is what the
    // dry run can DELIVER and short stems can read as near-duplicates.
    const all = planBook({ ...base, count: 100 }).k;
    assert.ok(all > 0 && all <= POOL.length, `planned ${all} of ${POOL.length}`);
    assert.equal(planBook({ ...base, count: 4 }).k, 2);
  });

  it("is drawn with its citation and no check", () => {
    const drawnQs = drawBookQuestions({
      objectives: [objective("o1", lesson)],
      assessmentTypes: ["short_answer"],
      difficulty: "standard",
      k: 2,
      accepted: [],
      rng: lcg(3),
      itemsFor,
    });
    assert.equal(drawnQs.length, 2);
    for (const q of drawnQs) {
      assert.equal(q.type, "short_answer");
      assert.equal(q.check, null);
      assert.equal(q.competencyKey, "application");
      assert.equal(q.marks, 3);
      assert.match(String(q.aiMetadata["bookCitationAr"]), /^اختبار نهاية الوحدة ١، س /u);
    }
  });
});
