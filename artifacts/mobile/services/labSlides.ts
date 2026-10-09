/**
 * Science Lab items as deck slides — pure, so `node --test` can load it.
 *
 * Nothing here is a new slide kind. A law is an ordinary `intro` slide; an
 * external image or video is a `media` slide made by `buildMediaSlide`; an
 * interactive is a `media` slide of kind `document` that carries the share
 * link, because the deck cannot run a component.
 *
 * Two things about the deck's own text helpers shaped the notation (measured
 * 2026-10-07; `labSlides.test.ts` re-checks every shipped law on every run):
 *  - a bare `m/s²` (alone, or after a colon) parses as a stacked fraction. Inside
 *    «a — Acceleration (m/s²)» it does not, but a unit with a slash is still
 *    written as a negative power, `m·s⁻²`, so no layout can stack it;
 *  - `ₐ` falls outside the right-to-left isolate, so a subscript letter is
 *    written as the plain capital, `NA`.
 * Quantity lines are bullets: a bullet is never drawn as a boxed equation.
 *
 * A slide never carries unlicensed or uncredited media: an external item with
 * no attribution, or whose licence does not allow showing it, makes no slide.
 * The credit goes in `content` AND `mediaCaption` — the presenter reads one,
 * the PDF and PPTX the other (`buildMediaSlide` sets both from one caption).
 *
 * Spec: docs/superpowers/specs/2026-10-07-lab-class-workflow-design.md
 */
import {
  getLabItem,
  labItemsForLesson,
  type LabExternalItem,
  type LabItem,
  type LabLawItem,
} from '@workspace/curriculum/lab';
import { getExternalResource, type ExternalResource } from '@workspace/curriculum/external';
import { usePolicy } from '@workspace/curriculum/bank';
import type { ActivitySlide } from './ai/AIService.ts';
import { buildMediaSlide, youtubeIdFrom } from './classMedia.ts';
import { labShareUrl } from './labLinks.ts';

const SUPERSCRIPT: Record<string, string> = { '': '¹', '²': '²', '³': '³' };

/** `m/s²` → `m·s⁻²`; a unit with no slash, or one this cannot read, is unchanged. */
export function unitForSlide(unit: string): string {
  if (!unit.includes('/')) return unit;
  const [head, ...tails] = unit.split('/');
  const powers: string[] = [];
  for (const tail of tails) {
    const m = /^([A-Za-z]+)([²³])?$/.exec(tail.trim());
    if (!m) return unit;
    powers.push(`${m[1]}⁻${SUPERSCRIPT[m[2] ?? '']}`);
  }
  return [head!.trim(), ...powers].join('·');
}

const SUBSCRIPT_LETTER: Record<string, string> = { 'ₐ': 'A', 'ₑ': 'E', 'ₒ': 'O', 'ₓ': 'X' };

/** Subscript letters as plain capitals; digit subscripts (`H₂O`) are left as they are. */
export function slideSymbol(text: string): string {
  return text.replace(/[ₐₑₒₓ]/g, ch => SUBSCRIPT_LETTER[ch] ?? ch);
}

/** One equation per line: a card that holds several writes them as `a ,  b ,  c`. */
export function lawFormulaLines(item: LabLawItem): string[] {
  return item.formula
    .split(/\s+,\s+/)
    .map(part => slideSymbol(part).trim())
    .filter(Boolean);
}

function buildLawSlide(item: LabLawItem, isAr: boolean, slideNumber: number): ActivitySlide {
  const quantityLines = item.quantities.map(
    q => `• ${slideSymbol(q.symbol)} — ${q.nameEn} (${unitForSlide(q.unit)})`,
  );
  // Lesson vocabulary is Arabic, copied verbatim; the title is already one of the terms.
  const terms = isAr ? item.termsAr.filter(term => term !== item.titleAr) : [];
  const content = [
    ...lawFormulaLines(item),
    '',
    ...quantityLines,
    ...(terms.length ? ['', ...terms.map(term => `• ${term}`)] : []),
  ].join('\n');
  return {
    slideNumber,
    type: 'intro',
    title: `📐 ${isAr ? item.titleAr : item.titleEn}`,
    content,
    durationSeconds: 0,
  };
}

function buildExternalSlide(
  item: LabExternalItem,
  isAr: boolean,
  slideNumber: number,
  resolve: (id: string) => ExternalResource | undefined,
): ActivitySlide | null {
  const res = resolve(item.externalId);
  if (!res) return null;
  const credit = (res.attribution ?? '').trim();
  if (!credit) return null;
  const policy = usePolicy({ authority: res.authority, license: res.license });
  const caption = `${isAr ? res.titleAr : res.titleEn} — ${credit}`;

  if (res.kind === 'image') {
    // `fetchUrl` is a stable public URL; the presigned `/media/external/:id`
    // link lasts an hour and would break a saved deck.
    if (policy !== 'quotable' || !res.fetchUrl) return null;
    return buildMediaSlide('image', res.fetchUrl, caption, isAr, slideNumber);
  }
  if (res.kind === 'video') {
    if (policy !== 'embed-only' || res.provider !== 'youtube' || !youtubeIdFrom(res.sourceUrl)) return null;
    return buildMediaSlide('video', res.sourceUrl, caption, isAr, slideNumber);
  }
  return null;
}

/** The slide for one lab item, or null when it may not or cannot be shown. */
export function buildLabSlide(
  item: LabItem,
  isAr: boolean,
  slideNumber: number,
  resolve: (id: string) => ExternalResource | undefined = getExternalResource,
): ActivitySlide | null {
  switch (item.kind) {
    case 'law':
      return buildLawSlide(item, isAr, slideNumber);
    case 'interactive':
      return buildMediaSlide('document', labShareUrl(item.id), isAr ? item.titleAr : item.titleEn, isAr, slideNumber);
    case 'external':
      return buildExternalSlide(item, isAr, slideNumber, resolve);
    default:
      return null;
  }
}

/** Slides for the picked ids, in the order picked. Unknown ids and refused items are skipped. */
export function labSlidesFor(itemIds: readonly string[], isAr: boolean): ActivitySlide[] {
  const out: ActivitySlide[] = [];
  for (const id of itemIds) {
    const item = getLabItem(id);
    const slide = item ? buildLabSlide(item, isAr, 0) : null;
    if (slide) out.push(slide);
  }
  return out;
}

/** The lesson's lab items that can produce a slide — what the deck picker offers. */
export function deckableLabItems(lessonId: string, isAr: boolean): LabItem[] {
  return labItemsForLesson(lessonId).filter(item => buildLabSlide(item, isAr, 0) !== null);
}
