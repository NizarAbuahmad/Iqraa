import type { TranslationKey } from './i18n';

/**
 * Which words `/join-class` uses.
 *
 * It was written for "add another class", and still says so to anyone who has
 * one. A student who signed up with an email has none (since 2026-10-23), and
 * is told to join one. `=== false`, not falsy, for the reason `needsRosterClaim`
 * gives: `undefined` is "not answered yet", and must not be read as "no class".
 *
 * Only a student gets the first-class wording: a parent with no link is held on
 * `/claim-required` and never reaches this screen, and a teacher has no link.
 *
 * Kept out of the screen because `node --test` cannot load a React Native file.
 * Typed as real keys, so a misspelt one fails the typecheck rather than
 * printing the key on screen.
 */
export function joinClassCopyKeys(
  user: { role: string; hasRosterLink?: boolean } | null | undefined,
): { title: TranslationKey; desc: TranslationKey } {
  if (user?.role === 'student' && user.hasRosterLink === false) {
    return { title: 'joinAClass', desc: 'joinFirstClassDesc' };
  }
  return { title: 'joinAnotherClass', desc: 'joinAnotherClassDesc' };
}
