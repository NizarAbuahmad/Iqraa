/**
 * Escape-deck unlock codes.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/escapeCodes.test.ts
 *
 * The case that started this: a live-generated deck whose reveal slide carried
 * `unlockCode: "٠"`. Arabic-Indic zero is a dot; at 48px green on a projector
 * the class sees nothing, and the escape code they are meant to write down is
 * unreadable. The activity has no other mechanic, so that is the whole slide
 * failing while the request returns 200.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeEscapeCodes, readDigit, writeDigit } from "../escapeCodes.ts";

type Slide = Record<string, unknown>;
const slidesOf = (out: unknown): Slide[] => (out as { slides: Slide[] }).slides;

const challenge = (code: unknown, n = 1): Slide => ({
  slideNumber: n, type: "challenge", title: `التحدي ${n}`,
  content: "نص", unlockCode: code, durationSeconds: 180,
});
const reveal = (code: unknown, n = 2, title = "تم فتح الكود!"): Slide => ({
  slideNumber: n, type: "reveal", title, content: "وصف", unlockCode: code, durationSeconds: 0,
});
const deck = (...slides: Slide[]) => ({ activityName: "تحدي الهروب", slides });

describe("readDigit", () => {
  it("reads both numeral systems — the model mixes them", () => {
    assert.equal(readDigit("7"), 7);
    assert.equal(readDigit("٧"), 7);
  });

  it("rejects zero in either script", () => {
    assert.equal(readDigit("0"), null);
    assert.equal(readDigit("٠"), null);
  });

  it("rejects what cannot be a single readable digit", () => {
    for (const bad of ["", " ", "12", "١٢", "A", "س", "-3", null, undefined, {}]) {
      assert.equal(readDigit(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });

  it("tolerates surrounding whitespace and a numeric code", () => {
    assert.equal(readDigit(" 4 "), 4);
    assert.equal(readDigit(6), 6);
  });
});

describe("writeDigit", () => {
  it("uses the deck's own numerals", () => {
    assert.equal(writeDigit(7, true), "٧");
    assert.equal(writeDigit(7, false), "7");
  });
});

describe("normalizeEscapeCodes", () => {
  it("replaces the zero that made this necessary", () => {
    const out = normalizeEscapeCodes(deck(challenge("٠"), reveal("٠")), true);
    const [c, r] = slidesOf(out);
    assert.notEqual(c!.unlockCode, "٠");
    assert.equal(readDigit(c!.unlockCode), readDigit(r!.unlockCode));
    assert.ok(readDigit(c!.unlockCode) !== null, "replacement must itself be usable");
  });

  it("keeps a valid distinct code exactly as written", () => {
    const out = normalizeEscapeCodes(deck(challenge("٣"), challenge("٨", 3)), true);
    assert.deepEqual(slidesOf(out).map(s => s.unlockCode), ["٣", "٨"]);
  });

  it("breaks up repeated codes — the prompt's example digit copied everywhere", () => {
    const out = normalizeEscapeCodes(
      deck(challenge("٥", 1), challenge("٥", 2), challenge("٥", 3)),
      true,
    );
    const codes = slidesOf(out).map(s => s.unlockCode as string);
    assert.equal(codes[0], "٥", "the first use of a valid code is kept");
    assert.equal(new Set(codes).size, 3, `codes repeated: ${codes.join(",")}`);
  });

  it("gives a reveal the code of the challenge before it", () => {
    const out = normalizeEscapeCodes(deck(challenge("٤"), reveal("٩")), true);
    const [, r] = slidesOf(out);
    assert.equal(r!.unlockCode, "٤");
  });

  it("names the digit in the reveal title", () => {
    const out = normalizeEscapeCodes(deck(challenge("٤"), reveal("٤")), true);
    assert.equal(slidesOf(out)[1]!.title, "🔓 الكود ٤ مفتوح!");
  });

  it("leaves a title that already names the digit", () => {
    const written = "🔓 رائع! الكود ٤ بين أيديكم";
    const out = normalizeEscapeCodes(deck(challenge("٤"), reveal("٤", 2, written)), true);
    assert.equal(slidesOf(out)[1]!.title, written);
  });

  it("uses latin numerals for an English deck", () => {
    const out = normalizeEscapeCodes(deck(challenge("0"), reveal("0", 2, "Code Unlocked!")), false);
    const [c, r] = slidesOf(out);
    assert.equal(c!.unlockCode, "1");
    assert.equal(r!.title, "🔓 Code 1 unlocked!");
  });

  it("rewrites a summary whose code list went stale", () => {
    const out = normalizeEscapeCodes(
      deck(
        challenge("٠", 1), reveal("٠", 2),
        challenge("٠", 3), reveal("٠", 4),
        { slideNumber: 5, type: "summary", title: "🎉 لقد هربتم!",
          content: "أحسنتم!\nكود الهروب الكامل: ٠ – ٠", durationSeconds: 0 },
      ),
      true,
    );
    const slides = slidesOf(out);
    const codes = [slides[0]!.unlockCode, slides[2]!.unlockCode];
    const summary = slides[4]!.content as string;
    assert.ok(summary.startsWith("أحسنتم!"), "the rest of the summary survives");
    assert.equal(summary.match(/كود الهروب الكامل/g)?.length, 1, "exactly one code line");
    assert.ok(summary.endsWith(`كود الهروب الكامل: ${codes[0]} – ${codes[1]}`), summary);
  });

  it("leaves the summary alone when nothing was repaired", () => {
    const before = deck(
      challenge("٣", 1), reveal("٣", 2, "🔓 الكود ٣ مفتوح!"),
      { slideNumber: 3, type: "summary", title: "🎉", content: "كود الهروب الكامل: ٣", durationSeconds: 0 },
    );
    const out = normalizeEscapeCodes(structuredClone(before), true);
    assert.deepEqual(out, before);
  });

  it("does not mutate the activity it was given", () => {
    const input = deck(challenge("٠"), reveal("٠"));
    normalizeEscapeCodes(input, true);
    assert.equal(input.slides[0]!.unlockCode, "٠");
    assert.equal(input.slides[1]!.title, "تم فتح الكود!");
  });

  it("is a no-op for a deck with no unlock codes", () => {
    const bingo = { activityName: "بينجو", slides: [{ slideNumber: 1, type: "bingo-call", title: "نداء", content: "س", durationSeconds: 30 }] };
    assert.deepEqual(normalizeEscapeCodes(structuredClone(bingo), true), bingo);
  });

  it("survives the shapes a model actually returns instead of a deck", () => {
    for (const junk of [null, undefined, "", 7, [], {}, { slides: "nope" }]) {
      assert.deepEqual(normalizeEscapeCodes(junk, true), junk);
    }
  });

  it("keeps going past nine challenges rather than running out", () => {
    const many = deck(...Array.from({ length: 11 }, (_, i) => challenge("٠", i + 1)));
    const codes = slidesOf(normalizeEscapeCodes(many, true)).map(s => s.unlockCode);
    assert.equal(codes.length, 11);
    for (const c of codes) assert.ok(readDigit(c) !== null, `unusable code ${String(c)}`);
    assert.equal(new Set(codes.slice(0, 9)).size, 9, "the first nine are all distinct");
  });
});
