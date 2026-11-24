/**
 * The decision behind `shareAsText` (services/share.ts), kept free of React
 * Native so `node --test` can load it.
 *
 * Share always puts the text on the clipboard too, on web and in the app. The
 * Windows share sheet (desktop Edge/Chrome) offers "Copy link" only for a URL,
 * never for text, so Share used to leave a teacher with no way to copy the quiz
 * they had just made. Most desktop browsers have no sheet at all; there the
 * copy is all that happens.
 *
 * - `both`: the sheet opened and the text is on the clipboard.
 * - `shared`: the sheet opened, but the copy failed (say, clipboard denied).
 * - `copied`: only the copy worked, because there was no sheet, or it was
 *   closed or failed.
 *
 * Throws only when neither worked.
 */
export type ShareOutcome = 'both' | 'shared' | 'copied';

export interface ShareDeps {
  canShare: boolean;
  copy: (text: string) => Promise<unknown>;
  share: (text: string, title: string) => Promise<unknown>;
}

/**
 * The toast after Share. `shared` gets none: the sheet itself was the feedback,
 * and nothing was copied.
 */
export function shareToastKey(outcome: ShareOutcome): 'copiedToClipboard' | 'sharedAlsoCopied' | null {
  if (outcome === 'copied') return 'copiedToClipboard';
  if (outcome === 'both') return 'sharedAlsoCopied';
  return null;
}

export async function shareOrCopy(text: string, title: string, deps: ShareDeps): Promise<ShareOutcome> {
  // Start the copy before the sheet and do not await it first. On web,
  // navigator.share uses up the click's user activation, and a clipboard write
  // made after the sheet closes can be refused.
  const copied = deps.copy(text).then(() => true, () => false);
  if (!deps.canShare) {
    if (await copied) return 'copied';
    throw new Error('Copy to clipboard failed');
  }
  let shared = true;
  let shareError: unknown;
  try {
    await deps.share(text, title);
  } catch (e) {
    shared = false;
    shareError = e;
  }
  const didCopy = await copied;
  if (shared) return didCopy ? 'both' : 'shared';
  if (didCopy) return 'copied';
  throw shareError;
}
