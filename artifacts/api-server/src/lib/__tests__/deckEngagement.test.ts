/**
 * What this guards: the numbers the prompt-slides route logs for every live deck,
 * which are the only measure of whether a deck gives the class something to do.
 * A wrong count here makes a prompt change look like it worked when it did not.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deckEngagement, MAX_PASSIVE_RUN } from "../deckEngagement.ts";

const slide = (type: string, extra: Record<string, unknown> = {}) => ({ type, title: "t", content: "• a\n• b", ...extra });

describe("deckEngagement", () => {
  it("counts the class's turns and where the first one comes", () => {
    const e = deckEngagement({
      slides: [slide("intro"), slide("intro"), slide("divider"), slide("intro"), slide("question"), slide("challenge"), slide("summary")],
    });
    assert.equal(e.slides, 7);
    assert.equal(e.activities, 2);
    assert.equal(e.firstActivity, 5);
  });

  it("measures the longest run of explanation slides, not counting the cover", () => {
    // cover | 3 in a row | question | 2 in a row
    const e = deckEngagement({
      slides: [slide("intro"), slide("intro"), slide("intro"), slide("intro"), slide("question"), slide("intro"), slide("intro")],
    });
    assert.equal(e.longestPassiveRun, 3);
  });

  it("lets a section break end a run — it is a pause, the run after it starts again", () => {
    const e = deckEngagement({
      slides: [slide("intro"), slide("intro"), slide("intro"), slide("divider"), slide("intro"), slide("intro")],
    });
    assert.equal(e.longestPassiveRun, 2);
  });

  it("reports no activity at all as null, not slide 0", () => {
    const e = deckEngagement({ slides: [slide("intro"), slide("intro"), slide("summary")] });
    assert.equal(e.activities, 0);
    assert.equal(e.firstActivity, null);
  });

  it("counts laid-out explanation slides and single-line ones separately", () => {
    const e = deckEngagement({
      slides: [
        slide("intro", { content: "cover line" }),
        slide("intro", { layout: "statement", content: "one big question?" }),
        slide("intro", { content: "just one line" }),
        slide("intro", { content: "• two\n• lines" }),
        slide("summary", { content: "• x\n• y" }),
      ],
    });
    assert.equal(e.contentSlides, 4);
    assert.equal(e.laidOut, 1);
    // The statement slide is one line on purpose; the cover is not a content slide.
    assert.equal(e.singleLine, 1);
  });

  it("averages words over the content slides", () => {
    const e = deckEngagement({
      slides: [slide("intro", { content: "cover" }), slide("intro", { content: "one two three four" }), slide("summary", { content: "a b" })],
    });
    assert.equal(e.wordsPerContentSlide, 3);
  });

  it("survives a deck with no slides array", () => {
    const e = deckEngagement({});
    assert.equal(e.slides, 0);
    assert.equal(e.longestPassiveRun, 0);
    assert.equal(e.wordsPerContentSlide, 0);
  });

  it("matches the prompt's own limit of two explanation slides in a row", () => {
    assert.equal(MAX_PASSIVE_RUN, 2);
  });
});
