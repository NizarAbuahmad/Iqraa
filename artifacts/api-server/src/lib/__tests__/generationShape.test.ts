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
  missingFields,
  normalizeQuiz,
  REQUIRED_FIELDS,
  UnusableGenerationError,
} from "../generationShape.ts";

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
