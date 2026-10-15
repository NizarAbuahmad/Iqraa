/**
 * The class scan asks the same prompt for two more things — the student's name
 * and the written total — and must not change what `scan-marks` has always sent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScanPrompt,
  parseNameRead,
  parseTotalRead,
  type ScannableQuestion,
} from "../scanMarks.ts";

const QUESTIONS: ScannableQuestion[] = [
  { questionId: "q1", number: 1, maxMarks: 5, type: "open_ended" },
  { questionId: "q2", number: 2, maxMarks: 10, type: "open_ended" },
];

// Captured from the prompt as it was before `readName` existed. If this fails,
// `POST /attempts/:id/scan-marks` has started sending the model something else.
const GOLDEN_DEFAULT = {
  system:
    "You read a teacher's handwritten marks from a photograph of a marked exam paper.\n\nYou are transcribing, not marking. Never judge whether a mark is correct,\nnever infer a mark from the student's work, and never fill in a gap.\n\nRules:\n1. Report only marks you can actually see written on the page.\n2. If a question has no visible mark, or you cannot read it with confidence,\n   omit that question entirely. Omitting is always better than guessing —\n   a guessed mark is attached to a real student.\n3. Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Western digits mean the same thing.\n   Report the numeric value.\n4. Half marks are common and are written many ways (٥٫٥, 5.5, 5½, ٥ و نصف).\n   Report them as a decimal.\n\nReturn JSON only: {\"marks\":[{\"number\":1,\"value\":3.5,\"readAs\":\"٣٫٥\"}]}\nNo prose, no markdown fence.",
  user:
    "This paper has these questions, numbered as they appear:\n  1. out of 5\n  2. out of 10\n\nRead the mark the teacher wrote for each one.\n\"readAs\" is the characters you saw, exactly as written.\n\"value\" is that as a number.\nOmit any question whose mark you cannot see or cannot read.",
};

describe("buildScanPrompt — default is unchanged", () => {
  it("is byte-identical to what scan-marks sent before readName existed", () => {
    assert.deepEqual(buildScanPrompt(QUESTIONS), GOLDEN_DEFAULT);
    assert.deepEqual(buildScanPrompt(QUESTIONS, {}), GOLDEN_DEFAULT);
    assert.deepEqual(buildScanPrompt(QUESTIONS, { readName: false }), GOLDEN_DEFAULT);
  });
});

describe("buildScanPrompt — readName", () => {
  it("asks for the name as written and forbids completing or guessing it", () => {
    const { system } = buildScanPrompt(QUESTIONS, { readName: true });
    assert.match(system, /transcribe the student's name exactly as written/);
    assert.match(system, /Never complete, correct or guess a name/);
  });

  it("asks for the written total and shows the new JSON shape", () => {
    const { system } = buildScanPrompt(QUESTIONS, { readName: true });
    assert.match(system, /wrote a total for the whole paper/);
    assert.match(system, /\{"name":"[^"]+","total":18,"marks":\[/);
  });

  it("keeps every rule of the default prompt", () => {
    const { system, user } = buildScanPrompt(QUESTIONS, { readName: true });
    assert.match(system, /transcribing, not marking/);
    assert.match(system, /Omitting is always better than guessing/);
    assert.equal(user, GOLDEN_DEFAULT.user);
  });
});

describe("parseNameRead", () => {
  it("returns the trimmed name", () => {
    assert.equal(parseNameRead({ name: "  سارة أحمد " }), "سارة أحمد");
  });

  it("is null for anything that is not a usable name", () => {
    for (const raw of [null, undefined, {}, { name: null }, { name: "" }, { name: "   " }, { name: 7 }, { name: "x".repeat(101) }, [], "text"]) {
      assert.equal(parseNameRead(raw), null, JSON.stringify(raw));
    }
  });
});

describe("parseTotalRead", () => {
  it("reads Western and Arabic-Indic digits", () => {
    assert.equal(parseTotalRead({ total: 18 }), 18);
    assert.equal(parseTotalRead({ total: "١٨٫٥" }), 18.5);
  });

  it("is null unless it is a positive number", () => {
    for (const raw of [null, undefined, {}, { total: null }, { total: 0 }, { total: -4 }, { total: "غير واضح" }, []]) {
      assert.equal(parseTotalRead(raw), null, JSON.stringify(raw));
    }
  });
});
