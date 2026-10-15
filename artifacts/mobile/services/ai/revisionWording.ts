/**
 * The offline sentences that assume ONE lesson, reworded for a revision.
 *
 * A unit, a semester or the whole book reaches the offline makers as a
 * revision session whose topic is the scope's phrase («موضوعات الفصل الأول»),
 * never the picker's label. Most sentences read correctly with it
 * («موضوعات الفصل الأول – عمل فردي»). A few were written for one lesson and
 * would claim one: «من درس «موضوعات الفصل الأول»», «من الحصة السابقة».
 * Those, and only those, are rewritten here after the template has run. The
 * templates stay exactly as a lesson needs them, because no format gets a
 * second blueprint (piece-3 spec, decision 4).
 *
 * Each entry is the template's exact text with the phrase in place of the
 * topic. Editing one of those template sentences makes its entry dead. The
 * tests fail on a dead entry, so the table cannot quietly stop applying.
 *
 * Free of react-native so `node --test` can load it.
 */

export type Reword = [string, string];

/** The activity blueprints' one-lesson sentences (`activityBlueprints.ts`). */
export function activityRevisionRewords(phrase: string, lang: 'ar' | 'en'): Reword[] {
  const p = phrase;
  return lang === 'ar'
    ? [
        [`من درس «${p}»`, `من ${p}`],
        [`عن ${p} من الحصة السابقة`, `عن ${p} من الحصص السابقة`],
        [`ما أهم ما تعلّمته عن ${p} في الحصة السابقة؟`, `ما أهم ما تعلّمته عن ${p} في الحصص السابقة؟`],
        [`قبل الدخول في ${p}`, `قبل مراجعة ${p}`],
        [`واليوم سنستخدمه لـ ${p}`, `واليوم سنستخدمه في مراجعة ${p}`],
      ]
    : [
        [`from the “${p}” lesson`, `from ${p}`],
        [`about ${p} from last lesson`, `about ${p} from earlier lessons`],
        [`learned about ${p} last lesson?`, `learned about ${p} in earlier lessons?`],
        [`before ${p} begins`, `before the revision of ${p} begins`],
        [`today we use it for ${p}.`, `today we use it to revise ${p}.`],
      ];
}

/** Every string inside `value` with each `from` replaced by its `to`, in table order. Other values are copied as they are. */
export function reviseWording<T>(value: T, rewords: readonly Reword[]): T {
  const fix = (s: string) => rewords.reduce((acc, [from, to]) => acc.split(from).join(to), s);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
