/**
 * The media passes that turn a text-only generated deck into a projectable one.
 *
 * The fetchers are injected, so these run with no network and no API keys —
 * the same reason `verifyDeckExamples` takes its verifier as an argument.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/promptSlidesMedia.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { attachDrawnVisuals, attachSearchedMedia, deckSearchQueries } from '../promptSlidesMedia.ts';
import type { ActivitySlide, ClassroomActivity } from '../ai/AIService.ts';

const slide = (over: Partial<ActivitySlide> = {}): ActivitySlide => ({
  slideNumber: 1, type: 'intro', title: 'عنوان', content: '• سطر\n• سطر', durationSeconds: 0, ...over,
});

const deck = (slides: ActivitySlide[]): ClassroomActivity => ({
  activityName: 'عرض', activityType: 'prompt-slides', grade: 'العاشر', subject: 'الرياضيات',
  lesson: 'المستقيمات', duration: 30, difficulty: 'standard', groupType: 'whole-class',
  learningObjective: 'هدف', materials: [], teacherPreparation: '', slides,
  teacherNotes: [], answerKey: [], printables: [], assessment: '', extensionChallenge: '',
});

const photo = async (query: string) => ({ url: `https://img/${encodeURIComponent(query)}`, photographer: 'Ada' });
const noPhoto = async () => null;
const videos = async () => ([{ url: 'https://youtu.be/x', title: 'شرح', channelTitle: 'قناة' }]);
const noVideos = async () => [];

describe('attachDrawnVisuals — free, no network', () => {
  it('plots a graph when the deck states an equation in latin letters', () => {
    const out = attachDrawnVisuals(deck([
      slide({ content: 'المستقيم y = 2x + 1 يمر بالنقطة' }),
      slide({ type: 'summary', title: 'الخلاصة' }),
    ]), true);
    assert.ok(out.slides.some(s => s.type === 'graph'), 'expected a graph slide');
  });

  it('leaves a deck with no equations alone', () => {
    const before = deck([slide({ content: 'نص بلا معادلات' }), slide({ type: 'summary' })]);
    const out = attachDrawnVisuals(before, true);
    assert.equal(out.slides.length, before.slides.length);
    assert.ok(!out.slides.some(s => s.type === 'graph'));
  });

  it('does not add a second graph to a deck that already has one', () => {
    const out = attachDrawnVisuals(deck([
      slide({ content: 'y = 2x + 1' }),
      slide({ type: 'graph', title: 'رسم', graphCommands: ['y=2x+1'] }),
    ]), true);
    assert.equal(out.slides.filter(s => s.type === 'graph').length, 1);
  });

  it('renumbers after inserting, so the presenter counter stays honest', () => {
    const out = attachDrawnVisuals(deck([
      slide({ content: 'y = x^2' }),
      slide({ type: 'summary', title: 'الخلاصة' }),
    ]), true);
    out.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1));
  });
});

describe('deckSearchQueries — the deck’s topic, not the teacher’s subject', () => {
  const subjectFallback: [string, string] = ['mathematics equations chalkboard', 'geometry classroom students'];

  it('prefers the queries the model wrote about this deck', () => {
    const d = deck([slide()]);
    d.deckPhotoQueries = ['mother and child hands', 'family celebration table'];
    assert.deepEqual(deckSearchQueries(d, subjectFallback), ['mother and child hands', 'family celebration table']);
  });

  it('falls back to the subject when the model wrote none', () => {
    assert.deepEqual(deckSearchQueries(deck([slide()]), subjectFallback), subjectFallback);
  });

  it('rejects an arabic query — unsplash answers those with a 204', () => {
    // The whole reason this field is specified as English. A deck that asked
    // Unsplash for «يوم الأم» would lose both photos silently; a subject photo
    // is worse-but-working, which beats none.
    const d = deck([slide()]);
    d.deckPhotoQueries = ['يوم الأم', 'احتفال العائلة'];
    assert.deepEqual(deckSearchQueries(d, subjectFallback), subjectFallback);
  });

  it('borrows the subject’s section query when the model gave only one', () => {
    const d = deck([slide()]);
    d.deckPhotoQueries = ['mother and child hands'];
    assert.deepEqual(deckSearchQueries(d, subjectFallback), ['mother and child hands', subjectFallback[1]]);
  });
});

describe('attachSearchedMedia — photos and video', () => {
  const opts = { isAr: true, topic: 'المستقيمات', searchPhoto: photo, searchVideos: videos };

  it("uses each slide's own mediaPrompt as its photo query, beside the text", async () => {
    const out = await attachSearchedMedia(deck([
      slide(),
      slide({ mediaPrompt: 'straight line graph' }),
      slide({ type: 'summary' }),
    ]), opts);
    const illustrated = out.slides.find(s => s.mediaPrompt === 'straight line graph');
    assert.ok(illustrated?.sideImageUrl?.includes('straight'), 'photo should come from the slide’s own query');
    // Beside the text, not replacing it — `content` must survive.
    assert.ok(illustrated?.content);
    assert.match(illustrated?.sideImageCaption ?? '', /Ada/);
  });

  it('caps per-slide photos at three, however many the model asked for', async () => {
    const many = Array.from({ length: 6 }, (_, i) => slide({ mediaPrompt: `q${i}` }));
    const out = await attachSearchedMedia(deck(many), opts);
    assert.equal(out.slides.filter(s => s.sideImageUrl).length, 3);
  });

  it('searches the english queries it was given, not the arabic deck fields', async () => {
    // Unsplash is an english index: querying it with «الكسور» returns nothing,
    // which is what production logged as a 204 for every cover lookup.
    const seen: string[] = [];
    await attachSearchedMedia(deck([slide(), slide({ type: 'divider' }), slide({ type: 'summary' })]), {
      ...opts,
      photoQueries: ['mathematics education', 'mathematics classroom students'],
      searchPhoto: async (q: string) => { seen.push(q); return photo(q); },
    });
    assert.ok(seen.includes('mathematics education'));
    assert.ok(seen.includes('mathematics classroom students'));
    assert.ok(!seen.some(q => /[؀-ۿ]/.test(q)), `arabic query sent to unsplash: ${seen}`);
  });

  it('skips slides drawn in their own layout — the photo would never be shown', async () => {
    // A layout slide renders through its own branch in all three renderers and
    // never reaches the side-image column, so a photo assigned there is
    // fetched, stored, and invisible.
    const out = await attachSearchedMedia(deck([
      slide(),
      slide({ layout: 'statement', content: 'جملة', mediaPrompt: 'a photo' }),
      slide({ mediaPrompt: 'another photo' }),
      slide({ type: 'summary' }),
    ]), opts);
    const onLayout = out.slides.find(s => s.layout === 'statement');
    assert.equal(onLayout?.sideImageUrl, undefined);
    assert.ok(out.slides.find(s => s.mediaPrompt === 'another photo')?.sideImageUrl);
  });

  it('puts a hero photo on the first slide and one on the divider', async () => {
    const out = await attachSearchedMedia(deck([
      slide(), slide({ type: 'divider', title: 'القسم الثاني' }), slide({ type: 'summary' }),
    ]), opts);
    assert.ok(out.slides[0]!.mediaUrl, 'cover should carry a background photo');
    assert.ok(out.slides.find(s => s.type === 'divider')?.mediaUrl);
  });

  it('inserts one explainer video, flagged as unreviewed', async () => {
    const out = await attachSearchedMedia(deck([slide(), slide({ type: 'summary' })]), opts);
    const video = out.slides.find(s => s.mediaKind === 'video');
    assert.ok(video, 'expected a video slide');
    assert.match(video!.content, /راجعه قبل العرض/);
  });

  it('skips the video when the caller does not want one', async () => {
    const out = await attachSearchedMedia(deck([slide(), slide({ type: 'summary' })]), { ...opts, wantVideo: false });
    assert.ok(!out.slides.some(s => s.mediaKind === 'video'));
  });

  it('returns a usable deck when every lookup comes back empty', async () => {
    const before = deck([slide({ mediaPrompt: 'x' }), slide({ type: 'summary' })]);
    const out = await attachSearchedMedia(before, {
      ...opts, searchPhoto: noPhoto, searchVideos: noVideos,
    });
    assert.equal(out.slides.length, before.slides.length);
    assert.ok(!out.slides.some(s => s.sideImageUrl));
  });

  it('survives a fetcher that throws — a deck without photos beats an error', async () => {
    const boom = async () => { throw new Error('unsplash is down'); };
    const out = await attachSearchedMedia(deck([slide(), slide({ type: 'summary' })]), {
      ...opts, searchPhoto: boom, searchVideos: async () => { throw new Error('youtube is down'); },
    });
    assert.equal(out.slides.length, 2);
  });

  it('never re-illustrates a slide that already has a picture', async () => {
    const out = await attachSearchedMedia(deck([
      slide({ mediaPrompt: 'q', sideImageUrl: 'https://kept/photo.jpg' }),
      slide({ type: 'summary' }),
    ]), opts);
    assert.equal(out.slides[0]!.sideImageUrl, 'https://kept/photo.jpg');
  });
});
