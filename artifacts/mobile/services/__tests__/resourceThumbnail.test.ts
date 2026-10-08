import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { driveThumbnail, imageCoverFromUrl, videoCoverFromUrl, youtubeThumbnail } from '../resourceThumbnail.ts';

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

describe('imageCoverFromUrl', () => {
  it('uses an uploaded picture as its own cover', () => {
    assert.equal(imageCoverFromUrl('https://r2.test/a/b', 'image/png'), 'https://r2.test/a/b');
    assert.equal(imageCoverFromUrl('https://r2.test/a.JPG?x=1'), 'https://r2.test/a.JPG?x=1');
  });

  it('gives a PDF or a web page no cover', () => {
    assert.equal(imageCoverFromUrl('https://r2.test/a.png', 'application/pdf'), null);
    assert.equal(imageCoverFromUrl('https://r2.test/a.pdf'), null);
    assert.equal(imageCoverFromUrl('https://archive.org/details/x'), null);
  });
});
