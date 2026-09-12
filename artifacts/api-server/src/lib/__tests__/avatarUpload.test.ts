/**
 * What may become someone's profile picture.
 *
 * The avatar allowlist is deliberately narrower than the lesson-media one
 * (see avatarUpload.ts), and the difference is easy to erase by "unifying"
 * the two tables later. These assertions are what would notice: HEIC and PDF
 * are both fine as lesson media and both refused here, because an avatar has
 * to render inside an `<Image>` on the web build.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVATAR_EXTENSION_BY_MIME,
  MAX_AVATAR_DATA_URL_LENGTH,
  parseAvatarDataUrl,
} from "../avatarUpload.ts";
import { EXTENSION_BY_MIME } from "../lessonMediaUpload.ts";

const dataUrl = (mime: string, body = "picture-bytes") =>
  `data:${mime};base64,${Buffer.from(body).toString("base64")}`;

test("accepts the three formats every client can decode", () => {
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
    const result = parseAvatarDataUrl(dataUrl(mime));
    assert.equal(result.ok, true, `${mime} should be accepted`);
    if (!result.ok) return;
    assert.equal(result.mime, mime);
    assert.equal(result.buffer.toString("utf8"), "picture-bytes");
    assert.ok(result.extension.startsWith("."), `${result.extension} should start with a dot`);
  }
});

test("refuses a format the web build cannot render, even one lesson media accepts", () => {
  for (const mime of ["image/heic", "image/heif", "application/pdf", "audio/mpeg"]) {
    const result = parseAvatarDataUrl(dataUrl(mime));
    assert.equal(result.ok, false, `${mime} should be refused`);
    if (result.ok) return;
    assert.equal(result.code, "unsupported_type");
    assert.equal(result.status, 400);
  }
  // The point of the previous assertion: these are not universally bad files,
  // they are bad *avatars*. Lesson media takes them.
  assert.ok(EXTENSION_BY_MIME["image/heic"]);
  assert.ok(EXTENSION_BY_MIME["application/pdf"]);
});

test("refuses anything that isn't a data: URL", () => {
  for (const input of ["", "https://example.com/me.jpg", "data:image/png,not-base64", null, undefined, 42]) {
    const result = parseAvatarDataUrl(input);
    assert.equal(result.ok, false, `${String(input)} should be refused`);
    if (result.ok) return;
    assert.equal(result.code, "bad_data_url");
    assert.equal(result.status, 400);
  }
});

test("an oversized picture is 413, not 400 — and is refused before it is decoded", () => {
  const result = parseAvatarDataUrl(`data:image/jpeg;base64,${"A".repeat(MAX_AVATAR_DATA_URL_LENGTH)}`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "file_too_large");
  assert.equal(result.status, 413);
});

test("the avatar ceiling stays well under the lesson-media one", () => {
  // Not a style preference: this route writes to R2 on every call, and a
  // profile picture that costs as much to upload as a scanned worksheet means
  // the client stopped downscaling.
  assert.ok(MAX_AVATAR_DATA_URL_LENGTH < 8_000_000);
});

test("every avatar extension starts with a dot", () => {
  for (const ext of Object.values(AVATAR_EXTENSION_BY_MIME)) {
    assert.ok(ext.startsWith("."), `${ext} should start with a dot`);
  }
});
