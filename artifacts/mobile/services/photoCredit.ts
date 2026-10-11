/**
 * The Unsplash photo credit, as a list of text runs some of which are links.
 *
 * Unsplash's API guidelines ask for the credit to link to the photographer's
 * Unsplash profile and to Unsplash, both carrying our utm params. The caption
 * string (`mediaCaption` / `sideImageCaption`) stays the plain-text form — it
 * is what older saved decks hold and what every caption consumer reads — and
 * the links ride beside it as `mediaCredit` / `sideImageCredit`.
 *
 * Pure on purpose: the on-screen, HTML/PDF and PPTX renderers all draw from
 * `creditSegments`, so they cannot drift apart, and it loads under the bare
 * `node --test` runner.
 */

export interface PhotoCredit {
  photographer: string;
  photographerUrl: string;
  unsplashUrl: string;
}

export interface CreditSegment {
  text: string;
  /** Present on the two linked runs only. */
  url?: string;
}

/** Shape of `DeckPhoto` (services/unsplashImage.ts) that matters here. */
interface CreditSource {
  photographer: string;
  photographerUrl?: string;
  unsplashLink?: string;
}

// A deck is stored JSON a teacher can share; never let a stored href be
// anything but a plain Unsplash page (no `javascript:`, no look-alike host).
const UNSPLASH_URL = /^https:\/\/unsplash\.com\/[^\s"'<>]*$/;

export function creditFromPhoto(p: CreditSource): PhotoCredit | undefined {
  if (!p.photographerUrl || !p.unsplashLink) return undefined;
  return { photographer: p.photographer, photographerUrl: p.photographerUrl, unsplashUrl: p.unsplashLink };
}

function segments(c: PhotoCredit, isAr: boolean): CreditSegment[] {
  return isAr
    ? [{ text: '📷 ' }, { text: c.photographer, url: c.photographerUrl }, { text: ' · ' }, { text: 'Unsplash', url: c.unsplashUrl }]
    : [{ text: '📷 Photo by ' }, { text: c.photographer, url: c.photographerUrl }, { text: ' on ' }, { text: 'Unsplash', url: c.unsplashUrl }];
}

/** The plain caption for a credit — what gets stored in `mediaCaption`. */
export function photoCreditText(c: { photographer: string }, isAr: boolean): string {
  return isAr ? `📷 ${c.photographer} · Unsplash` : `📷 Photo by ${c.photographer} on Unsplash`;
}

/**
 * The linked runs for `caption`, or null when it should be drawn as plain text.
 *
 * Null unless the caption is still exactly the text this credit produces. A
 * teacher who edits the caption, or swaps the photo (which rewrites or drops
 * it), must not keep linking to the old photographer.
 */
export function creditSegments(caption: string | undefined, credit: PhotoCredit | undefined): CreditSegment[] | null {
  if (!caption || !credit) return null;
  if (!UNSPLASH_URL.test(credit.photographerUrl) || !UNSPLASH_URL.test(credit.unsplashUrl)) return null;
  for (const isAr of [true, false]) {
    const segs = segments(credit, isAr);
    if (segs.map(s => s.text).join('') === caption) return segs;
  }
  return null;
}
