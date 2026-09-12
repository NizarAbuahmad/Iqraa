/**
 * The rules a picked photo has to satisfy before it is sent as an avatar.
 *
 * The one that matters is the allowlist: it is a copy of the API's, kept in
 * step by hand, and the failure it prevents is silent on this side — an
 * unsupported photo uploads fine and comes back a 400 from a server the
 * teacher cannot see.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_MAX_EDGE,
  AVATAR_MIME_TYPES,
  isSupportedAvatarDataUrl,
  mimeFromDataUrl,
} from '../avatarImage.ts';

test('the allowlist is exactly what the API accepts', () => {
  // Mirrors AVATAR_EXTENSION_BY_MIME in artifacts/api-server/src/lib/avatarUpload.ts.
  // Adding one here without adding it there ships a picker that offers a
  // format the upload then refuses.
  assert.deepEqual([...AVATAR_MIME_TYPES], ['image/jpeg', 'image/png', 'image/webp']);
});

test('mimeFromDataUrl reads the type off a data URL', () => {
  assert.equal(mimeFromDataUrl('data:image/png;base64,AAAA'), 'image/png');
  assert.equal(mimeFromDataUrl('data:image/jpeg;base64,AAAA'), 'image/jpeg');
  // No `;base64` part — still a data URL, still has a type.
  assert.equal(mimeFromDataUrl('data:image/svg+xml,<svg/>'), 'image/svg+xml');
});

test('mimeFromDataUrl returns null for anything that is not a data URL', () => {
  assert.equal(mimeFromDataUrl(''), null);
  assert.equal(mimeFromDataUrl('https://example.com/me.jpg'), null);
  assert.equal(mimeFromDataUrl('data:'), null);
});

test('a HEIC photo is refused — the web build cannot draw one', () => {
  // iOS hands these over unconverted on some paths, and `downscaleImage` is a
  // no-op off the web, so this is the case that actually reaches the check.
  assert.equal(isSupportedAvatarDataUrl('data:image/heic;base64,AAAA'), false);
  assert.equal(isSupportedAvatarDataUrl('data:image/heif;base64,AAAA'), false);
});

test('the three supported formats pass', () => {
  for (const mime of AVATAR_MIME_TYPES) {
    assert.equal(isSupportedAvatarDataUrl(`data:${mime};base64,AAAA`), true, mime);
  }
});

test('a PDF is refused even though lesson media takes one', () => {
  assert.equal(isSupportedAvatarDataUrl('data:application/pdf;base64,AAAA'), false);
  assert.equal(isSupportedAvatarDataUrl('not a data url'), false);
});

test('the avatar edge is far below the scan edge', () => {
  // A face in a circle is not a page of handwriting; sending it at scan
  // resolution is bytes spent on detail the circle cannot show.
  assert.ok(AVATAR_MAX_EDGE < 1600);
});
