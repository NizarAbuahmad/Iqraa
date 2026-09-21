/**
 * Puts real pictures, a real video and drawn visuals onto a generated deck.
 *
 * None of this is new machinery. The older Slides Maker
 * (`app/ai-tools/slides.tsx`) has run these same passes in production all
 * along — Unsplash for the hero and the section break, YouTube for one
 * explainer, and the equation/data extractors for a drawn graph or chart. The
 * prompt-slides screen shipped without any of them, which is most of why its
 * decks read as empty next to the older tool's.
 *
 * What is new here is the per-slide pass. The model is asked for a
 * `mediaPrompt` — a short English photo-search phrase — on the few slides where
 * a picture earns its place, and that phrase becomes the search query for THAT
 * slide. The result lands in `sideImageUrl`, so the picture sits beside the
 * text instead of replacing it: a render path every one of the three renderers
 * already supports and nothing had ever asked for.
 *
 * The fetchers are parameters rather than imports so this file can be tested by
 * the bare `node --test` runner — the same reason `verifyDeckExamples` takes
 * its verifier as an argument.
 */
import type { ActivitySlide, ClassroomActivity } from './ai/AIService.ts';
import {
  attachBackgroundImage,
  buildChartSlide,
  buildGraphSlide,
  buildMediaSlide,
  extractGraphCommands,
  insertVideoSlide,
  videoCaption,
} from './classMedia.ts';
import { chartForLesson } from './deckVisuals.ts';

/** Matches `searchDeckPhoto` in `services/unsplashImage.ts`. */
export type PhotoSearch = (query: string) => Promise<{
  url: string;
  photographer: string;
} | null>;

/** Matches `searchDeckVideos` in `services/youtubeVideo.ts`. */
export type VideoSearch = (query: string, lang: 'ar' | 'en') => Promise<{
  url: string;
  title: string;
  channelTitle: string;
}[]>;

export type EnrichOptions = {
  isAr: boolean;
  /** Free text the photo/video queries fall back to — the deck's own topic. */
  topic: string;
  /**
   * ENGLISH photo-search queries for the cover and the section break.
   *
   * Unsplash is an English-language index: searching it for «الكسور» returns
   * nothing at all, which is exactly what the first version of this file did
   * and why production logged a 204 for every cover lookup while the
   * English per-slide queries beside them came back 200. The caller builds
   * these from `deckPhotoQueries(subjectId, englishSubjectName)` — the same
   * hardcoded English map the older Slides Maker has always used.
   */
  photoQueries?: [cover: string, section: string];
  searchPhoto: PhotoSearch;
  searchVideos: VideoSearch;
  /** Off when the teacher pinned their own media, matching Slides Maker. */
  wantVideo?: boolean;
};

/** Ceiling on per-slide photo lookups — one Unsplash call each. */
const MAX_SIDE_PHOTOS = 3;

/**
 * The cover and section-break queries for THIS deck, preferring the ones the
 * model wrote about the deck's own topic.
 *
 * The fallback is `deckPhotoQueries(subjectId, subjectName)`, which keys off
 * the curriculum subject. In the older Slides Maker that subject IS the deck's
 * topic, so it is the right answer there. Here it is only the teacher's
 * profile, and a deck about Mother's Day built by a maths teacher searched
 * Unsplash for "mathematics equations chalkboard" — a real photo, fetched and
 * shown, with nothing to do with the deck. A wrong picture reads as a broken
 * feature just as much as a missing one does.
 *
 * The latin-script gate is the part that matters. Unsplash is an English
 * index: «يوم الأم» returns a 204, so a model that answers in the deck's
 * language instead of English would silently cost the deck both photos. When
 * that happens the subject fallback is worse-but-working, which beats nothing.
 */
export function deckSearchQueries(
  deck: ClassroomActivity,
  fallback: [cover: string, section: string],
): [cover: string, section: string] {
  const usable = deckQueries(deck);
  if (usable.length === 0) return fallback;
  return [usable[0]!, usable[1] ?? fallback[1]];
}

/** The deck-level queries that are actually searchable — English, non-empty. */
function deckQueries(deck: ClassroomActivity): string[] {
  return (deck.deckPhotoQueries ?? [])
    .map(q => (typeof q === 'string' ? q.trim() : ''))
    .filter(q => q.length > 0 && !/[؀-ۿ]/.test(q));
}

/**
 * Types whose body is prose, and so the only ones a side photo can sit beside.
 * Mirrors `PROSE_TYPES` in `promptSlidesPolish.ts` for the same reason: every
 * other type's own branch fills the slide before the side-image column.
 */
const PHOTOGRAPHABLE = new Set<ActivitySlide['type']>(['intro', 'reveal']);

/**
 * Slides to illustrate when the model asked for none.
 *
 * Measured, not guessed. A production deck at 12:09 made exactly two Unsplash
 * calls — the cover and the section break — because not one slide carried a
 * `mediaPrompt`: the rule asked for it "only where a picture adds meaning",
 * and the model read that permission as licence to skip it entirely. The same
 * deck filled `deckPhotoQueries` perfectly, because that is a required array
 * in the skeleton.
 *
 * So the floor stops depending on the optional field. The prompt now asks for
 * four deck queries instead of two, and the spares land here — on the content
 * slides nearest the middle of the deck, which are the ones a class actually
 * dwells on. If the model did its job and wrote `mediaPrompt`s, this never
 * runs: those are specific to their slide and always better than a spare.
 */
function fallbackPhotoSlides(
  slides: readonly ActivitySlide[],
  queries: readonly string[],
): { slide: ActivitySlide; index: number; query: string }[] {
  if (queries.length === 0) return [];
  const eligible = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide, index }) => (
      index > 0
      && PHOTOGRAPHABLE.has(slide.type)
      && !slide.layout && !slide.sideImageUrl && !slide.mediaUrl && !slide.visual
      && (slide.content ?? '').trim().length > 0
    ));
  // From the middle outwards: slide 2 is usually the hook and the last content
  // slide usually runs into the summary, so neither is where a picture earns
  // the most.
  const mid = Math.floor(eligible.length / 2);
  return eligible
    .slice(mid)
    .concat(eligible.slice(0, mid))
    .slice(0, queries.length)
    .map((e, i) => ({ ...e, query: queries[i]! }));
}

function photoCredit(photographer: string, isAr: boolean): string {
  return isAr ? `📷 ${photographer} · Unsplash` : `📷 Photo by ${photographer} on Unsplash`;
}

/**
 * Drawn visuals, which cost nothing: no network, no AI, no key.
 *
 * Runs over the deck's own generated text. A maths deck that states
 * `y = 2x + 1` gets the curve plotted; a deck quoting percentages gets a
 * chart. This is why the prompt insists on latin `x`/`y` even inside Arabic
 * prose — `extractGraphCommands` cannot read «س».
 */
export function attachDrawnVisuals(deck: ClassroomActivity, isAr: boolean): ClassroomActivity {
  const text = deck.slides.map(s => `${s.title}\n${s.content}`).join('\n');
  let slides = [...deck.slides];

  const commands = extractGraphCommands(text);
  if (commands.length > 0 && !slides.some(s => s.type === 'graph')) {
    const at = slides.findIndex(s => s.type === 'challenge' || s.type === 'summary');
    const graph = buildGraphSlide(commands, isAr ? 'الرسم البياني' : 'The graph', isAr, 0);
    slides = insertAt(slides, graph, at);
  }

  const chart = chartForLesson(text);
  if (chart && !slides.some(s => s.visual)) {
    const at = slides.findIndex(s => s.type === 'summary');
    const chartSlide = buildChartSlide(chart, isAr ? 'الأرقام أمامنا' : 'The numbers', isAr, 0);
    slides = insertAt(slides, chartSlide, at);
  }

  return slides === deck.slides ? deck : { ...deck, slides: renumber(slides) };
}

function insertAt(slides: ActivitySlide[], slide: ActivitySlide, index: number): ActivitySlide[] {
  const at = index >= 0 ? index : slides.length;
  return [...slides.slice(0, at), slide, ...slides.slice(at)];
}

function renumber(slides: readonly ActivitySlide[]): ActivitySlide[] {
  return slides.map((s, i) => ({ ...s, slideNumber: i + 1 }));
}

/**
 * The network passes: a hero photo, a section photo, per-slide photos, and one
 * explainer video.
 *
 * Every lookup is allowed to fail. A deck with no pictures is worse than one
 * with pictures, but far better than an error where a deck should be — so
 * nothing in here rejects, and a `null` result simply leaves the slide as the
 * model wrote it.
 */
export async function attachSearchedMedia(
  deck: ClassroomActivity,
  opts: EnrichOptions,
): Promise<ClassroomActivity> {
  const { isAr, topic, searchPhoto, searchVideos } = opts;
  const lang = isAr ? 'ar' : 'en';
  let slides: ActivitySlide[] = [...deck.slides];

  // Slides the model itself flagged as wanting a picture, capped.
  //
  // Slides carrying a `layout` are excluded: those are drawn by their own
  // branch in each renderer, which fills the slide and never reaches the
  // side-image column — a photo assigned there would be fetched, stored and
  // silently never shown.
  const asked = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => (
      typeof slide.mediaPrompt === 'string' && slide.mediaPrompt.trim()
      && !slide.sideImageUrl && !slide.layout
    ))
    .slice(0, MAX_SIDE_PHOTOS)
    .map(e => ({ ...e, query: e.slide.mediaPrompt!.trim() }));

  // Nothing asked for a picture — put the deck's spare queries on content
  // slides rather than shipping a deck whose only two images are the cover and
  // the section break. See `fallbackPhotoSlides`.
  const wantPhotos = asked.length > 0
    ? asked
    : fallbackPhotoSlides(slides, deckQueries(deck).slice(2, 2 + MAX_SIDE_PHOTOS));

  const [coverQuery, sectionQuery] = opts.photoQueries ?? [deck.lesson || topic, `${deck.subject || topic} classroom`];
  const [hero, section, sidePhotos, videos] = await Promise.all([
    safePhoto(searchPhoto, coverQuery),
    safePhoto(searchPhoto, sectionQuery),
    Promise.all(wantPhotos.map(({ query }) => safePhoto(searchPhoto, query))),
    opts.wantVideo === false ? Promise.resolve([]) : safeVideos(searchVideos, videoQuery(deck, topic, isAr), lang),
  ]);

  wantPhotos.forEach(({ index }, i) => {
    const photo = sidePhotos[i];
    if (!photo) return;
    // Beside the text, not instead of it — and the credit rides along, which
    // is both the Unsplash licence requirement and the thing three renderers
    // have dropped before (see the attribution note in CLAUDE.md's neighbours).
    slides[index] = {
      ...slides[index],
      sideImageUrl: photo.url,
      sideImageCaption: photoCredit(photo.photographer, isAr),
    };
  });

  if (hero) {
    slides = attachBackgroundImage(slides, 0, hero.url, photoCredit(hero.photographer, isAr));
  }
  const dividerIdx = slides.findIndex(s => s.type === 'divider');
  if (section && dividerIdx >= 0) {
    slides = attachBackgroundImage(slides, dividerIdx, section.url, photoCredit(section.photographer, isAr));
  }

  const video = videos[0];
  if (video) {
    const slide = buildMediaSlide('video', video.url, videoCaption(video), isAr, 0);
    slides = insertVideoSlide(slides, {
      ...slide,
      content: isAr ? 'فيديو خارجي — راجعه قبل العرض' : 'External video — preview before class',
    });
  }

  return { ...deck, slides: renumber(slides) };
}

function videoQuery(deck: ClassroomActivity, topic: string, isAr: boolean): string {
  const subject = deck.subject || '';
  const lesson = deck.lesson || topic;
  return isAr ? `شرح ${lesson} ${subject}`.trim() : `${lesson} ${subject} explained`.trim();
}

async function safePhoto(search: PhotoSearch, query: string) {
  if (!query.trim()) return null;
  try {
    return await search(query.trim());
  } catch {
    return null;
  }
}

async function safeVideos(search: VideoSearch, query: string, lang: 'ar' | 'en') {
  if (!query.trim()) return [];
  try {
    return await search(query.trim(), lang);
  } catch {
    return [];
  }
}
