/**
 * Heatmaps and session recordings on the web build — Contentsquare (which
 * Hotjar is now part of; Hotjar accounts are being moved onto it).
 *
 * Web only: the tag is a browser script. The Android app gets its recordings
 * from PostHog session replay instead (`SESSION_REPLAY_CONFIG` in
 * `services/analytics.ts`). On native `document` does not exist, so every
 * export below is a no-op there.
 *
 * Disabled by default: with no `EXPO_PUBLIC_CONTENTSQUARE_TAG_ID` (or one that
 * is not a plain alphanumeric id) nothing is loaded and no request leaves the
 * page — the same silent no-key shape as `analytics.ts`. The tag id is public,
 * like the PostHog key; `deploy.yml` reads it from the `CONTENTSQUARE_TAG_ID`
 * repository variable. It is web-only, which is why it is not in `eas.json` or
 * `mobile-update.yml`.
 *
 * Everyone who opens the web app is recorded, students and parents included,
 * and so is the exam page a student opens from a link. Contentsquare has no
 * project-wide "mask all text" switch for the web tag (what is *typed* is
 * masked by default; anything else is masked per element), so the whole page
 * is masked here: `data-cs-mask` goes on `<body>` before the tag is added, which
 * Contentsquare documents as removing the content of the element and
 * everything inside it. Heatmaps and click positions still work; replays show
 * layout and taps, not names, marks, answers or messages. The attribute is set
 * first and the tag is not loaded if it cannot be — a masking failure must not
 * become an unmasked recording. The privacy policy in `constants/legal.ts` says
 * displayed text is masked, so check a real recording with Contentsquare's
 * Tracking Setup Assistant before setting the tag id.
 *
 * One page is never recorded: the parent's consent page (`/guardian#token`).
 * Its address carries an approval token, which is a credential and not a
 * screen — the same rule `shouldTrackScreen` applies to PostHog. Nothing in
 * the app navigates there (a parent arrives from an outside link), so it is
 * enough that the tag is not loaded when the page opens on it.
 *
 * Pure logic is separated from the DOM calls so `node --test` can cover it
 * without a browser (no `react-native` import here either).
 */
import { shouldTrackScreen } from './screenTracking.ts';

/** A tag id is a short alphanumeric string (e.g. 13 hex characters); anything else (unset, empty, a typo) disables it. */
export function parseContentsquareTagId(raw: string | undefined | null): string | null {
  const trimmed = (raw ?? '').trim();
  return /^[A-Za-z0-9]{6,32}$/.test(trimmed) ? trimmed : null;
}

export function contentsquareScriptUrl(tagId: string): string {
  return `https://t.contentsquare.net/uxa/${tagId}.js`;
}

/** The slice of `window` the loader touches. */
export interface ContentsquareWindow {
  _uxa?: unknown[][];
  /** Defined by the tag once it has loaded. */
  CS_CONF?: unknown;
}

/** The slice of `document` the loader touches. */
export interface ContentsquareDocument {
  createElement(tag: 'script'): { async: boolean; src: string };
  head: { appendChild(node: unknown): unknown };
  body?: { setAttribute(name: string, value: string): void } | null;
}

/** Contentsquare removes the content of any element carrying this attribute, descendants included. */
export const MASK_ATTRIBUTE = 'data-cs-mask';

/**
 * Contentsquare's standard install: the `_uxa` command queue, the page path set
 * before the tag loads (the docs require that order), and an async script tag —
 * preceded by masking the whole page (see the file comment). Returns true if it
 * added the script, false if there was nothing to do (disabled, on the parent
 * consent page, already installed, or the page could not be masked).
 */
export function installContentsquare(
  rawTagId: string | undefined | null,
  win: ContentsquareWindow,
  doc: ContentsquareDocument,
  pathname: string,
): boolean {
  const tagId = parseContentsquareTagId(rawTagId);
  if (tagId === null) return false;
  if (!shouldTrackScreen(pathname)) return false;
  if (win._uxa) return false;

  // Mask first, fail closed: no body to mask means no recording.
  if (!doc.body) return false;
  doc.body.setAttribute(MASK_ATTRIBUTE, '');

  win._uxa = [];
  // Path only: Contentsquare erases everything after '#', and a query string
  // could carry a code, so neither is sent.
  win._uxa.push(['setPath', pathname]);

  const script = doc.createElement('script');
  script.async = true;
  script.src = contentsquareScriptUrl(tagId);
  doc.head.appendChild(script);
  return true;
}

const TAG_ID = process.env.EXPO_PUBLIC_CONTENTSQUARE_TAG_ID;

function browser(): { win: ContentsquareWindow; doc: ContentsquareDocument; pathname: string } | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  return {
    win: window as unknown as ContentsquareWindow,
    doc: document as unknown as ContentsquareDocument,
    pathname: window.location?.pathname ?? '/',
  };
}

/** Call once at app start. Loads the tag on the web build when a tag id is configured. Never throws. */
export function initContentsquare(): void {
  try {
    const b = browser();
    if (b) installContentsquare(TAG_ID, b.win, b.doc, b.pathname);
  } catch {
    // Analytics must never break the feature it's watching.
  }
}

/**
 * The app is a single-page app, so the browser never loads a new page when the
 * route changes; the tag has to be told, or every recording and heatmap is one
 * long visit to the first URL. Sent only once the tag has loaded
 * (`CS_CONF` exists), as Contentsquare's own install snippet does — the first
 * page is already counted by the tag's own load. No-op when it is not installed.
 */
export function contentsquareTrackPageview(path: string): void {
  try {
    const b = browser();
    if (b?.win._uxa && b.win.CS_CONF !== undefined && shouldTrackScreen(path)) {
      b.win._uxa.push(['trackPageview', path]);
    }
  } catch {
    // Analytics must never break the feature it's watching.
  }
}
