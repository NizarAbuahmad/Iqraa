import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_LIBRARY_FILE_BYTES, checkEntry, dedupeKey, fileQuery, linkBody, type ManifestEntry } from "../libraryManifest.ts";

const base: ManifestEntry = {
  file: "podcast.MP3",
  gradeId: "grade-5",
  subjectId: "science",
  category: "audio",
  titleAr: "بودكاست الدرس",
};

test("a valid file entry resolves its mime from the extension, case-insensitively", () => {
  assert.deepEqual(checkEntry(base, 1000), { ok: true, kind: "file", mime: "audio/mpeg" });
});

test("a valid link entry needs https", () => {
  const link = { ...base, file: undefined, url: "https://example.com/v" };
  assert.deepEqual(checkEntry(link), { ok: true, kind: "link" });
  assert.equal(checkEntry({ ...link, url: "http://example.com/v" }).ok, false);
});

test("exactly one of file / url", () => {
  assert.equal(checkEntry({ ...base, url: "https://example.com" }).ok, false);
  assert.equal(checkEntry({ ...base, file: undefined }).ok, false);
});

test("rejects what the server would reject", () => {
  assert.equal(checkEntry({ ...base, category: "podcast" }, 1).ok, false);
  assert.equal(checkEntry({ ...base, gradeId: "5" }, 1).ok, false);
  assert.equal(checkEntry({ ...base, lessonId: "lesson-1" }, 1).ok, false);
  assert.equal(checkEntry({ ...base, titleAr: "  " }, 1).ok, false);
  assert.equal(checkEntry({ ...base, file: "notes.csv" }, 1).ok, false);
  assert.equal(checkEntry({ ...base, file: "noextension" }, 1).ok, false);
});

test("size limits: empty and over 25 MB fail, exactly 25 MB passes", () => {
  assert.equal(checkEntry(base, 0).ok, false);
  assert.equal(checkEntry(base, MAX_LIBRARY_FILE_BYTES + 1).ok, false);
  assert.equal(checkEntry(base, MAX_LIBRARY_FILE_BYTES).ok, true);
});

test("dedupeKey ignores a null lesson and surrounding space in the title", () => {
  assert.equal(
    dedupeKey({ gradeId: "grade-5", lessonId: null, category: "audio", titleAr: " س " }),
    dedupeKey({ gradeId: "grade-5", category: "audio", titleAr: "س" }),
  );
});

test("fileQuery carries Arabic safely and omits unset fields", () => {
  const q = new URLSearchParams(fileQuery({ ...base, semester: 2, lessonId: "kbl-1" }));
  assert.equal(q.get("titleAr"), "بودكاست الدرس");
  assert.equal(q.get("semester"), "2");
  assert.equal(q.get("lessonId"), "kbl-1");
  assert.equal(q.has("description"), false);
});

test("linkBody drops the local-only fields", () => {
  const body = linkBody({ ...base, file: undefined, url: "https://example.com", id: "x" });
  assert.equal("id" in body, false);
  assert.equal("file" in body, false);
  assert.equal(body.url, "https://example.com");
});
