/**
 * What to tell the teacher after attaching a material to classes.
 *
 * Split out of the eight save screens that ask the question. They each used to
 * hold one line — `ok ? savedToClass(name) : saveToClassFailed` — which stopped
 * being adequate the moment a teacher could pick three sections: "saved" and
 * "failed" cannot describe two of three landing.
 *
 * Pure and free of react-native imports so `node --test` can load it; the
 * screens keep the toast and the hook.
 */
import { countClasses, type Lang } from './i18n.ts';

/** Minimal shape of the translate function the screens already hold. */
type Translate = (key: any, ...args: any[]) => string;

export type AttachOutcome = { attached: number; requested: number };

/**
 * One line covering all four cases, in the teacher's language.
 *
 * The single-class wording stays exactly what it was — that is the common case
 * and it names the class, which a count cannot. Only once there are several
 * does it fall back to counting, because listing four Arabic class names in a
 * toast is longer than the toast.
 */
export function describeAttachResult(
  outcome: AttachOutcome,
  picks: { name: string }[],
  t: Translate,
  lang: Lang,
): string {
  const { attached, requested } = outcome;

  if (attached === 0) return t('saveToClassFailed');

  if (attached < requested) {
    return t(
      'savedToClassesPartial',
      countClasses(attached, lang),
      countClasses(requested, lang),
    );
  }

  // Named when there is one, counted when there are several.
  if (attached === 1 && picks.length >= 1) return t('savedToClass', picks[0]!.name);

  return t('savedToClasses', countClasses(attached, lang));
}

/**
 * Attach one material to several classes, given the two effects that do it.
 *
 * The effects are injected because `services/workspace.ts` imports
 * AsyncStorage and cannot be loaded by `node --test` — the same split, and for
 * the same reason, as `generateWithProvenance` living outside RemoteAIService.
 * What is worth testing here is the ordering and the counting, neither of
 * which needs a real store.
 *
 * `saved_materials.class_group_id` is a single column, so only the first class
 * can have the original; the rest get copies. First rather than last on
 * purpose: the teacher is looking at the material they just made, and it
 * should stay theirs rather than silently becoming copy number three.
 *
 * A class that fails does not stop the others. The material is saved either
 * way, and leaving two sections unattached because a third failed helps
 * nobody — the caller reports the shortfall instead.
 */
export async function attachAcrossClasses(
  effects: {
    update: (materialId: string, classId: string) => Promise<boolean>;
    duplicate: (materialId: string) => Promise<{ id: string } | null>;
  },
  materialId: string,
  classIds: string[],
): Promise<AttachOutcome> {
  const wanted = [...new Set(classIds)].filter(Boolean);
  if (wanted.length === 0) return { attached: 0, requested: 0 };

  const [first, ...rest] = wanted;
  let attached = (await effects.update(materialId, first!)) ? 1 : 0;

  for (const classId of rest) {
    const copy = await effects.duplicate(materialId);
    if (!copy) continue;
    if (await effects.update(copy.id, classId)) attached += 1;
  }

  return { attached, requested: wanted.length };
}
