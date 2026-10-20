/**
 * The per-slide text edit, shared by Slides and Prompt Slides.
 *
 * Each screen carried its own copy and they had drifted: Slides dropped the
 * verifier's badge when the question or answer changed, Prompt Slides kept
 * it — vouching for text nothing checked; Prompt Slides left a question
 * slide's answer alone (it lives in options/correctIndex), Slides did not.
 * This is the union of both rules.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { ActivitySlide } from './ai/AIService.ts';
import type { PhotoCredit } from './photoCredit.ts';

/**
 * Where a slide's picture lives, or null where no renderer would show one.
 *
 * - `side`: beside the text (`sideImageUrl`) — the ordinary content slides,
 *   the only ones all three renderers draw a side picture on.
 * - `background`: behind the cover and the section dividers (`mediaUrl`).
 * - `media`: a picture slide — the picture IS the slide (`mediaUrl`), so it
 *   can be swapped but not removed; deleting the slide is how it goes.
 *
 * Questions, challenges and graphs lay their own content out and never reach
 * a picture column; offering one there would store a photo nobody sees.
 */
export type PictureSlot = 'side' | 'background' | 'media';

export function pictureSlot(slide: ActivitySlide, index: number): PictureSlot | null {
  if (slide.type === 'media') return slide.mediaKind === 'image' ? 'media' : null;
  if (slide.type === 'divider' || (index === 0 && slide.type === 'intro')) return 'background';
  if (slide.type === 'intro' || slide.type === 'reveal' || slide.type === 'summary') return 'side';
  return null;
}

export interface SlidePicture {
  url: string;
  caption?: string;
  /** Unsplash's linked credit; only for a suggested photo. */
  credit?: PhotoCredit;
}

/** The picture a slide shows now, in the slot it shows it. */
export function slidePicture(slide: ActivitySlide, index: number): SlidePicture | null {
  const slot = pictureSlot(slide, index);
  if (!slot) return null;
  const [url, caption, credit] = slot === 'side'
    ? [slide.sideImageUrl, slide.sideImageCaption, slide.sideImageCredit]
    : [slide.mediaUrl, slide.mediaCaption, slide.mediaCredit];
  return url ? { url, ...(caption ? { caption } : {}), ...(credit ? { credit } : {}) } : null;
}

/**
 * The slide with `picture` in its slot — or with its picture removed (`null`).
 *
 * A side picture wins over a laid-out slide: a layout (cards, table, steps…)
 * fills the slide in every renderer and has no column for a picture, so the
 * layout is dropped and the bullets — kept in `content` for exactly this — are
 * drawn beside the picture. `photo` is the one layout that IS its picture.
 */
export function withSlidePicture(slide: ActivitySlide, index: number, picture: SlidePicture | null): ActivitySlide {
  const slot = pictureSlot(slide, index);
  if (!slot || (slot === 'media' && !picture)) return slide;
  if (slot === 'side') {
    const { sideImageUrl: _u, sideImageCaption: _c, sideImageCredit: _k, ...rest } = slide;
    if (!picture) {
      if (rest.layout === 'photo') delete rest.layout;
      return rest;
    }
    if (rest.layout && rest.layout !== 'photo') delete rest.layout;
    return {
      ...rest,
      sideImageUrl: picture.url,
      ...(picture.caption ? { sideImageCaption: picture.caption } : {}),
      ...(picture.credit ? { sideImageCredit: picture.credit } : {}),
    };
  }
  const { mediaUrl: _u, mediaCaption: _c, mediaCredit: _k, ...rest } = slide;
  if (!picture) return rest;
  return {
    ...rest,
    mediaUrl: picture.url,
    ...(slot === 'media' ? { mediaKind: 'image' as const } : {}),
    ...(picture.caption ? { mediaCaption: picture.caption } : {}),
    ...(picture.credit ? { mediaCredit: picture.credit } : {}),
  };
}

export type SlideTextEdit = { title: string; content: string; answer: string };

export function applySlideTextEdit(s: ActivitySlide, edit: SlideTextEdit): ActivitySlide {
  const answer = edit.answer.trim();
  const next: ActivitySlide = { ...s, title: edit.title.trim() || s.title, content: edit.content };
  // An emptied answer removes the reveal button rather than revealing "".
  if (s.type !== 'question' && (s.answer !== undefined || answer)) {
    if (answer) next.answer = answer; else delete next.answer;
  }
  // Changing the question or the answer invalidates whatever proof the
  // verifier gave the ORIGINAL pair. Title edits keep it; the maths is untouched.
  if (next.content !== s.content || next.answer !== s.answer) {
    delete next.verified;
    delete next.verifiedBy;
    delete next.computedAnswer;
  }
  return next;
}
