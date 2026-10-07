/**
 * A predict–observe–explain sheet for each lab lesson («تجربة استهلالية»),
 * paired with a simulation the student opens on its own site.
 *
 * Hand-written and fixed, not generated: there are seven, a wrong
 * observation in a lab is worse than none, and a fixed sheet is the same
 * whether live AI is on or off. Each stays hidden from teachers until a
 * subject teacher has reviewed it — `reviewedBy`/`reviewedAt` are that record,
 * and nothing but a real review may set them.
 */
import type { ExternalResource } from './external.ts';

export interface VirtualLabSheet {
  /** KB id of the lab lesson, e.g. `kbl-chem-s1-nccd-u1_lab`. */
  lessonId: string;
  /** The `simulation` entry in external_resources.json. */
  resourceId: string;
  aimAr: string;
  predict: string[];
  /** Numbered steps to do in the simulation. */
  procedure: string[];
  observe: string[];
  explain: string[];
  teacherKey: { predict: string[]; observe: string[]; explain: string[] };
  reviewedBy?: string;
  /** ISO date of the review; absent = not released. */
  reviewedAt?: string;
}

/** Filled in Task 8, once each simulation URL is confirmed. */
export const VIRTUAL_LABS: readonly VirtualLabSheet[] = [];

export function releasedVirtualLab(
  lessonId: string,
  opts: { dev?: boolean; labs?: readonly VirtualLabSheet[] } = {},
): VirtualLabSheet | null {
  const sheet = (opts.labs ?? VIRTUAL_LABS).find(l => l.lessonId === lessonId);
  if (!sheet) return null;
  return sheet.reviewedAt || opts.dev ? sheet : null;
}

export function validateVirtualLabs(
  labs: readonly VirtualLabSheet[],
  resources: readonly ExternalResource[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const l of labs) {
    if (seen.has(l.lessonId)) errors.push(`${l.lessonId}: two sheets for one lesson`);
    seen.add(l.lessonId);
    if (!l.lessonId.startsWith('kbl-') || !l.lessonId.endsWith('_lab')) {
      errors.push(`${l.lessonId}: not a lab lesson id`);
    }
    const r = resources.find(x => x.id === l.resourceId);
    if (!r) errors.push(`${l.lessonId}: resource ${l.resourceId} is not in the catalog`);
    else {
      if (r.kind !== 'simulation') errors.push(`${l.lessonId}: ${l.resourceId} is not a simulation`);
      if (!r.lessonIds.includes(l.lessonId)) errors.push(`${l.lessonId}: ${l.resourceId} is not filed on this lesson`);
      // Every procedure names a PhET simulation's own controls, and link-only
      // was decided by reading PhET's terms; another provider needs both redone.
      if (r.provider !== 'phet') errors.push(`${l.lessonId}: ${l.resourceId} is not a PhET simulation`);
    }
    if (!l.aimAr.trim()) errors.push(`${l.lessonId}: aim is empty`);
    for (const part of ['predict', 'procedure', 'observe', 'explain'] as const) {
      if (!l[part].length) errors.push(`${l.lessonId}: ${part} is empty`);
      if (l[part].some(s => !s.trim())) errors.push(`${l.lessonId}: ${part} has a blank entry`);
    }
    for (const part of ['predict', 'observe', 'explain'] as const) {
      if (l.teacherKey[part].length !== l[part].length) {
        errors.push(`${l.lessonId}: ${part}: ${l[part].length} questions but ${l.teacherKey[part].length} key`);
      }
      if (l.teacherKey[part].some(s => !s.trim())) errors.push(`${l.lessonId}: teacherKey.${part} has a blank answer`);
    }
    // A review is a person and a date together; either alone is not a record of one.
    if (l.reviewedAt && !l.reviewedBy?.trim()) errors.push(`${l.lessonId}: reviewedAt without reviewedBy`);
    if (l.reviewedBy && !l.reviewedAt?.trim()) errors.push(`${l.lessonId}: reviewedBy without reviewedAt`);
  }
  return errors;
}
