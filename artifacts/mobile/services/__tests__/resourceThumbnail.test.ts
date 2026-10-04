import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { driveThumbnail, videoCoverFromUrl, youtubeThumbnail } from '../resourceThumbnail.ts';

const ID = '16Ew7Ao5wuuQWCoTyHUBZGI11ehv1NaYF';

describe('driveThumbnail', () => {
  it('reads the file id from every share-link shape', () => {
    const want = `https://drive.google.com/thumbnail?id=${ID}&sz=w640`;
    for (const url of [
      `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
      `https://drive.google.com/file/d/${ID}/preview`,
      `https://drive.google.com/open?id=${ID}`,
      `https://drive.google.com/uc?export=download&id=${ID}`,
    ]) {
      assert.equal(driveThumbnail(url), want, url);
    }
  });

  it('is null for anything that is not a Drive file link', () => {
    for (const url of [
      'https://drive.google.com/drive/folders/abc',
      'https://example.com/file/d/' + ID,
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      '',
    ]) {
      assert.equal(driveThumbnail(url), null, url);
    }
  });
});

describe('videoCoverFromUrl', () => {
  it('prefers YouTube, then Drive, else null', () => {
    assert.equal(
      videoCoverFromUrl('https://youtu.be/jNQXAC9IVRw'),
      youtubeThumbnail('https://youtu.be/jNQXAC9IVRw'),
    );
    assert.match(videoCoverFromUrl(`https://drive.google.com/file/d/${ID}/view`)!, /drive\.google\.com\/thumbnail/);
    assert.equal(videoCoverFromUrl('https://example.com/videos/letters.mp4'), null);
  });
});
