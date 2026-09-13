import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_AVATAR_DATA_URL_LENGTH, extensionForAvatarMime } from "../avatarUpload.ts";

test("extensionForAvatarMime returns the extension for a supported image mime", () => {
  assert.equal(extensionForAvatarMime("image/jpeg"), ".jpg");
  assert.equal(extensionForAvatarMime("image/png"), ".png");
  assert.equal(extensionForAvatarMime("image/webp"), ".webp");
});

test("extensionForAvatarMime rejects non-image mimes even though lessonMedia allows them", () => {
  assert.equal(extensionForAvatarMime("application/pdf"), null);
  assert.equal(extensionForAvatarMime("audio/mpeg"), null);
});

test("extensionForAvatarMime rejects an unrecognized image mime", () => {
  assert.equal(extensionForAvatarMime("image/gif"), null);
});

test("MAX_AVATAR_DATA_URL_LENGTH is smaller than the general lesson-media cap", () => {
  assert.ok(MAX_AVATAR_DATA_URL_LENGTH > 0);
  assert.ok(MAX_AVATAR_DATA_URL_LENGTH < 8_000_000);
});
