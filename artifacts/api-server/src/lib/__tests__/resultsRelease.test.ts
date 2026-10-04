import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { releaseAnnouncement, resultsReleaseDecision } from "../resultsRelease.ts";

describe("resultsReleaseDecision", () => {
  it("releases a published or a closed exam", () => {
    assert.deepEqual(resultsReleaseDecision({ status: "published" }, { released: true }), { ok: true, released: true });
    assert.deepEqual(resultsReleaseDecision({ status: "closed" }, { released: true }), { ok: true, released: true });
  });

  it("refuses to release a draft — nobody can have sat it", () => {
    const d = resultsReleaseDecision({ status: "draft" }, { released: true });
    assert.equal(d.ok, false);
    assert.equal(!d.ok && d.code, "not_published");
  });

  it("always lets a teacher take a release back", () => {
    assert.deepEqual(resultsReleaseDecision({ status: "draft" }, { released: false }), { ok: true, released: false });
    assert.deepEqual(resultsReleaseDecision({ status: "closed" }, { released: false }), { ok: true, released: false });
  });

  it("needs an explicit boolean", () => {
    for (const body of [{}, { released: "true" }, null, { released: 1 }]) {
      const d = resultsReleaseDecision({ status: "published" }, body);
      assert.equal(d.ok, false);
      assert.equal(!d.ok && d.code, "invalid_input");
    }
  });
});

describe("releaseAnnouncement", () => {
  it("names the exam by its Arabic title", () => {
    const a = releaseAnnouncement({ title: "Waves quiz", titleAr: "اختبار الموجات" });
    assert.equal(a.pushTitle, "نتيجة «اختبار الموجات»");
    assert.match(a.groupLine, /«اختبار الموجات»/);
    assert.match(a.pushBody, /«اختباراتي»/);
  });

  it("falls back to the latin title, then to no name, never to empty quotes", () => {
    assert.equal(releaseAnnouncement({ title: "Waves quiz", titleAr: "  " }).pushTitle, "نتيجة «Waves quiz»");
    const bare = releaseAnnouncement({ title: "", titleAr: null });
    assert.equal(bare.pushTitle, "نتيجة اختبارك");
    assert.doesNotMatch(bare.groupLine, /«»/);
  });
});
