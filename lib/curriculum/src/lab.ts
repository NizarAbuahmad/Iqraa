/**
 * Science Lab items — what a teacher can put on the projector for one lesson.
 *
 * Three kinds, deliberately few:
 *  - `interactive`: a first-party component (periodic table, mole calculator,
 *    vector addition). Nothing licensed, so no licence fields.
 *  - `law`: a formula card. The formula and quantities are latin symbols; the
 *    only Arabic on it is lesson vocabulary copied verbatim (`termsAr`), which
 *    a test checks against the lesson. No Arabic prose is written by us.
 *  - `external`: a pointer to an entry in `external.ts`. The licence and
 *    `licenseCheckedAt` live on that entry and nowhere else, so there is one
 *    place to re-check them.
 *
 * Book figures are not listed here; the screen joins them from
 * `figuresForLesson` at render time.
 *
 * Items carry the `kbl-*` lesson id, never a title, and the subject the item is
 * filed under must agree with its lesson (enforced in `lab.test.ts`).
 */
import raw from './data/lab_items.json' with { type: 'json' };
import { getExternalResource } from './external.ts';

export const LAB_INTERACTIVE_IDS = ['periodic-table', 'mole-calculator', 'vector-addition'] as const;
export type LabInteractiveId = (typeof LAB_INTERACTIVE_IDS)[number];

export type LabItemKind = 'interactive' | 'law' | 'external';

interface LabItemBase {
  /** Stable slug, used in the present-mode URL. */
  id: string;
  /** `grade-*` id from `GRADES`. */
  gradeId: string;
  /** A `SUBJECTS` id. */
  subjectId: string;
  /** `kbl-*` lesson id. */
  lessonId: string;
  titleAr: string;
  titleEn: string;
}

export interface LabInteractiveItem extends LabItemBase {
  kind: 'interactive';
  origin: 'original';
  interactiveId: LabInteractiveId;
}

export interface LabQuantity {
  symbol: string;
  nameEn: string;
  unit: string;
}

export interface LabLawItem extends LabItemBase {
  kind: 'law';
  origin: 'original';
  /** Latin symbols. Converted to Arabic digits only at display time. */
  formula: string;
  quantities: LabQuantity[];
  /** Arabic vocabulary terms of the lesson, copied verbatim. */
  termsAr: string[];
}

export interface LabExternalItem extends LabItemBase {
  kind: 'external';
  /** An `ExternalResource.id` in `external_resources.json`. */
  externalId: string;
}

export type LabItem = LabInteractiveItem | LabLawItem | LabExternalItem;

export const LAB_ITEMS: LabItem[] = raw.items as unknown as LabItem[];

export function getLabItem(id: string): LabItem | undefined {
  return LAB_ITEMS.find(i => i.id === id);
}

/** Every lab item filed on one lesson, in manifest order. */
export function labItemsForLesson(lessonId: string): LabItem[] {
  if (!lessonId) return [];
  return LAB_ITEMS.filter(i => i.lessonId === lessonId);
}

export interface LabFilter {
  gradeId?: string;
  subjectId?: string;
  kind?: LabItemKind;
}

export function filterLabItems(f: LabFilter = {}, items: readonly LabItem[] = LAB_ITEMS): LabItem[] {
  return items.filter(
    i =>
      (!f.gradeId || i.gradeId === f.gradeId) &&
      (!f.subjectId || i.subjectId === f.subjectId) &&
      (!f.kind || i.kind === f.kind),
  );
}

/**
 * Structural problems that make an item unusable, as messages. Same posture as
 * `validateExternalResources`: this reports and the test decides. Whether the
 * lesson exists and whether a term is in its vocabulary needs the catalog, so
 * those checks live in `lab.test.ts`.
 */
export function validateLabItems(items: readonly LabItem[] = LAB_ITEMS): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${item.id}: duplicate id`);
    seen.add(item.id);
    if (!item.gradeId.startsWith('grade-')) errors.push(`${item.id}: "${item.gradeId}" is not a grade-* id`);
    if (!item.subjectId) errors.push(`${item.id}: no subjectId`);
    if (!item.lessonId.startsWith('kbl-')) errors.push(`${item.id}: "${item.lessonId}" is not a kbl-* lesson id`);
    if (!item.titleAr.trim() || !item.titleEn.trim()) errors.push(`${item.id}: blank title`);

    if (item.kind === 'interactive') {
      if (!LAB_INTERACTIVE_IDS.includes(item.interactiveId)) {
        errors.push(`${item.id}: unknown interactiveId "${item.interactiveId}"`);
      }
    } else if (item.kind === 'law') {
      if (!item.formula.trim()) errors.push(`${item.id}: blank formula`);
      if (!item.quantities.length) errors.push(`${item.id}: no quantities`);
      if (!item.termsAr.length) errors.push(`${item.id}: no termsAr`);
      if (!item.termsAr.includes(item.titleAr)) errors.push(`${item.id}: titleAr must be one of termsAr`);
    } else if (item.kind === 'external') {
      if (!getExternalResource(item.externalId)) {
        errors.push(`${item.id}: externalId "${item.externalId}" is not in external_resources.json`);
      }
    } else {
      // The JSON is hand-edited and this is its only guard: a typo such as
      // "laws" would otherwise pass every check above and render nothing.
      errors.push(`${(item as { id: string }).id}: unknown kind "${(item as { kind: string }).kind}"`);
    }
  }
  return errors;
}
