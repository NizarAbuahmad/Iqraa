import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LIBRARY_EXTENSION_BY_MIME,
  MAX_LIBRARY_FILE_BYTES,
  parseLessonIdPatch,
  parseLibraryLink,
  parseLibraryMeta,
} from "../libraryResource.ts";

const ok = {
  gradeId: "grade-5",
  subjectId: "science",
  lessonId: "kbl-g5-science-s1-nccd-u1_l1",
  category: "infographic",
  titleAr: "  شبكة غذائية  ",
};

describe("library item metadata", () => {
  it("accepts a well-formed item and trims it", () => {
    const meta = parseLibraryMeta(ok);
    assert.ok(!("error" in meta));
    assert.equal(meta.titleAr, "شبكة غذائية");
    assert.equal(meta.description, "");
  });

  it("treats a missing lesson as a subject-wide item", () => {
    const meta = parseLibraryMeta({ ...ok, lessonId: "" });
    assert.ok(!("error" in meta) && meta.lessonId === null);
  });

  it("rejects what would file an item nowhere or under the wrong thing", () => {
    assert.ok("error" in parseLibraryMeta({ ...ok, gradeId: "5" }));
    assert.ok("error" in parseLibraryMeta({ ...ok, subjectId: "" }));
    assert.ok("error" in parseLibraryMeta({ ...ok, lessonId: "Food chains" }), "a title is not a lesson id");
    assert.ok("error" in parseLibraryMeta({ ...ok, category: "movie" }));
    assert.ok("error" in parseLibraryMeta({ ...ok, titleAr: "   " }));
  });
});

describe("library links", () => {
  it("accepts https and nothing else", () => {
    assert.equal(parseLibraryLink("https://www.youtube.com/watch?v=abc"), "https://www.youtube.com/watch?v=abc");
    assert.equal(parseLibraryLink("http://example.com/a"), null);
    assert.equal(parseLibraryLink("javascript:alert(1)"), null);
    assert.equal(parseLibraryLink("not a url"), null);
    assert.equal(parseLibraryLink(42), null);
  });
});

describe("library uploads", () => {
  it("never accepts a type that can carry script", () => {
    for (const mime of ["image/svg+xml", "text/html", "application/javascript"]) {
      assert.equal(LIBRARY_EXTENSION_BY_MIME[mime], undefined, mime);
    }
  });

  it("stays under Cloud Run's 32 MiB request ceiling", () => {
    assert.ok(MAX_LIBRARY_FILE_BYTES < 32 * 1024 * 1024);
  });
});

describe("editing an item's lesson", () => {
  it("leaves the lesson alone when the edit does not mention it", () => {
    assert.equal(parseLessonIdPatch(undefined), undefined);
  });

  it("files the item under no lesson for null or an empty string", () => {
    assert.deepEqual(parseLessonIdPatch(null), { lessonId: null });
    assert.deepEqual(parseLessonIdPatch("  "), { lessonId: null });
  });

  it("accepts a kbl-* id, trimmed", () => {
    assert.deepEqual(parseLessonIdPatch(" kbl-math-s1-nccd-u1_l1 "), { lessonId: "kbl-math-s1-nccd-u1_l1" });
  });

  it("refuses a title, a non-string and an over-long id", () => {
    assert.ok("error" in (parseLessonIdPatch("قانون الجيوب") ?? {}));
    assert.ok("error" in (parseLessonIdPatch(42) ?? {}));
    assert.ok("error" in (parseLessonIdPatch(`kbl-${"x".repeat(200)}`) ?? {}));
  });
});
