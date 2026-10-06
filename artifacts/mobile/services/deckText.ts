/**
 * The small text decisions a deck slide's body needs — is this line a bullet,
 * is it an equation, does its heading start with a section emoji.
 *
 * Pure and shared on purpose. These rules existed as private copies inside the
 * on-screen presenter (`presentation.tsx`), and the two exports had either a
 * different copy or none at all — which is exactly how the exported deck
 * drifted from the projected one: the screen lifted the leading emoji out of a
 * heading into a chip, and the PDF printed it twice, once in the chip and once
 * inside the title beside it.
 *
 * No React Native here, so `node:test` can load it directly.
 */

/**
 * Pull a leading emoji off a deck heading.
 *
 * The builders write titles like "🎯 نتاجات التعلم" — the glyph is a section
 * marker, not part of the sentence, so it belongs in a chip beside the heading
 * rather than inline, where it sets the line height for the whole title.
 * Codepoint ranges rather than \p{Extended_Pictographic}: unicode property
 * escapes are not safe to assume across Hermes versions.
 */
export function splitEmoji(title: string): [glyph: string, heading: string] {
  const text = (title ?? '').trim();
  const cp = text.codePointAt(0) ?? 0;
  const isEmoji = cp >= 0x1f300 || (cp >= 0x2190 && cp <= 0x27bf);
  if (!isEmoji) return ['', text];
  const glyph = String.fromCodePoint(cp);
  return [glyph, text.slice(glyph.length).replace(/^\uFE0F/, '').trim()];
}

/** A body line the generators wrote as a list item. */
export function isBulletLine(line: string): boolean {
  return /^[•\-–]\s+/.test((line ?? '').trim());
}

/** The same line without its bullet marker — the marker is drawn, not typed. */
export function stripBullet(line: string): string {
  return (line ?? '').trim().replace(/^[•\-–]\s+/, '');
}

/**
 * A worked example's answer, split into the working and the result.
 *
 * Book examples are stored `givens: working → … → answer`, and the whole chain
 * after the colon becomes `slide.answer`. Printed as one line it is a run of
 * equations the class has to find the end of. Split on the arrows, each step
 * gets its own line and the last part — the result — can be set apart.
 *
 * Fails closed to `null` (draw the answer as one line, as before) unless every
 * part is itself an equation or inequality: a reaction «N₂ + 3H₂ → 2NH₃» has
 * an arrow and is not working, and a part with no relation in it («→ 7») is
 * not something to number. Capped at four steps, because the renderers have a
 * fixed amount of room under the question.
 */
export function workingSteps(answer: string): { steps: string[]; final: string } | null {
  const parts = (answer ?? '').split(/→|⇒|=>/).map(p => p.trim());
  if (parts.length < 2 || parts.length > 5) return null;
  if (!parts.every(p => /[=≤≥<>≠≈]/.test(p))) return null;
  return { steps: parts.slice(0, -1), final: parts[parts.length - 1]! };
}

/**
 * Whether a line should be laid out as mathematics (its own boxed, centred,
 * larger block) rather than prose. A bullet never is: a list item that happens
 * to mention `x` is still a list item.
 */
export function looksLikeEquation(line: string): boolean {
  const text = (line ?? '').trim();
  if (!text || isBulletLine(text)) return false;
  return /[=²³√±×÷^]/.test(text) || /\d+x/.test(text) || /\/[0-9٠-٩]/.test(text);
}

/**
 * Whether a slide's actual payload — question text and options, not the
 * chrome around it — reads as English rather than Arabic.
 *
 * A deck's chrome (title, "quick check" banner, …) is picked once at build
 * time from the app's UI language, but the content underneath can disagree:
 * an English-subject lesson's exit-ticket check comes back from the model in
 * English regardless of what language the surrounding Arabic UI was in when
 * the deck was built. Presenting that content right-aligned with أبجد option
 * letters is asking a class reading an English test to read it backwards.
 *
 * Deliberately content-driven rather than reading the deck's own language
 * flag: any Arabic character anywhere in the payload is enough to keep the
 * Arabic layout, since a mixed Arabic sentence with an embedded Latin term or
 * equation is still Arabic prose. Only a payload with **no** Arabic script at
 * all — the case an English lesson actually produces — flips to English
 * layout, and only when there is enough Latin text to have an opinion.
 */
export function isEnglishSlideContent(...parts: (string | undefined)[]): boolean {
  const text = parts.filter(Boolean).join(' ');
  if (/[؀-ۿ]/.test(text)) return false;
  return /[A-Za-z]{2,}/.test(text);
}
