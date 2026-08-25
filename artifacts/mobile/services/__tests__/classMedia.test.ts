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
  referencesShownVisual,
  scanGraphCommands,
  geogebraCommandUrl,
  insertVideoSlide,
  isLikelyImageUrl,
  applyMediaEdit,
  insertLessonResources,
  shouldSearchForVideo,
  nextVideoSuggestion,
  videoCaption,
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

  it('keeps a negative leading coefficient', () => {
    // `-x + 3` used to match nothing: the term charset had no place for a
    // leading sign, so half of every two-line system went unplotted.
    assert.deepEqual(extractGraphCommands('y = -x + 3'), ['y=-x + 3']);
    assert.deepEqual(extractGraphCommands('f(x) = −2x + 1'), ['f(x)=-2x + 1']);
  });

  it('reads the general form, not just `y = …`', () => {
    // Straight from the Grade 10 book's linear-quadratic system figure.
    assert.deepEqual(
      extractGraphCommands('يمثل الرسم البياني y − x² = 7 − 5x و 4y − 8x = −21'),
      ['y - x^2 = 7 - 5x', '4y - 8x = -21'],
    );
    assert.deepEqual(extractGraphCommands('المستقيمان x − y = 1 و y + x = 5'), ['x - y = 1', 'y + x = 5']);
  });

  it('emits nothing it cannot actually draw', () => {
    // GeoGebra would plot the circle; this build's static renderers cannot,
    // and a command nothing can draw would let a slide claim a figure it has
    // not got.
    assert.deepEqual(extractGraphCommands('x² + y² = 5'), []);
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

// ── nextVideoSuggestion ──────────────────────────────────────────────────────
//
// The alternatives come from the same search that produced the first pick, so
// cycling costs no extra YouTube quota. What matters here is never offering
// the teacher the video they are already looking at.

describe('nextVideoSuggestion', () => {
  const v = (id: string, title = `عنوان ${id}`) => ({
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    channelTitle: 'قناة',
  });
  const candidates = [v('aaaaaaaaaaa'), v('bbbbbbbbbbb'), v('ccccccccccc')];

  it('offers the first candidate when the slide holds something else', () => {
    const next = nextVideoSuggestion(candidates, 'https://youtu.be/zzzzzzzzzzz');
    assert.equal(next?.url, candidates[0]!.url);
  });

  it('advances from whichever candidate is currently in place', () => {
    assert.equal(nextVideoSuggestion(candidates, candidates[0]!.url)?.url, candidates[1]!.url);
    assert.equal(nextVideoSuggestion(candidates, candidates[1]!.url)?.url, candidates[2]!.url);
  });

  it('wraps around rather than dead-ending on the last one', () => {
    assert.equal(nextVideoSuggestion(candidates, candidates[2]!.url)?.url, candidates[0]!.url);
  });

  it('matches by video id, not by URL string', () => {
    // The slide may hold a youtu.be link for a candidate the search returned
    // as watch?v= — offering it back reads as a broken button.
    const next = nextVideoSuggestion(candidates, 'https://youtu.be/bbbbbbbbbbb');
    assert.equal(next?.url, candidates[2]!.url);
  });

  it('has nothing to offer when the only candidate is already in place', () => {
    assert.equal(nextVideoSuggestion([candidates[0]!], candidates[0]!.url), null);
  });

  it('has nothing to offer with no candidates', () => {
    assert.equal(nextVideoSuggestion([], 'https://youtu.be/aaaaaaaaaaa'), null);
  });

  it('still offers the single candidate when the slide holds a different video', () => {
    assert.equal(
      nextVideoSuggestion([candidates[0]!], 'https://youtu.be/zzzzzzzzzzz')?.url,
      candidates[0]!.url,
    );
  });
});

describe('videoCaption', () => {
  it('is the one definition the deck builder and the cycler share', () => {
    assert.equal(
      videoCaption({ url: 'x', title: 'شرح الاشتقاق', channelTitle: 'قناة المعلم' }),
      'شرح الاشتقاق — قناة المعلم',
    );
  });
});

// ── Lesson resources ─────────────────────────────────────────────────────────
//
// What the teacher pinned to the lesson, as opposed to what a search found.
// The store behind these predates the retirement of the home screen, which is
// where its only UI lived — Class Mode has been reading it ever since with
// nothing able to write to it.

describe('insertLessonResources', () => {
  const deck = [
    { slideNumber: 1, type: 'intro' as const, title: 'الدرس', content: '', durationSeconds: 0 },
    { slideNumber: 2, type: 'intro' as const, title: '📐 القاعدة', content: 'القاعدة', durationSeconds: 0 },
    { slideNumber: 3, type: 'challenge' as const, title: 'مثال 1', content: 'س', durationSeconds: 60 },
    { slideNumber: 4, type: 'summary' as const, title: 'ملخص', content: '', durationSeconds: 0 },
  ];
  const items = [
    { kind: 'video' as const, url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'فيديو المعلم' },
    { kind: 'image' as const, url: 'https://example.com/diagram.png', caption: 'مخطط' },
  ];

  it('lands after the teaching and before the worked examples', () => {
    const out = insertLessonResources(deck, items, true);
    const firstExample = out.findIndex(s => s.title.startsWith('مثال'));
    const firstResource = out.findIndex(s => s.type === 'media');
    assert.ok(firstResource > 1, 'after the rule');
    assert.ok(firstResource < firstExample, 'before the examples');
  });

  it('keeps the order the teacher attached them in', () => {
    // Inserting one at a time would reverse them: each lands before the same
    // first `challenge` slide.
    const out = insertLessonResources(deck, items, true);
    const kinds = out.filter(s => s.type === 'media').map(s => s.mediaKind);
    assert.deepEqual(kinds, ['video', 'image']);
  });

  it('renumbers so the deck stays consecutive', () => {
    const out = insertLessonResources(deck, items, true);
    out.forEach((s, i) => assert.equal(s.slideNumber, i + 1));
  });

  it('falls back to before the summary when there are no examples', () => {
    const noExamples = deck.filter(s => s.type !== 'challenge');
    const out = insertLessonResources(noExamples, [items[0]!], true);
    const at = out.findIndex(s => s.type === 'media');
    const summary = out.findIndex(s => s.type === 'summary');
    assert.ok(at >= 0 && at < summary);
  });

  it('changes nothing when nothing is attached', () => {
    assert.deepEqual(insertLessonResources(deck, [], true), deck);
  });
});

describe('shouldSearchForVideo', () => {
  it('searches when the teacher pinned nothing', () => {
    assert.equal(shouldSearchForVideo([]), true);
  });

  it('searches when the teacher pinned only images', () => {
    assert.equal(shouldSearchForVideo([
      { kind: 'image', url: 'https://example.com/a.png', caption: '' },
    ]), true);
  });

  it('stands down when the teacher pinned their own video', () => {
    // Their video beats a search result on the projector, and skipping the
    // call saves 100 units of a 10,000/day quota per generation.
    assert.equal(shouldSearchForVideo([
      { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', caption: '' },
      { kind: 'image', url: 'https://example.com/a.png', caption: '' },
    ]), false);
  });
});

describe('referencesShownVisual', () => {
  it('catches an Arabic question that points at a figure on the slide', () => {
    assert.ok(referencesShownVisual('في الرسم البياني الظاهر، يلتقي المستقيمان عند نقطة الحل.'));
    assert.ok(referencesShownVisual('من الشكل المجاور، أوجد الميل.'));
    assert.ok(referencesShownVisual('انظر إلى المنحنى أعلاه.'));
    assert.ok(referencesShownVisual('باستعمال التمثيل البياني الآتي، أوجد الجذور.'));
  });

  it('catches the English forms', () => {
    assert.ok(referencesShownVisual('From the graph shown, read the intersection.'));
    assert.ok(referencesShownVisual('Use the figure below to find the slope.'));
    assert.ok(referencesShownVisual('The above diagram shows two lines.'));
  });

  it('catches the verb-led claim, which carries no pointing word at all', () => {
    // Both of these projected live, past the pointing-word test, as questions
    // about a graph the slide never drew. Arabic is verb-first, so the
    // assertion sits in «يمثل» / «يوضح» rather than in a demonstrative.
    assert.ok(referencesShownVisual(
      'يمثل الرسم البياني خطين مستقيمين يتقاطعان عند النقطة التي تحقق النظام. ما حل النظام بيانياً؟',
    ));
    assert.ok(referencesShownVisual(
      'يوضح الرسم البياني خطين مستقيمين متوازيين لا يتقاطعان أبداً. ما عدد حلول هذا النظام؟',
    ));
    assert.ok(referencesShownVisual('يبيّن الشكل مثلثاً قائم الزاوية.'));
    assert.ok(referencesShownVisual('The graph shows two parallel lines.'));
  });

  it('reads a definition as a definition, not as a claim about this slide', () => {
    // «A scatter plot shows ordered pairs» explains what a scatter plot IS.
    // It was the single false positive in a sweep of the whole curriculum
    // corpus, and `the` is what tells the two apart in English.
    assert.equal(
      referencesShownVisual('A scatter plot shows ordered pairs (x,y) to reveal a relationship.'),
      false,
    );
    // Arabic verb-led forms still need a GRAPH noun after the verb.
    assert.equal(referencesShownVisual('يمثل الميل تغير y بالنسبة إلى x.'), false);
    assert.equal(referencesShownVisual('الخط الأول يمثل معادلة، والخط الثاني يمثل معادلة أخرى.'), false);
  });

  it('is not fooled by an instruction to DRAW one', () => {
    // The deixis is the whole test — matching the noun alone would flag every
    // graphing exercise in the corpus and delete it from the deck.
    assert.equal(referencesShownVisual('ارسم الرسم البياني للاقتران f(x) = x²'), false);
    assert.equal(referencesShownVisual('مثّل النظام بيانيًا ثم أوجد الحل.'), false);
    assert.equal(referencesShownVisual('Sketch the graph of y = 2x - 3.'), false);
    assert.equal(referencesShownVisual('اكتب الصيغة العامة للمعادلة التربيعية.'), false);
  });

  it('handles empty input', () => {
    assert.equal(referencesShownVisual(''), false);
    assert.equal(referencesShownVisual('   '), false);
  });
});

describe('scanGraphCommands', () => {
  it('reports what it had to refuse alongside what it kept', () => {
    const scan = scanGraphCommands('x² + y² = 5 و x − y = 1');
    assert.deepEqual(scan.commands, ['x - y = 1']);
    assert.deepEqual(scan.unplottable, ['x^2 + y^2 = 5']);
  });

  it('refuses nothing when every equation is drawable', () => {
    const scan = scanGraphCommands('y − x² = 7 − 5x و 4y − 8x = −21');
    assert.equal(scan.commands.length, 2);
    assert.deepEqual(scan.unplottable, []);
  });

  it('handles empty input', () => {
    assert.deepEqual(scanGraphCommands(''), { commands: [], unplottable: [] });
  });
});

describe('the shape the prompt teaches the model to write', () => {
  /**
   * Copied verbatim from FIGURE_RULE_AR / FIGURE_RULE_EN in
   * artifacts/api-server/src/lib/prompts.ts. The prompt tells the model to
   * imitate these sentences; this asserts that imitating them actually yields
   * a drawn graph rather than a dropped question.
   *
   * The two halves must agree across packages and nothing enforces that at
   * build time, so if the prompt's example changes, change these too — a rule
   * teaching a form that extracts nothing is the original bug wearing a
   * better sentence.
   */
  const AR = 'يمثل الرسم البياني المستقيمين y = 2x + 1 و y = -x + 4، جد نقطة تقاطعهما';
  const EN = 'The graph shows the lines y = 2x + 1 and y = -x + 4; find their intersection.';

  it('is recognised as claiming a visual, in both languages', () => {
    assert.equal(referencesShownVisual(AR), true);
    assert.equal(referencesShownVisual(EN), true);
  });

  it('yields both curves, so the claim is honoured rather than dropped', () => {
    for (const text of [AR, EN]) {
      const { commands, unplottable } = scanGraphCommands(text);
      assert.deepEqual(unplottable, [], text);
      assert.equal(commands.length, 2, text);
    }
  });

  it('would extract nothing had the rule allowed Arabic variables', () => {
    // Why the prompt insists on latin x and y: this is the same sentence with
    // «س» for x, and it is indistinguishable from naming no equations at all.
    const arabicVars = 'يمثل الرسم البياني المستقيمين y = 2س + 1 و y = -س + 4';
    assert.equal(referencesShownVisual(arabicVars), true);
    assert.deepEqual(scanGraphCommands(arabicVars).commands, []);
  });
});
