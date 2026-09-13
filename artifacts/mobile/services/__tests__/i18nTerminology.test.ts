/**
 * Names that must not reappear in user-facing copy.
 *
 * This exists because a rename did not hold. On 2026-09-06 the teacher's
 * screen and the parent's field were reconciled on «رمز الربط» — and three
 * strings added over the next four days each independently wrote «رمز الصف»
 * again: `joinAnotherClassDesc` (41f3e84), `claimRequiredDesc` (f367193) and
 * `onboardingSlide5Desc` (81c4fc7). A parent was told to look for a label the
 * app does not render, which is the same bug the 09-06 pass had just fixed.
 *
 * `claimCodeMessage.test.ts` already pins the share composer's `fieldLabel`
 * against the register form's own label, which is why that composer takes the
 * label as an input rather than hardcoding it. That guards *one* path: it
 * cannot see a fourth screen writing the name into a fresh translation key.
 * This test is the missing half — it looks at every value in the table, so a
 * new key is covered the moment it is added, which is exactly when the three
 * above slipped through.
 *
 * Scope note: these are bans on *rendered copy*, not on the concepts. A class
 * join code and a per-student claim code really are different things and
 * `roster.ts` still calls them that in code and comments — the product
 * decision is that both are shown to a human as «رمز الربط» / "link code",
 * because the field that accepts them is labelled that and accepts either.
 *
 * Function-valued entries are checked by their source text rather than by
 * calling them: 76 of the ~1124 entries per locale are functions taking
 * arguments this test has no business inventing, and a banned name would sit
 * in the template literal either way.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import translations from '../i18n.ts';

/** Each ban carries the reason, so a failure explains itself without git log. */
const BANNED: Array<{ term: string; use: string; why: string }> = [
  {
    term: 'رمز الصف',
    use: 'رمز الربط',
    why: 'the field that accepts the code is labelled «رمز الربط», and it takes a per-student code too',
  },
  {
    term: 'class code',
    use: 'link code',
    why: 'the English label is "Link code"; "class code" also excludes the per-student case',
  },
  {
    term: 'إقرأ',
    use: 'اقرأ',
    why: 'hamzat wasl — the brand is «اقرأ», spelled that way in 27 other strings',
  },
];

/** Strings as themselves; functions as their source, which holds the literal. */
function renderedText(value: unknown): string {
  return typeof value === 'function' ? value.toString() : String(value);
}

describe('i18n terminology', () => {
  for (const { term, use, why } of BANNED) {
    it(`never renders «${term}» — say «${use}»`, () => {
      const offenders: string[] = [];

      for (const [lang, table] of Object.entries(translations)) {
        for (const [key, value] of Object.entries(table as Record<string, unknown>)) {
          // Case-insensitive so "Class code" at the start of a sentence is
          // caught; Arabic is unaffected by the fold.
          if (renderedText(value).toLowerCase().includes(term.toLowerCase())) {
            offenders.push(`${lang}.${key}`);
          }
        }
      }

      assert.deepEqual(
        offenders,
        [],
        `«${term}» must not reach a user — ${why}. Use «${use}» in: ${offenders.join(', ')}`,
      );
    });
  }

  it('actually looked at something — a table that fails to load would pass vacuously', () => {
    const counts = Object.entries(translations).map(
      ([lang, table]) => [lang, Object.keys(table as object).length] as const,
    );

    assert.equal(counts.length, 2, 'expected exactly the ar and en tables');
    for (const [lang, n] of counts) {
      assert.ok(n > 500, `${lang} has only ${n} keys — the table did not load`);
    }
  });
});
