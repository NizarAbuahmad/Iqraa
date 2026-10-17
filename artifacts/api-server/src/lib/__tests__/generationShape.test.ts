/**
 * The gate between "valid JSON" and "an artifact the app can render".
 *
 * What these guard: `/generate/*` used to answer 200 with whatever
 * `extractJSON` recovered. A truncated response yields a partial object or
 * `{}`, and the screen drew a blank lesson plan with no error anywhere — not
 * in the logs, not in the UI, and not in the provenance badge, which said
 * «ذكاء اصطناعي مباشر» because the call had genuinely succeeded.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assertUsableGeneration,
  extractJSON,
  deckShortfalls,
  mergeQuizTopUp,
  mergeWorksheetTopUp,
  missingFields,
  normalizeQuiz,
  quizShortfall,
  quizStems,
  quizWanted,
  REQUIRED_FIELDS,
  trimWorksheet,
  UnusableGenerationError,
  worksheetQuestionCount,
  worksheetShortfall,
  worksheetStems,
} from "../generationShape.ts";


const wq = (text: string) => ({ text, points: 1 });
/** A worksheet of `n` questions split over two sections, with its answer key. */
const sheet = (n: number, extra: Record<string, unknown> = {}) => ({
  title: "t",
  instructions: "i",
  sections: [
    { type: "short_answer", title: "A", questions: Array.from({ length: Math.ceil(n / 2) }, (_, i) => wq(`a${i}`)) },
    { type: "short_answer", title: "B", questions: Array.from({ length: Math.floor(n / 2) }, (_, i) => wq(`b${i}`)) },
  ],
  answerKey: Array.from({ length: n }, (_, i) => ({ num: i + 1, answer: `k${i}` })),
  ...extra,
});
const example = { problem: "p", steps: ["1", "2", "3"], answer: "a" };

describe("a worksheet or homework holds the number of questions that was asked for", () => {
  it("counts questions across every section", () => {
    assert.equal(worksheetQuestionCount(sheet(7)), 7);
    assert.equal(worksheetQuestionCount({}), 0);
    assert.equal(worksheetQuestionCount({ sections: [null, { questions: "x" }, { questions: [wq("a")] }] }), 1);
  });

  it("owes nothing for a complete homework, and the difference for a short one", () => {
    assert.equal(worksheetShortfall(sheet(20), { numQuestions: 20 }), 0);
    assert.equal(worksheetShortfall(sheet(10), { numQuestions: 20 }), 10);
    assert.equal(worksheetShortfall(sheet(10), {}), 0);
  });

  it("counts the worked example INSIDE the number picked", () => {
    // 10 asked, an example, and 9 in the sections: complete.
    assert.equal(worksheetShortfall(sheet(9, { workedExample: example }), { numQuestions: 10 }), 0);
    assert.equal(worksheetShortfall(sheet(7, { workedExample: example }), { numQuestions: 10 }), 2);
    // No example (a lesson with no procedure to model): all ten are questions.
    assert.equal(worksheetShortfall(sheet(9), { numQuestions: 10 }), 1);
  });

  it("expects at least the review's lower bound on top when a review was asked for", () => {
    const body = { numQuestions: 10, includePriorReview: true, priorKnowledge: ["x"] };
    assert.equal(worksheetShortfall(sheet(12), body), 0);
    assert.equal(worksheetShortfall(sheet(13), body), 0);
    assert.equal(worksheetShortfall(sheet(10), body), 2);
    // A review requested with nothing to review adds nothing to expect.
    assert.equal(worksheetShortfall(sheet(10), { numQuestions: 10, includePriorReview: true, priorKnowledge: [] }), 0);
  });

  it("lists the stems already written, whitespace collapsed", () => {
    const s = { sections: [{ questions: [wq("ما   هو\n الناتج؟"), wq("")] }, { questions: [wq("ثانيًا")] }] };
    assert.deepEqual(worksheetStems(s), ["ما هو الناتج؟", "ثانيًا"]);
  });

  it("merges a top-up in as new sections, numbering its answers straight on", () => {
    const base = sheet(4, { workedExample: example });
    const extra = {
      title: "x",
      sections: [{ type: "short_answer", title: "Additional practice", questions: [wq("c0"), wq("c1")] }],
      answerKey: [{ num: 1, answer: "n1", solution: ["s"] }, { num: 2, answer: "n2" }],
    };
    mergeWorksheetTopUp(base, extra);
    assert.equal(worksheetQuestionCount(base), 6);
    assert.equal((base.sections as unknown[]).length, 3);
    assert.deepEqual((base.answerKey as { num: number }[]).map(k => k.num), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual((base.answerKey as { answer: string }[]).slice(4).map(k => k.answer), ["n1", "n2"]);
    assert.ok((base as Record<string, unknown>).workedExample, "the first reply's worked example is kept");
    assert.equal(base.title, "t");
  });

  it("a top-up with no answer key still adds its questions", () => {
    const base = sheet(2);
    mergeWorksheetTopUp(base, { sections: [{ questions: [wq("z")] }] });
    assert.equal(worksheetQuestionCount(base), 3);
    assert.equal((base.answerKey as unknown[]).length, 2);
  });

  it("trims a long paper from the end, with its key, never below the count", () => {
    const s = sheet(14);
    const removed = trimWorksheet(s, { numQuestions: 10 });
    assert.equal(removed, 4);
    assert.equal(worksheetQuestionCount(s), 10);
    assert.equal((s.answerKey as unknown[]).length, 10);
    // The first questions survive.
    assert.equal(((s.sections as { questions: { text: string }[] }[])[0]!.questions[0]!.text), "a0");
  });

  it("drops a section that trimming empties", () => {
    const s = { sections: [{ questions: [wq("a"), wq("b")] }, { questions: [wq("c")] }], answerKey: [{ num: 1 }, { num: 2 }, { num: 3 }] };
    trimWorksheet(s, { numQuestions: 2 });
    assert.equal((s.sections as unknown[]).length, 1);
    assert.equal((s.answerKey as unknown[]).length, 2);
  });

  it("leaves a review the teacher asked for alone: up to three over the count is not surplus", () => {
    const body = { numQuestions: 10, includePriorReview: true, priorKnowledge: ["x"] };
    const s = sheet(13);
    assert.equal(trimWorksheet(s, body), 0);
    assert.equal(worksheetQuestionCount(s), 13);
    assert.equal(trimWorksheet(sheet(16), body), 3);
  });

  it("does not trim anything when the request named no count, or a paper is the right length or short", () => {
    assert.equal(trimWorksheet(sheet(14), {}), 0);
    assert.equal(trimWorksheet(sheet(10), { numQuestions: 10 }), 0);
    assert.equal(trimWorksheet(sheet(4), { numQuestions: 10 }), 0);
  });
});

const mcq = (id: string, text: string) => ({ id, type: "multiple_choice", text, options: ["a", "b", "c"], correctAnswer: "a", points: 1 });
const tf = (id: string, text: string) => ({ id, type: "true_false", text, options: ["صح", "خطأ"], correctAnswer: "صح", points: 1 });
const sa = (id: string, text: string) => ({ id, type: "short_answer", text, correctAnswer: "x", points: 1 });

describe("a quiz holds the number of questions that was asked for", () => {
  it("trims a long paper from the biggest block, so no type disappears", () => {
    const q = {
      title: "t",
      questions: [
        ...Array.from({ length: 6 }, (_, i) => mcq(`m${i}`, `m${i}`)),
        ...Array.from({ length: 3 }, (_, i) => tf(`t${i}`, `t${i}`)),
        sa("s0", "s0"),
      ],
    };
    const notes = normalizeQuiz(q, ["multiple_choice", "true_false", "short_answer"], 6);
    assert.equal(q.questions.length, 6);
    const types = new Set(q.questions.map(x => x.type));
    assert.ok(types.has("multiple_choice") && types.has("true_false") && types.has("short_answer"));
    assert.ok(notes.some(n => /trimmed 4/.test(n)));
    // Cut from the end of the biggest block: the first questions survive.
    assert.equal(q.questions[0]!.id, "m0");
  });

  it("leaves a paper of exactly the right length, or shorter, alone", () => {
    const q = { title: "t", questions: [mcq("a", "a"), mcq("b", "b")] };
    assert.deepEqual(normalizeQuiz(q, ["multiple_choice"], 2), []);
    assert.deepEqual(normalizeQuiz(q, ["multiple_choice"], 10), []);
    assert.equal(q.questions.length, 2);
  });

  it("reads the asked-for count from the request, and nothing it should not", () => {
    assert.equal(quizWanted({ numQuestions: 20 }), 20);
    assert.equal(quizWanted({ numQuestions: "15" }), 15);
    assert.equal(quizWanted({ numQuestions: 0 }), null);
    assert.equal(quizWanted({ numQuestions: 400 }), null);
    assert.equal(quizWanted({ numQuestions: 2.5 }), null);
    assert.equal(quizWanted({}), null);
    assert.equal(quizWanted(undefined), null);
  });

  it("knows how many a short reply still owes", () => {
    const q = { title: "t", questions: Array.from({ length: 10 }, (_, i) => mcq(`q${i}`, `q${i}`)) };
    assert.equal(quizShortfall(q, { numQuestions: 20 }), 10);
    assert.equal(quizShortfall(q, { numQuestions: 10 }), 0);
    assert.equal(quizShortfall(q, { numQuestions: 5 }), 0);
    assert.equal(quizShortfall(q, {}), 0);
    assert.equal(quizShortfall({}, { numQuestions: 5 }), 5);
  });

  it("lists the stems already written, whitespace collapsed", () => {
    const q = { title: "t", questions: [mcq("a", "ما   هو\n الناتج؟"), mcq("b", "")] };
    assert.deepEqual(quizStems(q), ["ما هو الناتج؟"]);
  });

  it("merges a top-up in, renumbering straight on and keeping the first reply's title", () => {
    const base = { title: "الأصل", questions: [mcq("q1", "a"), tf("q2", "b")] };
    const extra = { title: "ثانٍ", questions: [mcq("q1", "c"), sa("q2", "d")] };
    mergeQuizTopUp(base, extra);
    assert.equal(base.title, "الأصل");
    assert.deepEqual(base.questions.map(x => x.id), ["q1", "q2", "q3", "q4"]);
    assert.deepEqual(base.questions.map(x => x.text), ["a", "b", "c", "d"]);
  });

  it("a merged and re-normalised top-up is a grouped, right-length paper", () => {
    const base = { title: "t", questions: [mcq("q1", "a"), tf("q2", "b"), sa("q3", "c")] };
    const extra = { title: "t", questions: [mcq("q1", "d"), tf("q2", "e"), sa("q3", "f")] };
    mergeQuizTopUp(base, extra);
    normalizeQuiz(base, ["multiple_choice", "true_false", "short_answer"], 6);
    assert.deepEqual(base.questions.map(x => x.type), [
      "multiple_choice", "multiple_choice", "true_false", "true_false", "short_answer", "short_answer",
    ]);
  });

  it("assertUsableGeneration trims to the request's own count", () => {
    const q = { title: "t", questions: Array.from({ length: 12 }, (_, i) => mcq(`q${i}`, `q${i}`)) };
    assertUsableGeneration("quiz", q, { numQuestions: 8, questionTypes: ["multiple_choice"] });
    assert.equal(q.questions.length, 8);
  });
});

/** A quiz in the model's own order, with the shapes it actually returns. */
const quiz = () => ({
  title: "اختبار",
  questions: [
    { id: "q1", type: "short_answer", text: "علّل", correctAnswer: "لأن", points: 4 },
    { id: "q2", type: "True/False", text: "الماء مركّب.", correctAnswer: "صحيح", points: 2 },
    { id: "q3", type: "multiple_choice", text: "أيّ؟", options: ["أ", "ب", "ج", "د"], correctAnswer: "ب", points: 2 },
    { id: "q4", type: "true_false", text: "Water is an element.", options: ["True", "False"], correctAnswer: "F", points: 2 },
  ],
});

describe("normalizeQuiz", () => {
  it("groups the questions in ministry order without reordering within a type", () => {
    const q = quiz();
    const notes = normalizeQuiz(q, ["multiple_choice", "true_false", "short_answer"]);
    assert.deepEqual(q.questions.map(x => x.id), ["q3", "q2", "q4", "q1"]);
    assert.ok(notes.some(n => /reordered/.test(n)));
  });

  it("drops the types the teacher did not tick, and says so", () => {
    const q = quiz();
    const notes = normalizeQuiz(q, ["true_false"]);
    assert.deepEqual(q.questions.map(x => x.id), ["q2", "q4"]);
    assert.ok(notes.some(n => /dropped 2/.test(n)));
  });

  it("gives every true/false item the pair the app renders, in the paper's language", () => {
    const q = quiz();
    normalizeQuiz(q, ["true_false"]);
    const [ar, en] = q.questions as Record<string, unknown>[];
    assert.equal(ar!.type, "true_false");
    assert.deepEqual(ar!.options, ["صح", "خطأ"]);
    assert.equal(ar!.correctAnswer, "صح");
    assert.deepEqual(en!.options, ["True", "False"]);
    assert.equal(en!.correctAnswer, "False");
  });

  it("reads a missing or unknown type label from the question's shape", () => {
    const q = {
      questions: [
        { text: "أيّ؟", options: ["أ", "ب", "ج"], correctAnswer: "أ", points: 1 },
        { text: "اذكر", correctAnswer: "…", points: 1 },
        { type: "matching", text: "صل", correctAnswer: "…", points: 1 },
      ],
    };
    const notes = normalizeQuiz(q, ["multiple_choice", "short_answer"]);
    assert.deepEqual(q.questions.map(x => x.type), ["multiple_choice", "short_answer"]);
    assert.ok(notes.some(n => /dropped 1/.test(n)));
  });

  it("allows every type when the request named none", () => {
    const q = quiz();
    normalizeQuiz(q, undefined);
    assert.equal(q.questions.length, 4);
  });

  it("refuses a paper with nothing of the requested type rather than serving it", () => {
    assert.throws(() => normalizeQuiz(quiz(), ["fill_blank"]), UnusableGenerationError);
  });

  it("runs from assertUsableGeneration for a quiz, with the request body", () => {
    const q = quiz();
    assertUsableGeneration("quiz", q, { questionTypes: ["multiple_choice"] });
    assert.deepEqual(q.questions.map(x => x.id), ["q3"]);
    assert.deepEqual(assertUsableGeneration("lesson-plan", lessonPlan()), []);
  });
});

/** A deck that clears the structural floor, for mutating in the cases below. */
const deck = (slides: unknown[]) => ({ activityName: "عرض", slides });
const slide = (over: Record<string, unknown> = {}) => ({
  slideNumber: 1, type: "intro", title: "عنوان", content: "• سطر\n• سطر آخر",
  teacher: { teachingTips: "نصيحة" }, ...over,
});
const fiveSlides = () => [slide(), slide(), slide(), slide(), slide()];

const lessonPlan = () => ({
  title: "خطة درس",
  objectives: ["هدف"],
  materials: ["الكتاب"],
  introduction: "تمهيد",
  mainActivity: "نشاط",
  guidedPractice: "تدريب موجه",
  independentPractice: "تدريب مستقل",
  closure: "ختام",
  assessment: "تقييم",
  differentiation: "تمايز",
  homework: "واجب",
});

describe("missingFields", () => {
  it("passes a complete artifact", () => {
    assert.deepEqual(missingFields("lesson-plan", lessonPlan()), []);
  });

  it("reports everything for the truncation signatures", () => {
    // These are what extractJSON actually recovers from a cut-off response.
    for (const bad of [{}, null, undefined, [], "خطة درس", 42]) {
      assert.deepEqual(
        missingFields("lesson-plan", bad),
        [...REQUIRED_FIELDS["lesson-plan"]],
        `${JSON.stringify(bad)} should be entirely missing`,
      );
    }
  });

  it("treats an empty string or empty array as absent, not present", () => {
    // A key that exists with a whitespace value is the truncation signature,
    // not a value — `"closure": ""` renders as an empty section either way.
    assert.deepEqual(missingFields("lesson-plan", { ...lessonPlan(), closure: "   " }), ["closure"]);
    assert.deepEqual(missingFields("lesson-plan", { ...lessonPlan(), objectives: [] }), ["objectives"]);
  });

  it("names every missing field, not just the first", () => {
    const partial = { title: "خطة درس", objectives: ["هدف"] };
    const missing = missingFields("lesson-plan", partial);
    assert.equal(missing.length, REQUIRED_FIELDS["lesson-plan"].length - 2);
    assert.ok(missing.includes("closure"));
    assert.ok(!missing.includes("title"));
  });

  it("does not require priorReview — most plans never asked for one", () => {
    // priorReview only appears when the teacher asked for a warm-up review of
    // prior material (see prompts.ts). Requiring it here would 502 every
    // ordinary plan the moment the model — correctly — leaves it out.
    assert.ok(!REQUIRED_FIELDS["lesson-plan"].includes("priorReview"));
    assert.deepEqual(missingFields("lesson-plan", lessonPlan()), []);
    assert.deepEqual(
      missingFields("lesson-plan", { ...lessonPlan(), priorReview: "مراجعة قصيرة" }),
      [],
    );
  });

  it("does not require cosmetic echoes of the request", () => {
    // A quiz missing `duration` is still a quiz. Discarding it would turn a
    // usable artifact into mock content, which is the opposite of the point.
    const quiz = { title: "اختبار", questions: [{ id: "q1", text: "س" }] };
    assert.deepEqual(missingFields("quiz", quiz), []);
  });

  it("holds homework to the worksheet contract it is rendered by", () => {
    assert.deepEqual(REQUIRED_FIELDS.homework, REQUIRED_FIELDS.worksheet);
  });
});

describe("assertUsableGeneration", () => {
  it("does not throw for a complete artifact", () => {
    assert.doesNotThrow(() => assertUsableGeneration("lesson-plan", lessonPlan()));
  });

  it("throws and carries the field list", () => {
    try {
      assertUsableGeneration("worksheet", { title: "ورقة عمل" });
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof UnusableGenerationError);
      assert.equal(err.kind, "worksheet");
      assert.deepEqual(err.missing, ["instructions", "sections", "answerKey"]);
      // The message has to name the fields — a bare "generation failed" is
      // how the original bug stayed invisible.
      assert.match(err.message, /instructions, sections, answerKey/);
    }
  });

  it("covers every kind the routes can pass", () => {
    // A route added without a field list would silently validate nothing.
    for (const kind of Object.keys(REQUIRED_FIELDS) as (keyof typeof REQUIRED_FIELDS)[]) {
      assert.ok(REQUIRED_FIELDS[kind].length > 0, `${kind} has no required fields`);
      assert.throws(() => assertUsableGeneration(kind, {}), UnusableGenerationError);
    }
  });
});

describe("prompt-slides — the structural floor", () => {
  it("accepts a deck that clears it", () => {
    assert.doesNotThrow(() => assertUsableGeneration("prompt-slides", deck(fiveSlides())));
  });

  it("refuses the deck that shipped as six blank cards", () => {
    // The exact artifact a teacher saw: valid JSON, required fields present,
    // rendering as near-empty slides behind a "live AI" badge.
    assert.throws(
      () => assertUsableGeneration("prompt-slides", deck([{ title: "x" }])),
      UnusableGenerationError,
    );
  });

  it("refuses a deck shorter than five slides", () => {
    assert.throws(
      () => assertUsableGeneration("prompt-slides", deck([slide(), slide()])),
      UnusableGenerationError,
    );
  });

  it("refuses a deck where any slide has an empty title or body", () => {
    for (const bad of [{ title: "" }, { content: "" }, { content: "   " }]) {
      const slides = fiveSlides();
      slides[2] = slide(bad);
      assert.throws(
        () => assertUsableGeneration("prompt-slides", deck(slides)),
        UnusableGenerationError,
        `${JSON.stringify(bad)} should be refused`,
      );
    }
  });

  it("names how many slides were blank, so the log says what was wrong", () => {
    try {
      assertUsableGeneration("prompt-slides", deck([...fiveSlides(), slide({ content: "" })]));
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(err instanceof UnusableGenerationError);
      assert.match(err.message, /1 of 6 slides/);
    }
  });

  it("leaves every other kind alone", () => {
    // Only prompt-slides gets the per-slide pass; a quiz of one question is
    // still a quiz.
    assert.doesNotThrow(() =>
      assertUsableGeneration("quiz", { title: "اختبار", questions: [{ id: "q1", text: "س" }] }));
  });
});

describe("deckShortfalls — reported, never refused", () => {
  it("says nothing about a deck that meets the bars", () => {
    const slides = [
      slide({ type: "divider" }), slide(), slide(),
      slide({ type: "question" }), slide({ type: "summary" }),
    ];
    assert.deepEqual(deckShortfalls(deck(slides)), []);
  });

  it("counts slides with no teacher notes", () => {
    const slides = fiveSlides();
    slides[0] = slide({ teacher: undefined });
    assert.ok(deckShortfalls(deck(slides)).some(s => /teacher notes/.test(s)));
  });

  it("flags a deck with nothing to answer and no section break", () => {
    const out = deckShortfalls(deck(fiveSlides()));
    assert.ok(out.some(s => /no question or worked-example/.test(s)));
    assert.ok(out.some(s => /no divider/.test(s)));
  });

  it("flags single-line slides, which render as near-empty", () => {
    const slides = fiveSlides();
    slides[1] = slide({ content: "one flat sentence" });
    assert.ok(deckShortfalls(deck(slides)).some(s => /single unbroken line/.test(s)));
  });

  it("does not count a statement slide, which is one line by design", () => {
    const slides = [
      slide({ type: "divider" }), slide({ layout: "statement", content: "Where did the tree's mass come from?" }),
      slide(), slide({ type: "question" }), slide({ type: "summary" }),
    ];
    assert.deepEqual(deckShortfalls(deck(slides)), []);
  });

  it("is silent on anything that is not a deck", () => {
    assert.deepEqual(deckShortfalls(null), []);
    assert.deepEqual(deckShortfalls({}), []);
  });
});

describe("infographic contract", () => {
  const infographic = () => ({
    title: "الاقترانات",
    keyFacts: [{ label: "المجال", value: "قيم x المسموح بها" }],
    sections: [{ heading: "التعريف", icon: "bulb-outline", points: ["نقطة"] }],
    takeaway: "كل مدخل له مخرج واحد",
  });

  it("accepts a complete infographic, with or without a subtitle", () => {
    assert.deepEqual(missingFields("infographic", infographic()), []);
  });

  it("rejects one with no sections — the card would be empty", () => {
    assert.deepEqual(missingFields("infographic", { ...infographic(), sections: [] }), ["sections"]);
    assert.throws(
      () => assertUsableGeneration("infographic", { ...infographic(), sections: [] }),
      UnusableGenerationError,
    );
  });
});

describe("extractJSON with LaTeX in the reply", () => {
  it("recovers a reply with a lone backslash instead of throwing", () => {
    // Production 2026-09-30: «Bad escaped character in JSON» on a maths lesson plan.
    const raw = String.raw`{"title":"حل \(x^2 = 4\)","note":"جذر \sqrt{9}"}`;
    assert.throws(() => JSON.parse(raw));
    assert.deepEqual(extractJSON(raw), { title: String.raw`حل \(x^2 = 4\)`, note: String.raw`جذر \sqrt{9}` });
  });

  it("leaves valid escapes alone, including an escaped backslash before a letter", () => {
    const raw = String.raw`{"a":"line\nbreak","b":"\\alpha","c":"\u0627","d":"q\"uote"}`;
    assert.equal(JSON.parse(raw).b, String.raw`\alpha`); // already valid: must come out unchanged
    assert.deepEqual(extractJSON(raw), { a: "line\nbreak", b: String.raw`\alpha`, c: "ا", d: 'q"uote' });
  });

  it("still fails on a reply that is not JSON at all", () => {
    assert.throws(() => extractJSON("sorry, I cannot help with that"));
  });
});

describe("LaTeX in a JSON reply", () => {
  const BS = String.fromCharCode(92); // one backslash
  const json = (body: string) => `{"a":"${body}"}`;

  // `\frac` is a legal JSON escape (form feed + "rac"), so it used to parse
  // cleanly into garbage that no later check could tell from real text.
  it("keeps a lone-backslash LaTeX command literal instead of a control character", () => {
    const body = ["frac{1}{2}", "theta", "times", "neq", "right)", "beta"].map(w => BS + w).join(" و ");
    const out = extractJSON(json(body)) as { a: string };
    assert.equal(out.a, body);
    assert.ok(!/[\f\t\b\r]/.test(out.a));
  });

  it("leaves a properly escaped backslash alone", () => {
    const out = extractJSON(json(BS + BS + "frac{1}{2}")) as { a: string };
    assert.equal(out.a, BS + "frac{1}{2}");
  });

  it("does not touch an ordinary newline or tab before a word", () => {
    const out = extractJSON(json(`سطر${BS}nتالٍ${BS}tوفاصل${BS}nequal line`)) as { a: string };
    assert.equal(out.a, "سطر\nتالٍ\tوفاصل\nequal line");
  });

  it("still repairs an illegal escape", () => {
    const body = `${BS}sqrt{x} and ${BS}(x^2${BS})`;
    const out = extractJSON(json(body)) as { a: string };
    assert.equal(out.a, body);
  });
});

describe("prompt-slides — laid-out slides keep their substance outside content", () => {
  // A stat or compare slide legitimately has an empty body, and refusing it
  // threw away a whole paid deck over its best slide. Found 2026-10-08.
  it("accepts a stat slide and a compare slide with no content", () => {
    const slides = [
      ...fiveSlides(),
      slide({ content: "", layout: "stat", stat: { value: "3", label: "قوانين" } }),
      slide({ content: "", layout: "compare", compare: { leftTitle: "أ", left: ["x"], rightTitle: "ب", right: ["y"] } }),
    ];
    assert.doesNotThrow(() => assertUsableGeneration("prompt-slides", deck(slides)));
  });

  it("still refuses a laid-out slide whose payload is empty too", () => {
    assert.throws(
      () => assertUsableGeneration("prompt-slides", deck([...fiveSlides(), slide({ content: "", layout: "stat", stat: { value: " ", label: "x" } })])),
      UnusableGenerationError,
    );
    assert.throws(
      () => assertUsableGeneration("prompt-slides", deck([...fiveSlides(), slide({ content: "", layout: "compare", compare: { leftTitle: "أ", left: [], rightTitle: "ب", right: ["y"] } })])),
      UnusableGenerationError,
    );
  });
});

describe("deckShortfalls — the cover is one line on purpose", () => {
  it("does not count the first slide as thin", () => {
    const slides = fiveSlides();
    slides[0] = slide({ content: "one line cover" });
    assert.ok(!deckShortfalls(deck(slides)).some(s => /single unbroken line/.test(s)));
  });
});

describe("a lesson tag survives normalisation, and the counts the wide scope offers are enforced", () => {
  const mc = (i: number, lesson: string) => ({ id: `q${i}`, type: "multiple_choice", text: `s${i}`, options: ["a", "b", "c", "d"], correctAnswer: "a", points: 1, explanation: "", lesson });

  it("normalizeQuiz keeps `lesson` on every question, including after it reorders", () => {
    const parsed = { questions: [
      { id: "q1", type: "short_answer", text: "w", correctAnswer: "x", points: 1, explanation: "", lesson: "L2" },
      mc(2, "L1"),
    ] };
    normalizeQuiz(parsed, ["multiple_choice", "short_answer"], 2);
    assert.deepEqual(parsed.questions.map(q => (q as { lesson?: string }).lesson), ["L1", "L2"]);
  });

  it("a worksheet's tags survive the top-up merge and the trim", () => {
    const base = { sections: [{ type: "short_answer", title: "a", questions: [{ text: "1", points: 1, lesson: "L1" }, { text: "2", points: 1, lesson: "L2" }] }], answerKey: [] };
    const extra = { sections: [{ type: "short_answer", title: "b", questions: [{ text: "3", points: 1, lesson: "L3" }] }], answerKey: [] };
    mergeWorksheetTopUp(base, extra);
    const tags = (base.sections as { questions: { lesson?: string }[] }[]).flatMap(s => s.questions.map(q => q.lesson));
    assert.deepEqual(tags, ["L1", "L2", "L3"]);
    const removed = trimWorksheet(base, { numQuestions: 2 });
    const left = (base.sections as { questions: { text: string; lesson?: string }[] }[]).flatMap(s => s.questions);
    assert.equal(removed, 1);
    assert.deepEqual(left.map(q => [q.text, q.lesson]), [["1", "L1"], ["2", "L2"]]);
  });

  it("25 and 30 are real counts; 31 is treated as 'did not say'", () => {
    assert.equal(quizWanted({ numQuestions: 25 }), 25);
    assert.equal(quizWanted({ numQuestions: 30 }), 30);
    assert.equal(quizWanted({ numQuestions: 31 }), null);
  });

  it("a 25-question quiz that came back with 20 owes 5; with 30 asked and 22 back, 8", () => {
    const q = (n: number) => ({ questions: Array.from({ length: n }, (_, i) => mc(i + 1, "L1")) });
    assert.equal(quizShortfall(q(20), { numQuestions: 25 }), 5);
    assert.equal(quizShortfall(q(22), { numQuestions: 30 }), 8);
    assert.equal(quizShortfall(q(30), { numQuestions: 30 }), 0);
  });

  it("a 30-question worksheet is held to its count", () => {
    const sheet = (n: number) => ({ sections: [{ type: "short_answer", title: "s", questions: Array.from({ length: n }, (_, i) => ({ text: `q${i}`, points: 1 })) }], answerKey: [] });
    assert.equal(worksheetShortfall(sheet(24), { numQuestions: 30 }), 6);
    assert.equal(worksheetShortfall(sheet(30), { numQuestions: 30 }), 0);
  });
});

describe("prompt-slides — the structure layouts keep their words in a payload", () => {
  const withBody = (over: Record<string, unknown>) => deck([...fiveSlides(), slide({ content: "", ...over })]);

  it("accepts a timeline, stats, table or flow slide whose body is only its payload", () => {
    for (const over of [
      { layout: "timeline", timeline: [{ label: "1", text: "a" }] },
      { layout: "stats", stats: [{ value: "1", label: "a" }] },
      { layout: "table", table: { headers: ["a", "b"], rows: [["1", "2"]] } },
      { layout: "flow", flow: { steps: ["a", "b", "c"] } },
      { layout: "quote", quote: { text: "a quotation" } },
    ]) {
      assert.doesNotThrow(() => assertUsableGeneration("prompt-slides", withBody(over)), JSON.stringify(over));
    }
  });

  it("still refuses a slide that names a layout and has neither a payload nor a sentence", () => {
    for (const over of [
      { layout: "timeline", timeline: [] },
      { layout: "stats" },
      { layout: "table", table: { headers: [], rows: [] } },
      { layout: "flow", flow: { steps: [] } },
      { layout: "quote", quote: { text: "  " } },
    ]) {
      assert.throws(() => assertUsableGeneration("prompt-slides", withBody(over)), UnusableGenerationError, JSON.stringify(over));
    }
  });
});
