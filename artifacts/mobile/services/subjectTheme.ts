// artifacts/mobile/services/subjectTheme.ts
/**
 * The colour a lesson's screen wears, from its subject. Today used to open on
 * the same navy band for every lesson, so an English lesson and a maths lesson
 * looked identical. Now:
 *  - a subject with a corner (maths, English, the sciences, Islamic studies)
 *    wears that corner's hero and motif, so Today and the corner agree;
 *  - any other subject wears its catalog colour, deepened just enough that the
 *    band's white text reads at 4.5:1 (`readableOn` against white);
 *  - no subject, or one the catalog does not know, keeps the brand band.
 * Pure (no react-native import) so `node --test` can load it.
 */
import { SUBJECTS } from '@workspace/curriculum';
import { CORNERS, type CornerId, type MotifId } from '../constants/corners.ts';
import { readableOn } from './readableColor.ts';
import type { GlyphId } from '../constants/glyphs.ts';
import type { IconName } from '../constants/icons.ts';

export type SubjectTheme = { hero: string; motif: MotifId; motifOpacity: number };

/** The logo's navy with the brand's leaf: what Today wore for every lesson. */
export const BRAND_BAND: SubjectTheme = { hero: '#0B1B33', motif: 'leaf', motifOpacity: 0.1 };

const SUBJECT_CORNER: Record<string, CornerId> = {
  mathematics: 'math',
  english: 'english',
  science: 'lab',
  physics: 'lab',
  chemistry: 'lab',
  biology: 'lab',
  'earth-science': 'lab',
  islamic: 'quran',
};

const catalogColor = (subjectId: string): string | undefined =>
  SUBJECTS.find(s => s.id === subjectId)?.color;

export function subjectTheme(subjectId: string | null | undefined): SubjectTheme {
  if (!subjectId) return BRAND_BAND;
  const cornerId = SUBJECT_CORNER[subjectId];
  if (cornerId) {
    const corner = CORNERS[cornerId];
    return { hero: corner.light.hero, motif: corner.motif, motifOpacity: corner.motifOpacity };
  }
  const color = catalogColor(subjectId);
  if (!color) return BRAND_BAND;
  return { hero: readableOn(color, '#FFFFFF'), motif: 'leaf', motifOpacity: BRAND_BAND.motifOpacity };
}

/** A subject's colour as text or a mark on `card` (a class chip), at 4.5:1. */
export function subjectChipColor(subjectId: string | null | undefined, card: string): string {
  const color = (subjectId && catalogColor(subjectId)) || '#006D65';
  return readableOn(color, card);
}

const BRAND_TEAL = '#006D65';

/**
 * What leads a lesson card (`components/generator/LessonCard`): the subject's own
 * drawing and colour. A corner subject uses its corner's drawing and hero; any
 * other uses the library drawing in its catalog colour. `icon` is the stock
 * fallback `ConceptIcon` needs beside a drawing. The caller makes the colour
 * readable on its surface (`readableOn`), as `IconTile` does.
 */
export function subjectTile(subjectId: string | null | undefined): { glyph: GlyphId; icon: IconName; color: string } {
  const cornerId = subjectId ? SUBJECT_CORNER[subjectId] : undefined;
  if (cornerId) {
    const corner = CORNERS[cornerId];
    return { glyph: corner.drawing, icon: corner.icon as IconName, color: corner.light.hero };
  }
  return { glyph: 'library', icon: 'library-outline', color: (subjectId && catalogColor(subjectId)) || BRAND_TEAL };
}
