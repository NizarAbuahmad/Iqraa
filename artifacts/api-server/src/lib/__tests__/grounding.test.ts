/**
 * Does the book actually reach the prompt, and does nothing else?
 *
 * Two things are being guarded, and only one of them is "grounding works".
 *
 * The other is the fallback. Retrieval is empty for most of the curriculum —
 * six of 78 documents have been read — so the ungrounded path is the common
 * path, and a bug there is invisible: the request still succeeds, the teacher
 * still gets a lesson plan, and nobody finds out that a topic was silently
 * matched to the wrong unit's pages. So the assertions below are as much about
 * what the body looks like when nothing is found as when something is.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getObjectivesForUnit } from "@workspace/curriculum";
import { groundingFor, groundingForObjectives, withGrounding } from "../grounding.ts";

/** الدائرة — extracted, and the unit with the most material on file. */
const CIRCLE = "kbu-math-s1-nccd-u2";
const CIRCLE_LESSON = "أوتار الدائرة وأقطارها ومماساتها";
/** Financial literacy is in the catalog and nothing has been read for it. */
const FINLIT = "kbu-finlit-s1-nccd-u1";

describe("groundingFor", () => {
  it("finds the book for a lesson that has one", () => {
    const g = groundingFor({ topic: CIRCLE_LESSON }, true);
    assert.ok(g, "no grounding for a lesson whose book is extracted");
    assert.equal(g.unitId, CIRCLE);
    assert.ok(g.sources.length > 0);
    assert.ok(g.block.length > 500, "the block is too short to be book text");
  });

  it("prefers an explicit unit id over the topic", () => {
    // The screen knows which lesson the teacher picked; a title match only
    // infers it. A topic naming a different subject must not win.
    const g = groundingFor({ unitId: "kbu-chem-s1-nccd-u1", topic: CIRCLE_LESSON }, true);
    assert.ok(g);
    assert.equal(g.unitId, "kbu-chem-s1-nccd-u1");
    assert.ok(g.sources.every(s => s.sourceId.startsWith("chem-")), "a maths book answered a chemistry unit");
  });

  it("ignores a unit id that is not one", () => {
    // The KB's legacy rows carry ids like `kbu-chem-1`. Falling back to the
    // topic is right; treating the string as a unit would find nothing and
    // silently ground nothing.
    const g = groundingFor({ unitId: "kbu-chem-1", topic: CIRCLE_LESSON }, true);
    assert.ok(g);
    assert.equal(g.unitId, CIRCLE);
  });

  it("cites a page a teacher can turn to", () => {
    const g = groundingFor({ topic: CIRCLE_LESSON }, true);
    assert.ok(g);
    for (const s of g.sources) {
      assert.ok(Number.isInteger(s.page) && s.page > 0, `bad page: ${s.page}`);
      // Named from kind/subject/semester, never the filename — the chemistry
      // book's filename is «10th grade, alchamy1st semester.pdf».
      assert.match(s.titleAr, /[؀-ۿ]/, `not an Arabic label: ${s.titleAr}`);
      assert.ok(!s.titleAr.includes(".pdf"), s.titleAr);
      assert.ok(g.block.includes(String(s.page)), "a cited page is not in the block");
    }
  });

  it("says the text is machine-extracted", () => {
    // «العلاقات» arrives as «العالقات». Told, the model reads through it;
    // untold, it copies the artefact into what it writes.
    const g = groundingFor({ topic: CIRCLE_LESSON }, true);
    assert.ok(g);
    assert.match(g.block, /مستخرَج آليًّا/);
  });

  it("stays inside its character budget", () => {
    const g = groundingFor({ topic: CIRCLE_LESSON }, true);
    assert.ok(g);
    // 6,000 of passage text plus the header, citations and footer.
    assert.ok(g.block.length < 7_000, `block is ${g.block.length} chars`);
  });

  it("is deterministic", () => {
    const a = groundingFor({ unitId: CIRCLE }, true);
    const b = groundingFor({ unitId: CIRCLE }, true);
    assert.deepEqual(a?.sources, b?.sources);
  });

  it("returns nothing rather than something adjacent", () => {
    assert.equal(groundingFor({ unitId: FINLIT }, true), null, "finlit has no extracted text");
    assert.equal(groundingFor({ topic: "شيء غير موجود في المنهاج" }, true), null);
    assert.equal(groundingFor({ topic: "" }, true), null);
    assert.equal(groundingFor({}, true), null);
    // «المشتقات» names a unit, not a lesson: resolving it loosely would attach
    // one lesson's pages to a whole unit's worth of intent.
    assert.equal(groundingFor({ topic: "المشتقات" }, true), null);
  });

  it("answers in the requested language", () => {
    const en = groundingFor({ unitId: CIRCLE }, false);
    assert.ok(en);
    assert.match(en.block, /Verbatim text from the official textbook/);
    assert.match(en.block, /page \d+/);
  });
});

describe("withGrounding", () => {
  it("keeps the teacher's own context first and unchanged", () => {
    const teacher = "ركّز على الطلبة الضعاف واستخدم أمثلة من السوق المحلي";
    const { body, grounding } = withGrounding({ topic: CIRCLE_LESSON, additionalContext: teacher }, true);
    assert.ok(grounding);
    const ctx = body.additionalContext as string;
    assert.ok(ctx.startsWith(teacher), "the teacher's context was displaced or reworded");
    assert.ok(ctx.includes(grounding.block));
  });

  it("returns the body untouched when nothing is found", () => {
    // Not "an empty block appended". An ungrounded request must be exactly the
    // request that was sent, or the fallback is its own silent edit.
    const sent = { topic: "لا شيء", additionalContext: "سياق المعلم", grade: "الصف العاشر" };
    const { body, grounding } = withGrounding(sent, true);
    assert.equal(grounding, null);
    assert.deepEqual(body, sent);
  });

  it("grounds a body that had no context of its own", () => {
    const body = withGrounding({ topic: CIRCLE_LESSON } as Record<string, unknown>, true).body;
    assert.match(body.additionalContext as string, /^=== نص حرفي/);
  });

  it("leaves every other field alone", () => {
    const sent = { topic: CIRCLE_LESSON, grade: "الصف العاشر", duration: 45, questionTypes: ["mcq"] };
    const { body } = withGrounding(sent, true);
    assert.equal(body.grade, sent.grade);
    assert.equal(body.duration, sent.duration);
    assert.deepEqual(body.questionTypes, sent.questionTypes);
  });
});

describe("nothing reference-only reaches a prompt", () => {
  it("cites only NCCD material", () => {
    // A generated worksheet is an export path: whatever is in the prompt can be
    // printed and handed to a class. Teacher-authored documents in the bank are
    // reference-only, and `quotableOnly: true` is one flag away from being
    // forgotten at a new call site — so it is asserted on the output, not on
    // the argument.
    const grounded = [
      groundingFor({ unitId: CIRCLE }, true),
      groundingFor({ unitId: "kbu-math-s1-nccd-u1" }, true),
      groundingFor({ unitId: "kbu-chem-s1-nccd-u1" }, true),
      groundingForObjectives(getObjectivesForUnit(CIRCLE), true),
    ].filter(g => g !== null);
    assert.ok(grounded.length >= 3, "not enough grounded units to make this test mean anything");

    // The six extracted documents are all NCCD student/exercise books and the
    // S2 teacher guide. Anything else appearing here is teacher-authored.
    const NCCD = /^(math|chem)-s[12]-(student-book|exercise-book|teacher-guide)$/;
    for (const g of grounded) {
      for (const s of g.sources) {
        assert.match(s.sourceId, NCCD, `${s.sourceId} is not quotable NCCD material`);
      }
    }
  });
});

describe("groundingForObjectives", () => {
  it("grounds an exam from its objectives' own unit", () => {
    const g = groundingForObjectives(getObjectivesForUnit(CIRCLE), true);
    assert.ok(g, "no grounding for a unit whose book is extracted");
    assert.equal(g.unitId, CIRCLE);
    assert.ok(g.block.length > 500);
  });

  it("pools two units without exceeding the page budget", () => {
    const two = [
      ...getObjectivesForUnit("kbu-math-s1-nccd-u1"),
      ...getObjectivesForUnit(CIRCLE),
    ];
    const g = groundingForObjectives(two, true);
    assert.ok(g);
    assert.ok(g.sources.length <= 3, `${g.sources.length} passages for a two-unit paper`);
    // Same paper, same pages — a teacher regenerating should not get a
    // different book excerpt each time.
    assert.deepEqual(groundingForObjectives(two, true)?.sources, g.sources);
  });

  it("is null for objectives with nothing on file", () => {
    assert.equal(groundingForObjectives(getObjectivesForUnit(FINLIT), true), null);
    assert.equal(groundingForObjectives([], true), null);
    assert.equal(groundingForObjectives([{ unitId: "kbu-chem-1" }], true), null);
  });
});
