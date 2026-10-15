/**
 * The refusals that happen before a photograph is allowed to cost anything.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SCAN_IMAGE_CHARS,
  MAX_SETUP_IMAGES,
  MAX_SETUP_OBJECTIVES,
  checkScanImage,
  classScanGate,
  parsePaperScanBody,
} from "../scanRequest.ts";

const PHOTO = "data:image/jpeg;base64,AAAA";

describe("checkScanImage", () => {
  it("accepts a data URL image", () => {
    assert.equal(checkScanImage(PHOTO), null);
  });

  it("refuses anything that is not a data URL image", () => {
    for (const bad of [undefined, null, 5, "", "https://x/y.jpg", "data:text/plain;base64,AA", {}]) {
      assert.equal(checkScanImage(bad)?.code, "bad_image", JSON.stringify(bad));
      assert.equal(checkScanImage(bad)?.status, 400);
    }
  });

  it("refuses an oversized photo with advice, not a generic error", () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_SCAN_IMAGE_CHARS);
    const refusal = checkScanImage(huge);
    assert.equal(refusal?.status, 413);
    assert.equal(refusal?.code, "image_too_large");
  });
});

describe("parsePaperScanBody", () => {
  it("accepts one to four photos and a list of objectives", () => {
    const res = parsePaperScanBody({ images: [PHOTO, PHOTO], objectiveIds: ["o1", "o2"] });
    assert.ok(res.ok);
    if (res.ok) {
      assert.equal(res.images.length, 2);
      assert.deepEqual(res.objectiveIds, ["o1", "o2"]);
    }
  });

  it("refuses no photos, too many photos, and a non-list", () => {
    for (const images of [[], Array(MAX_SETUP_IMAGES + 1).fill(PHOTO), "x", undefined]) {
      const res = parsePaperScanBody({ images, objectiveIds: ["o1"] });
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.refusal.code, "bad_image");
    }
  });

  it("refuses a bad photo anywhere in the list", () => {
    const res = parsePaperScanBody({ images: [PHOTO, "nope"], objectiveIds: ["o1"] });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.refusal.code, "bad_image");
  });

  it("refuses photos that are each fine but too large together", () => {
    // Three at 3.6M each: every one under the per-photo cap, 10.8M altogether.
    const big = "data:image/jpeg;base64," + "A".repeat(3_600_000);
    const res = parsePaperScanBody({ images: [big, big, big], objectiveIds: ["o1"] });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.refusal.code, "image_too_large");
  });

  it("refuses missing, empty, blank-entry and over-long objective lists", () => {
    const base = { images: [PHOTO] };
    for (const objectiveIds of [
      undefined,
      [],
      ["o1", "  "],
      ["o1", 7],
      Array.from({ length: MAX_SETUP_OBJECTIVES + 1 }, (_, i) => `o${i}`),
    ]) {
      const res = parsePaperScanBody({ ...base, objectiveIds });
      assert.equal(res.ok, false, JSON.stringify(objectiveIds));
      if (!res.ok) assert.equal(res.refusal.code, "bad_objectives");
    }
  });

  it("de-duplicates and trims objective ids", () => {
    const res = parsePaperScanBody({ images: [PHOTO], objectiveIds: [" o1 ", "o1", "o2"] });
    assert.ok(res.ok);
    if (res.ok) assert.deepEqual(res.objectiveIds, ["o1", "o2"]);
  });

  it("survives a body that is not an object", () => {
    for (const body of [null, undefined, "x", 3, []]) {
      assert.equal(parsePaperScanBody(body).ok, false);
    }
  });
});

describe("classScanGate", () => {
  const PAPER = { gradingMode: "manual", body: {} };
  const GENERATED = { gradingMode: "deterministic", body: { stem: "x" } };

  it("lets a published exam with a class through", () => {
    assert.equal(classScanGate({ status: "published", classGroupId: "c1" }, []), null);
  });

  it("refuses a draft or closed exam", () => {
    for (const status of ["draft", "closed"]) {
      const r = classScanGate({ status, classGroupId: "c1" }, []);
      assert.equal(r?.status, 409);
      assert.equal(r?.code, "not_published");
    }
  });

  it("refuses an exam with no class — there is no roster to match against", () => {
    const r = classScanGate({ status: "published", classGroupId: null }, []);
    assert.equal(r?.status, 409);
    assert.equal(r?.code, "no_class");
  });

  it("lets a published paper exam with a class through", () => {
    assert.equal(classScanGate({ status: "published", classGroupId: "c1" }, [PAPER, PAPER, PAPER]), null);
  });

  it("refuses an exam with any question the app marks itself", () => {
    // Blank cells + submit would machine-grade every unanswered question as 0.
    const r = classScanGate({ status: "published", classGroupId: "c1" }, [PAPER, GENERATED, PAPER]);
    assert.equal(r?.status, 409);
    assert.equal(r?.code, "not_paper_exam");
  });

  it("still says not_published first for a draft with generated questions", () => {
    const r = classScanGate({ status: "draft", classGroupId: "c1" }, [GENERATED]);
    assert.equal(r?.code, "not_published");
  });
});
