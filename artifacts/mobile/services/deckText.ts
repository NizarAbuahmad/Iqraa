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
 * Whether a line should be laid out as mathematics (its own boxed, centred,
 * larger block) rather than prose. A bullet never is: a list item that happens
 * to mention `x` is still a list item.
 */
export function looksLikeEquation(line: string): boolean {
  const text = (line ?? '').trim();
  if (!text || isBulletLine(text)) return false;
  return /[=²³√±×÷^]/.test(text) || /\d+x/.test(text) || /\/[0-9٠-٩]/.test(text);
}
