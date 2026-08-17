/**
 * Class Mode graph + media helper tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/classMedia.test.ts
 *
 * The graph-command extractor is the risky one: it feeds GeoGebra directly,
 * so anything it emits gets rendered on a projector in front of a class.
 * These tests pin the conservative behaviour — real function definitions
 * only, never prose.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyMediaUrl,
  extractGraphCommands,
  geogebraCommandUrl,
  insertImageAfterTitle,
  isLikelyImageUrl,
  youtubeEmbedUrl,
  youtubeIdFrom,
} from '../classMedia.ts';
import type { ActivitySlide } from '../ai/AIService.ts';

describe('youtubeIdFrom', () => {
  it('reads watch, short, embed and shorts links', () => {
    const id = 'dQw4w9WgXcQ';
    assert.equal(youtubeIdFrom(`https://www.youtube.com/watch?v=${id}`), id);
    assert.equal(youtubeIdFrom(`https://youtu.be/${id}`), id);
    assert.equal(youtubeIdFrom(`https://www.youtube.com/embed/${id}`), id);
    assert.equal(youtubeIdFrom(`https://www.youtube.com/shorts/${id}`), id);
    assert.equal(youtubeIdFrom(`https://www.youtube.com/watch?list=x&v=${id}`), id);
  });

  it('returns null for non-YouTube urls', () => {
    assert.equal(youtubeIdFrom('https://example.com/video.mp4'), null);
    assert.equal(youtubeIdFrom(''), null);
  });
});

describe('youtubeEmbedUrl', () => {
  it('builds a nocookie embed url', () => {
    const url = youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ');
    assert.ok(url);
    assert.ok(url!.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  });

  it('returns null when the link is not YouTube', () => {
    assert.equal(youtubeEmbedUrl('https://example.com/a.png'), null);
  });
});

describe('classifyMediaUrl', () => {
  it('detects images and videos, rejects everything else', () => {
    assert.equal(classifyMediaUrl('https://x.com/diagram.png'), 'image');
    assert.equal(classifyMediaUrl('data:image/png;base64,AAA'), 'image');
    assert.equal(classifyMediaUrl('https://youtu.be/dQw4w9WgXcQ'), 'video');
    assert.equal(classifyMediaUrl('https://example.com/page'), null);
    assert.equal(classifyMediaUrl(''), null);
  });

  it('isLikelyImageUrl ignores non-http schemes', () => {
    assert.equal(isLikelyImageUrl('ftp://x/y.png'), false);
  });
});

describe('extractGraphCommands', () => {
  it('extracts function definitions', () => {
    const cmds = extractGraphCommands('ارسم f(x)=x^2 ثم g(x)=x+1');
    assert.deepEqual(cmds, ['f(x)=x^2', 'g(x)=x+1']);
  });

  it('handles y= equations without an argument', () => {
    assert.deepEqual(extractGraphCommands('المستقيم y=2x-3'), ['y=2x-3']);
  });

  it('ignores prose and constants (nothing plottable)', () => {
    assert.deepEqual(extractGraphCommands('الهدف تعرف مفهوم الاقتران المركب'), []);
    // A bare number is not a curve worth projecting.
    assert.deepEqual(extractGraphCommands('f(x)=5'), []);
  });

  it('rejects expressions with unsafe characters', () => {
    assert.deepEqual(extractGraphCommands('f(x)=<script>alert(1)</script>'), []);
  });

  it('de-duplicates and respects the max', () => {
    const cmds = extractGraphCommands('f(x)=x^2 f(x)=x^2 g(x)=x h(x)=2x y=x', 2);
    assert.equal(cmds.length, 2);
    assert.equal(new Set(cmds).size, cmds.length);
  });
});

describe('geogebraCommandUrl', () => {
  it('encodes commands into the verified calculator url', () => {
    const url = geogebraCommandUrl(['f(x)=x^2', 'g(x)=x+1']);
    assert.ok(url.startsWith('https://www.geogebra.org/calculator?command='));
    assert.ok(url.includes(encodeURIComponent('f(x)=x^2;g(x)=x+1')));
  });

  it('falls back to the blank graphing app when there is nothing to plot', () => {
    assert.equal(geogebraCommandUrl([]), 'https://www.geogebra.org/graphing');
    assert.equal(geogebraCommandUrl(['  ']), 'https://www.geogebra.org/graphing');
  });
});

describe('insertImageAfterTitle', () => {
  const titleSlide: ActivitySlide = {
    slideNumber: 1, type: 'intro', title: 'الاشتقاق', content: 'مقدمة', durationSeconds: 0,
  };
  const secondSlide: ActivitySlide = {
    slideNumber: 2, type: 'intro', title: 'الفكرة 1', content: 'نص', durationSeconds: 0,
  };

  it('inserts a media slide right after the title and renumbers', () => {
    const out = insertImageAfterTitle([titleSlide, secondSlide], 'https://x.com/a.jpg', 'caption', true);
    assert.equal(out.length, 3);
    assert.equal(out[0].title, 'الاشتقاق');
    assert.equal(out[1].type, 'media');
    assert.equal(out[1].mediaUrl, 'https://x.com/a.jpg');
    assert.equal(out[1].mediaCaption, 'caption');
    assert.equal(out[2].title, 'الفكرة 1');
    assert.deepEqual(out.map(s => s.slideNumber), [1, 2, 3]);
  });

  it('is a no-op on an empty deck', () => {
    assert.deepEqual(insertImageAfterTitle([], 'https://x.com/a.jpg', 'caption', true), []);
  });
});
