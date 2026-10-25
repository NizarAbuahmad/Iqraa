/**
 * Web-only: save a generated file (PDF, Word, PowerPoint, image) from the
 * browser. No React Native import, so `node --test` can load it.
 *
 * Why iOS gets its own path: an `<a download>` click made after the file was
 * built (seconds of async work) is dropped or opens the file in the tab on
 * iPhone Safari, and revoking the object URL a second later kills the download
 * before it starts. The share sheet ("Save to Files") is what an iPhone user
 * expects anyway. It needs a recent tap, so when Safari refuses (the tap is
 * too old by the time a big document is built) we fall back to the link.
 */

/** iPadOS 13+ reports itself as a Mac; the touch screen is what gives it away. */
export function isIOSUserAgent(ua: string, platform: string, touchPoints: number): boolean {
  return /iP(hone|ad|od)/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
}

export function isIOSWeb(): boolean {
  return typeof navigator !== 'undefined'
    && isIOSUserAgent(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0);
}

export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (isIOSWeb()) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        // The user closing the sheet is an answer, not a failure.
        if ((e as Error).name === 'AbortError') return;
        // NotAllowedError (tap too old) etc.: fall through to the link.
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // ponytail: 60s, not 1s — Safari starts the download after the click
  // returns, so an early revoke leaves a dead link. The blob is freed on reload.
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 60_000);
}
