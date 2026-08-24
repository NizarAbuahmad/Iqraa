/**
 * Class Mode media helpers — graph and media slide construction.
 *
 * Phase-1 scope, deliberately: YouTube links and image URLs. Uploading
 * large video FILES needs server storage (phase 2); YouTube covers the
 * overwhelming majority of what science teachers actually project.
 */
import type { VisualBlock } from './deckVisuals.ts';
import type { ActivitySlide } from './ai/AIService.ts';

/** Blank GeoGebra Graphing app — used when there is nothing to plot. */
export const GEOGEBRA_GRAPHING_URL = 'https://www.geogebra.org/graphing';

/**
 * GeoGebra Calculator Suite with commands preloaded.
 *
 * Verified against the live site: /calculator?command=f(x)=x^2 loads the
 * function (ggbApplet.getAllObjectNames() → ['f'], "f(x) = x²"). Multiple
 * commands are separated by ';'.
 *
 * Lives here rather than in geogebra.ts so it stays free of Expo native
 * imports and can be unit-tested.
 */
export function geogebraCommandUrl(commands: string[]): string {
  const joined = commands.map(c => c.trim()).filter(Boolean).join(';');
  if (!joined) return GEOGEBRA_GRAPHING_URL;
  return `https://www.geogebra.org/calculator?command=${encodeURIComponent(joined)}`;
}

/** Extract the YouTube video id from watch / share / embed / shorts links. */
export function youtubeIdFrom(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Privacy-friendly embed URL for a YouTube link, or null if not YouTube. */
export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeIdFrom(url);
  // youtube-nocookie keeps the classroom projection out of ad personalisation.
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

export function isLikelyImageUrl(url: string): boolean {
  return /^(https?:\/\/|data:image\/)/i.test(url.trim())
    && (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url.trim()) || /^data:image\//i.test(url.trim()));
}

/** Classify a pasted URL so the teacher doesn't have to pick a type. */
export function classifyMediaUrl(url: string): 'image' | 'video' | null {
  if (!url.trim()) return null;
  if (youtubeIdFrom(url)) return 'video';
  if (isLikelyImageUrl(url)) return 'image';
  return null;
}

/**
 * Swap the media on a slide — the teacher's override of what the search found.
 *
 * Three things have to move together, and the caption is the one that bites.
 * `mediaCaption` holds «{title} — {channel}» for the video the *search*
 * returned; it is projected on the slide and printed into the PDF and PPTX.
 * Leave it in place over a new URL and the deck confidently labels one video
 * with another video's name — wrong in the file the teacher hands out, which
 * is worse than wrong on screen where they'd notice.
 *
 * So: an untouched auto-generated caption is dropped when the URL changes,
 * while a caption the teacher actually wrote is kept. `mediaKind` follows the
 * URL rather than the slide's previous kind, so pasting an image onto a video
 * slide converts it instead of handing the video renderer a picture.
 *
 * Refuses anything it cannot classify. A URL the app can't embed projects as
 * a blank frame in front of a class, and the exports would print a dead link.
 */
/**
 * A search candidate, structurally — deliberately not importing `DeckVideo`,
 * which lives behind `apiClient` and therefore behind react-native, so this
 * stays loadable by `node --test`.
 */
export type VideoSuggestion = { url: string; title: string; channelTitle: string };

/**
 * How a video is labelled on the slide and in the exports.
 *
 * One definition, used by both the deck builder and the editor's suggestion
 * cycler, so a caption written by "another suggestion" is indistinguishable
 * from one written at generation time.
 */
export function videoCaption(v: VideoSuggestion): string {
  return `${v.title} — ${v.channelTitle}`;
}

/**
 * The next candidate to offer, given what is on the slide now.
 *
 * Compares by YouTube id rather than by URL string: the current value may be
 * a `youtu.be` short link for a candidate the search returned as a `watch?v=`
 * link, and offering a teacher the video they are already looking at reads as
 * a broken button.
 *
 * Returns null when there is nothing new to show — no candidates, or the only
 * one is already in place — so the control can be hidden rather than cycling
 * to itself.
 */
export function nextVideoSuggestion(
  candidates: readonly VideoSuggestion[],
  currentUrl: string,
): VideoSuggestion | null {
  if (candidates.length === 0) return null;
  const currentId = youtubeIdFrom(currentUrl);
  const at = currentId
    ? candidates.findIndex(c => youtubeIdFrom(c.url) === currentId)
    : -1;
  if (at === -1) return candidates[0] ?? null;
  if (candidates.length === 1) return null;
  return candidates[(at + 1) % candidates.length] ?? null;
}

export type MediaEditResult =
  | { ok: true; slide: ActivitySlide }
  | { ok: false; reason: 'unsupported-url' };

export function applyMediaEdit(
  slide: ActivitySlide,
  edit: { url: string; caption: string },
): MediaEditResult {
  const url = edit.url.trim();
  const kind = classifyMediaUrl(url);
  if (!kind) return { ok: false, reason: 'unsupported-url' };

  const urlChanged = url !== (slide.mediaUrl ?? '').trim();
  const caption = edit.caption.trim();
  // "Untouched" means still byte-identical to what generation put there.
  const captionIsStale = urlChanged && caption === (slide.mediaCaption ?? '').trim();

  const next: ActivitySlide = { ...slide, type: 'media', mediaKind: kind, mediaUrl: url };
  if (captionIsStale || !caption) delete next.mediaCaption;
  else next.mediaCaption = caption;
  return { ok: true, slide: next };
}

export function buildGraphSlide(
  commands: string[],
  titleAr: string,
  isAr: boolean,
  slideNumber: number,
): ActivitySlide {
  return {
    slideNumber,
    type: 'graph',
    title: isAr ? '📈 الرسم البياني' : '📈 Graph',
    content: isAr
      ? `${titleAr}\n\nجرّب مع الطلاب: غيّر المعامل وشاهد أثره على المنحنى قبل أن تشرح السبب.`
      : `${titleAr}\n\nTry with the class: change a coefficient and watch the curve move before explaining why.`,
    graphCommands: commands,
    durationSeconds: 0,
  };
}

/**
 * A chart slide, when the lesson's own text carried a dataset.
 *
 * Financial-literacy and statistics lessons state their numbers in prose — a
 * budget split, a set of shares. `chartForLesson` refuses everything it is not
 * sure of, so this slide only appears when the text unambiguously contained
 * labelled quantities; there is no "chart placeholder" equivalent of the blank
 * calculator, because an empty chart asserts nothing and teaches nothing.
 */
export function buildChartSlide(
  visual: VisualBlock,
  titleAr: string,
  isAr: boolean,
  slideNumber: number,
): ActivitySlide {
  return {
    slideNumber,
    type: 'intro',
    title: isAr ? '📊 البيانات' : '📊 The data',
    content: isAr
      ? `${titleAr}\n\nاقرأ الرسم مع الطلاب قبل الشرح: أيّ بند الأكبر؟ ولماذا؟`
      : `${titleAr}\n\nRead the chart with the class first: which item is largest, and why?`,
    visual,
    durationSeconds: 0,
  };
}

export function buildMediaSlide(
  kind: 'image' | 'video',
  url: string,
  caption: string,
  isAr: boolean,
  slideNumber: number,
): ActivitySlide {
  return {
    slideNumber,
    type: 'media',
    // No emoji in the title: every surface that renders a media slide
    // (presentation.tsx's badge, deckSlidesHtml's header, the PPTX header
    // bar) prepends its own type emoji, so carrying one here printed it
    // twice — "🎬  🎬 فيديو".
    title: kind === 'video'
      ? (isAr ? 'فيديو' : 'Video')
      : (isAr ? 'صورة' : 'Image'),
    content: caption,
    mediaKind: kind,
    mediaUrl: url,
    mediaCaption: caption,
    durationSeconds: 0,
  };
}

/**
 * Attach an auto-fetched photo as a slide's full-bleed background rather than
 * inserting a whole extra slide — the title slide and 'divider' slides both
 * know how to render `mediaUrl` this way (see presentation.tsx / deckSlidesHtml.ts
 * / exportPptx.ts). A no-op past the slide array's length, so a caller can
 * pass a divider index that turned out not to exist without checking first.
 */
export function attachBackgroundImage(
  slides: readonly ActivitySlide[],
  index: number,
  url: string,
  caption: string,
): ActivitySlide[] {
  if (index < 0 || index >= slides.length) return [...slides];
  return slides.map((s, i) => (i === index ? { ...s, mediaUrl: url, mediaCaption: caption } : s));
}

/**
 * Curated, subject-specific Unsplash queries for the two auto-fetched deck
 * photos (title background, divider background) — a generic "{subject}
 * education" search returns usable but bland stock photography; these read
 * as if someone chose the picture on purpose. Falls back to the generic form
 * for any subject not in the Grade 10 math/chemistry/finlit set this app
 * actually teaches today.
 */
const SUBJECT_PHOTO_QUERIES: Record<string, [title: string, divider: string]> = {
  mathematics: ['mathematics equations chalkboard', 'geometry classroom students'],
  chemistry: ['chemistry laboratory experiment', 'science classroom students'],
  'financial-literacy': ['personal finance budgeting', 'financial education students'],
};

export function deckPhotoQueries(subjectId: string, subjectName: string): [title: string, divider: string] {
  return SUBJECT_PHOTO_QUERIES[subjectId] ?? [`${subjectName} education`, `${subjectName} classroom students`];
}

/**
 * Inserts a video media slide right before the first worked example — the
 * class has just met the concept and is about to attempt problems on it, so
 * a short explainer lands between "here's the idea" and "now try it
 * yourself" rather than after the deck has moved on. Falls back to right
 * before the summary, or the very end, for a deck with no examples at all.
 * Unlike `attachBackgroundImage`, a video can't double as another slide's
 * background — it needs its own slide, the same shape `buildMediaSlide`
 * already produces for a teacher's manually pasted video.
 */
export function insertVideoSlide(
  slides: readonly ActivitySlide[],
  mediaSlide: ActivitySlide,
): ActivitySlide[] {
  const beforeExamples = slides.findIndex(s => s.type === 'challenge');
  const beforeSummary = slides.findIndex(s => s.type === 'summary');
  const insertAt = beforeExamples >= 0 ? beforeExamples : beforeSummary >= 0 ? beforeSummary : slides.length;
  const next = [...slides.slice(0, insertAt), mediaSlide, ...slides.slice(insertAt)];
  return next.map((s, i) => ({ ...s, slideNumber: i + 1 }));
}

/** What a teacher pinned to a lesson — the shape `lessonMedia` stores. */
export type AttachedResource = { kind: 'image' | 'video'; url: string; caption: string };

/**
 * Put the teacher's own resources into a generated deck.
 *
 * Same slot the auto-found video uses — after the teaching, before the worked
 * examples — and the batch goes in together so a teacher who attached three
 * things sees them in the order they attached them. Inserting one at a time
 * would reverse them, because each insert lands before the same first
 * `challenge` slide.
 */
export function insertLessonResources(
  slides: readonly ActivitySlide[],
  items: readonly AttachedResource[],
  isAr: boolean,
): ActivitySlide[] {
  if (items.length === 0) return [...slides];
  const beforeExamples = slides.findIndex(s => s.type === 'challenge');
  const beforeSummary = slides.findIndex(s => s.type === 'summary');
  const at = beforeExamples >= 0 ? beforeExamples : beforeSummary >= 0 ? beforeSummary : slides.length;
  const built = items.map(m => buildMediaSlide(m.kind, m.url, m.caption, isAr, 0));
  return [...slides.slice(0, at), ...built, ...slides.slice(at)]
    .map((s, i) => ({ ...s, slideNumber: i + 1 }));
}

/**
 * Whether to go looking for a video at all.
 *
 * The search exists to fill a gap, not to compete with the teacher. If they
 * pinned their own video to this lesson, a second one from a search is noise
 * on the projector — and skipping the call also saves 100 units of a
 * 10,000/day YouTube quota every time a curated lesson is generated.
 */
export function shouldSearchForVideo(items: readonly AttachedResource[]): boolean {
  return !items.some(i => i.kind === 'video');
}

/**
 * Pull plottable expressions out of lesson text so the graph slide opens on
 * something real. Conservative on purpose: only well-formed function
 * definitions (f(x)=…) and simple y=… equations, so we never feed GeoGebra
 * prose that would render an error in front of a class.
 */
export function extractGraphCommands(text: string, max = 3): string[] {
  if (!text) return [];
  // Generated math uses typographic characters GeoGebra won't parse:
  // superscripts and the true minus sign. Normalise before matching.
  text = text
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[−–—]/g, '-');
  const out: string[] = [];
  // The body is matched as a real expression — a term, then any number of
  // (operator, term) pairs — rather than a flat run of math-safe characters.
  //
  // The flat version excluded spaces, so it stopped at the first one: `x^3 -
  // 4x` became `x^3` and `2x + 1` became `2x`. GeoGebra was drawing a
  // different curve from the one on the slide, quietly, for every
  // multi-term function in the corpus. Allowing spaces inside a flat run
  // would have been worse — it would swallow the English prose after the
  // formula — but requiring an operator between terms stops naturally at
  // `1 and then…` while keeping `x^3 - 4x` whole.
  const term = '[0-9a-z^().√π]+';
  // A leading unary minus is part of the first term, not an operator between
  // two of them. Without this `y = -x + 3` matched nothing at all — an
  // ordinary line with a negative slope, so a two-line system was projected
  // with one line missing and no error anywhere.
  const re = new RegExp(
    `([fghy])\\s*(\\([a-z]\\))?\\s*=\\s*(-?\\s*${term}(?:\\s*[+\\-*/]\\s*${term})*)`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < max) {
    const name = m[1]!;
    const arg = m[2] ?? (name.toLowerCase() === 'y' ? '' : '(x)');
    // A trailing full stop is sentence punctuation, never part of the maths.
    const body = m[3]!.trim().replace(/[.\s]+$/, '').replace(/^-\s*/, '-');
    // A constant is not a curve worth projecting — require a variable.
    if (!/[a-z]/i.test(body)) continue;
    const cmd = `${name}${arg}=${body}`;
    if (!out.includes(cmd)) out.push(cmd);
  }
  return out;
}

/**
 * Words that make a slide's text point AT a picture — «الشكل الظاهر»,
 * «الرسم البياني أعلاه», "the graph shown".
 *
 * The deixis is the whole test, and it is why this is two halves rather than
 * a list of nouns. «ارسم الرسم البياني للاقتران» is an instruction to draw
 * one; «في الرسم البياني الظاهر» is a claim that one is already on the
 * screen. Only the second can be wrong, and only the second is what this
 * looks for — matching the noun alone would flag every graphing exercise in
 * the corpus.
 */
const SHOWN_VISUAL_AR = new RegExp(
  '(?:الرسم\\s*البياني|التمثيل\\s*البياني|المنحنى|الرسمة|الشكل|المخطط|الرسم)'
  + '\\s*(?:ال(?:ظاهر|مجاور|موضّح|موضح|مرفق|معروض|آتي|تالي|سابق)[\\u0600-\\u06FF]*'
  + '|أعلاه|أدناه|أمامكم|أمامك)',
  'u',
);

const VISUAL_NOUN_EN = '(?:graph|figure|diagram|chart|plot|curve|sketch|image|picture)';
const SHOWN_VISUAL_EN = new RegExp(
  `\\b${VISUAL_NOUN_EN}\\s+(?:shown|above|below|opposite|attached|displayed|here`
  + `|on\\s+(?:the\\s+)?(?:screen|slide|board))\\b`
  + `|\\b(?:above|below|shown|attached|adjacent|following)\\s+${VISUAL_NOUN_EN}\\b`,
  'i',
);

/**
 * Whether a slide's text asserts that a picture is already on screen.
 *
 * A question that opens «في الرسم البياني الظاهر…» is unanswerable when the
 * slide shows no graph — the class is told to read coordinates off something
 * that is not there. Generated checks make that claim on their own, so the
 * deck has to notice it: either the picture gets drawn (the question's own
 * equations are plottable) or the question does not project at all.
 */
export function referencesShownVisual(text: string): boolean {
  const s = (text ?? '').trim();
  if (!s) return false;
  return SHOWN_VISUAL_AR.test(s) || SHOWN_VISUAL_EN.test(s);
}
