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
  attachBackgroundImage,
  buildMediaSlide,
  classifyMediaUrl,
  deckPhotoQueries,
  extractGraphCommands,
  geogebraCommandUrl,
  insertVideoSlide,
  isLikelyImageUrl,
  applyMediaEdit,
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
  it('keeps every term, not just the first', () => {
    // The body used to be matched as a run of characters that excluded
    // spaces, so it stopped at the first one: `x^3 - 4x` became `x^3` and
    // `2x + 1` became `2x`. GeoGebra drew a different curve from the one
    // written on the slide, quietly, for every multi-term function.
    assert.deepEqual(extractGraphCommands('أوجد f′(x) إذا كان f(x) = x³ − 4x.'), ['f(x)=x^3 - 4x']);
    assert.deepEqual(extractGraphCommands('y = 2x + 1'), ['y=2x + 1']);
  });

  it('still stops at prose rather than swallowing it', () => {
    // Allowing spaces in a flat run would have eaten the words after the
    // formula. Requiring an operator between terms ends the match naturally.
    assert.deepEqual(
      extractGraphCommands('y = 2x + 1 and then some english prose follows'),
      ['y=2x + 1'],
    );
  });

  it('drops a trailing full stop, which is punctuation not maths', () => {
    assert.deepEqual(extractGraphCommands('أوجد مشتقة f(x) = x².'), ['f(x)=x^2']);
  });

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

describe('attachBackgroundImage', () => {
  const titleSlide: ActivitySlide = {
    slideNumber: 1, type: 'intro', title: 'الاشتقاق', content: 'مقدمة', durationSeconds: 0,
  };
  const dividerSlide: ActivitySlide = {
    slideNumber: 2, type: 'divider', title: 'الاشتقاق', content: "Let's dig in", durationSeconds: 0,
  };

  it('sets mediaUrl/mediaCaption on the slide at the given index only', () => {
    const out = attachBackgroundImage([titleSlide, dividerSlide], 0, 'https://x.com/a.jpg', 'caption');
    assert.equal(out.length, 2);
    assert.equal(out[0].mediaUrl, 'https://x.com/a.jpg');
    assert.equal(out[0].mediaCaption, 'caption');
    assert.equal(out[0].type, 'intro', 'attaching a background does not change the slide type');
    assert.equal(out[1].mediaUrl, undefined, 'only the targeted slide is touched');
  });

  it('is a no-op for an out-of-range index — no divider slide in this deck', () => {
    const out = attachBackgroundImage([titleSlide], 1, 'https://x.com/a.jpg', 'caption');
    assert.deepEqual(out, [titleSlide]);
  });
});

describe('deckPhotoQueries', () => {
  it('returns curated queries for the Grade 10 subjects this app teaches', () => {
    const [title, divider] = deckPhotoQueries('mathematics', 'Mathematics');
    assert.match(title, /mathematics/i);
    assert.notEqual(title, divider, 'title and divider queries must differ to fetch two distinct photos');
  });

  it('falls back to a generic subject query for anything not curated', () => {
    const [title, divider] = deckPhotoQueries('islamic', 'Islamic Studies');
    assert.match(title, /Islamic Studies/);
    assert.match(divider, /Islamic Studies/);
    assert.notEqual(title, divider);
  });
});

describe('insertVideoSlide', () => {
  const intro: ActivitySlide = { slideNumber: 1, type: 'intro', title: 'مقدمة', content: '', durationSeconds: 0 };
  const rule: ActivitySlide = { slideNumber: 2, type: 'intro', title: 'القاعدة', content: '', durationSeconds: 0 };
  const example: ActivitySlide = { slideNumber: 3, type: 'challenge', title: 'مثال 1', content: '', durationSeconds: 60 };
  const summary: ActivitySlide = { slideNumber: 4, type: 'summary', title: 'ملخص', content: '', durationSeconds: 0 };
  const video = buildMediaSlide('video', 'https://youtube.com/watch?v=abc', 'caption', true, 0);

  it('inserts right before the first worked example when one exists', () => {
    const out = insertVideoSlide([intro, rule, example, summary], video);
    assert.deepEqual(out.map(s => s.type), ['intro', 'intro', 'media', 'challenge', 'summary']);
    assert.deepEqual(out.map(s => s.slideNumber), [1, 2, 3, 4, 5]);
  });

  it('falls back to right before the summary when there are no examples', () => {
    const out = insertVideoSlide([intro, rule, summary], video);
    assert.deepEqual(out.map(s => s.type), ['intro', 'intro', 'media', 'summary']);
  });

  it('appends at the end when there is neither an example nor a summary', () => {
    const out = insertVideoSlide([intro, rule], video);
    assert.deepEqual(out.map(s => s.type), ['intro', 'intro', 'media']);
  });
});

// ── applyMediaEdit ───────────────────────────────────────────────────────────
//
// The teacher's override of whatever the auto-search found. The caption is the
// dangerous field: it names the video the SEARCH returned, and it is printed
// into the PDF and PPTX, so carrying it across a URL change mislabels a video
// in the file that leaves the room.

describe('applyMediaEdit', () => {
  const videoSlide = {
    slideNumber: 9,
    type: 'media' as const,
    title: '🎬 فيديو',
    content: 'فيديو خارجي — راجعه قبل العرض',
    mediaKind: 'video' as const,
    mediaUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
    mediaCaption: 'شرح الاشتقاق — أستاذ عمر الوحيدي',
    durationSeconds: 0,
  };

  it('swaps the video and drops a caption naming the old one', () => {
    const out = applyMediaEdit(videoSlide, {
      url: 'https://youtu.be/dQw4w9WgXcQ',
      caption: videoSlide.mediaCaption,
    });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaUrl, 'https://youtu.be/dQw4w9WgXcQ');
    assert.equal(out.slide.mediaCaption, undefined,
      'the old title/channel must not survive onto a different video');
  });

  it('keeps a caption the teacher actually wrote', () => {
    const out = applyMediaEdit(videoSlide, {
      url: 'https://youtu.be/dQw4w9WgXcQ',
      caption: 'شرح من قناة المعلم نفسه',
    });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaCaption, 'شرح من قناة المعلم نفسه');
  });

  it('keeps the auto caption when only the caption is being edited', () => {
    const out = applyMediaEdit(videoSlide, {
      url: videoSlide.mediaUrl,
      caption: videoSlide.mediaCaption,
    });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaCaption, videoSlide.mediaCaption);
  });

  it('follows the URL when the kind changes', () => {
    // Pasting a picture onto a video slide converts it, rather than handing
    // the video renderer an image and printing a dead "watch" link.
    const out = applyMediaEdit(videoSlide, {
      url: 'https://images.unsplash.com/photo-1.jpg',
      caption: '',
    });
    assert.ok(out.ok);
    assert.equal(out.slide.mediaKind, 'image');
  });

  it('reads every YouTube link shape a teacher might paste', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ',
    ]) {
      const out = applyMediaEdit(videoSlide, { url, caption: '' });
      assert.ok(out.ok, url);
      assert.equal(out.slide.mediaKind, 'video', url);
    }
  });

  it('refuses what it cannot embed, and changes nothing', () => {
    for (const url of ['', '   ', 'not a url', 'https://example.com/page', 'javascript:alert(1)']) {
      const out = applyMediaEdit(videoSlide, { url, caption: 'x' });
      assert.equal(out.ok, false, url);
    }
  });

  it('leaves the original slide untouched — it returns a new one', () => {
    const before = JSON.stringify(videoSlide);
    applyMediaEdit(videoSlide, { url: 'https://youtu.be/dQw4w9WgXcQ', caption: '' });
    assert.equal(JSON.stringify(videoSlide), before);
  });
});
