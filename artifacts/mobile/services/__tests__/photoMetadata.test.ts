/**
 * Which photos are re-encoded so their EXIF/GPS is dropped.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { carriesCameraMetadata } from '../photoMetadata.ts';

describe('carriesCameraMetadata', () => {
  it('is true for what a camera writes', () => {
    for (const m of ['image/jpeg', 'image/jpg', 'IMAGE/JPEG', 'image/heic', 'image/heif', 'image/jpeg; charset=x']) {
      assert.equal(carriesCameraMetadata(m), true, m);
    }
  });

  it('is false for PNG, GIF, WebP, which a JPEG re-encode would damage', () => {
    for (const m of ['image/png', 'image/gif', 'image/webp', 'image/svg+xml']) {
      assert.equal(carriesCameraMetadata(m), false, m);
    }
  });

  it('falls back to the file name, then to JPEG', () => {
    assert.equal(carriesCameraMetadata(null, 'file:///x/IMG_1.HEIC'), true);
    assert.equal(carriesCameraMetadata(undefined, 'file:///x/a.jpeg?v=2'), true);
    assert.equal(carriesCameraMetadata('', 'file:///x/a.png'), false);
    assert.equal(carriesCameraMetadata(null, 'blob:http://x/3f2a'), true);
    assert.equal(carriesCameraMetadata(null, null), true);
  });

  it('trusts the mime type over a misleading name', () => {
    assert.equal(carriesCameraMetadata('image/png', 'file:///a.jpg'), false);
  });
});
