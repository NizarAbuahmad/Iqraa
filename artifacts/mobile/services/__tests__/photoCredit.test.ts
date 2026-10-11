/**
 * photoCredit.ts — the Unsplash credit as linked text runs.
 *
 * The rule worth pinning: links appear only while the caption is still exactly
 * the credit's own text. A teacher who edits the caption or swaps the photo
 * must not keep linking to the previous photographer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { creditFromPhoto, creditSegments, photoCreditText, type PhotoCredit } from '../photoCredit.ts';

const credit: PhotoCredit = {
  photographer: 'Jane Roe',
  photographerUrl: 'https://unsplash.com/@jane?utm_source=iqraa&utm_medium=referral',
  unsplashUrl: 'https://unsplash.com/photos/abc?utm_source=iqraa&utm_medium=referral',
};

describe('creditSegments', () => {
  it('links the photographer and Unsplash in English', () => {
    const segs = creditSegments(photoCreditText(credit, false), credit)!;
    assert.deepEqual(segs.filter(s => s.url).map(s => [s.text, s.url]), [
      ['Jane Roe', credit.photographerUrl],
      ['Unsplash', credit.unsplashUrl],
    ]);
    assert.equal(segs.map(s => s.text).join(''), '📷 Photo by Jane Roe on Unsplash');
  });

  it('links them in Arabic too, so no language flag has to travel with the slide', () => {
    const segs = creditSegments(photoCreditText(credit, true), credit)!;
    assert.equal(segs.filter(s => s.url).length, 2);
    assert.equal(segs.map(s => s.text).join(''), '📷 Jane Roe · Unsplash');
  });

  it('draws plain text once the caption has been edited', () => {
    assert.equal(creditSegments('A diagram of a cell', credit), null);
    assert.equal(creditSegments(photoCreditText(credit, false) + ' (cropped)', credit), null);
  });

  it('draws plain text when there is no credit or no caption', () => {
    assert.equal(creditSegments(photoCreditText(credit, false), undefined), null);
    assert.equal(creditSegments(undefined, credit), null);
    assert.equal(creditSegments('', credit), null);
  });

  it('refuses any link that is not a plain Unsplash page', () => {
    const caption = photoCreditText(credit, false);
    for (const bad of [
      'javascript:alert(1)',
      'https://evil.example/@jane',
      'https://unsplash.com.evil.example/@jane',
      'http://unsplash.com/@jane',
      'https://unsplash.com/@jane"onmouseover="x',
    ]) {
      assert.equal(creditSegments(caption, { ...credit, photographerUrl: bad }), null, bad);
      assert.equal(creditSegments(caption, { ...credit, unsplashUrl: bad }), null, bad);
    }
  });
});

describe('creditFromPhoto', () => {
  it('needs both links, so an older server response degrades to plain text', () => {
    assert.equal(creditFromPhoto({ photographer: 'Jane Roe' }), undefined);
    assert.equal(creditFromPhoto({ photographer: 'Jane Roe', photographerUrl: credit.photographerUrl }), undefined);
    assert.deepEqual(
      creditFromPhoto({ photographer: 'Jane Roe', photographerUrl: credit.photographerUrl, unsplashLink: credit.unsplashUrl }),
      credit,
    );
  });
});
