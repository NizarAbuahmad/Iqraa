/**
 * "Is this generated material already in my workspace?"
 *
 * A generator screen knows what it just built; it does not know whether an
 * earlier visit already saved that same thing. The save button kept the id it
 * created in screen state alone, so leaving the screen or reloading the page
 * lost it: the button went back to "احفظ" over a deck that WAS saved, and the
 * next press stored a second copy instead of removing the first.
 *
 * This is the lookup that closes that gap. It is deliberately a pure function
 * over an already-fetched list — the workspace service pulls RN and network
 * modules in at import time, and keeping the rule here is what lets it be
 * tested directly.
 *
 * Matching is on what a teacher would use to recognise the material, not on
 * content: the deck on screen drifts from the stored copy (media and video
 * passes land after generation, and slides get edited), so comparing content
 * would fail exactly when the answer matters most.
 */
import type { MaterialType } from './workspace';

/** The shape this module needs; `SavedMaterial` satisfies it. */
export interface MatchableMaterial {
  id: string;
  type: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  language: string;
  content: string;
}

export interface MaterialIdentity {
  type: MaterialType;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  language: 'ar' | 'en';
}

/**
 * Compare the way a teacher reads a title: trimmed, internal runs of
 * whitespace collapsed, case-insensitive. Arabic is left otherwise untouched —
 * no normalisation of hamza or diacritics, because both sides of this
 * comparison were written by the same generator from the same inputs.
 */
function norm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sameIdentity(item: MatchableMaterial, identity: MaterialIdentity): boolean {
  return (
    item.type === identity.type
    && item.language === identity.language
    && norm(item.title) === norm(identity.title)
    && norm(item.topic) === norm(identity.topic)
    && norm(item.grade) === norm(identity.grade)
    && norm(item.subject) === norm(identity.subject)
  );
}

/**
 * The saved material this generated one corresponds to, or null.
 *
 * `items` is expected newest-first, as the workspace returns it, and the
 * newest match wins: duplicates exist in workspaces that used the old
 * save-every-press button, and the most recent copy is the one a teacher just
 * made and would expect the button to be holding.
 */
export function findMatchingItem(
  items: MatchableMaterial[],
  identity: MaterialIdentity,
): MatchableMaterial | null {
  return items.find(item => sameIdentity(item, identity)) ?? null;
}
