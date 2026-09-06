/**
 * Feature switches for capabilities that are built but deliberately not offered.
 *
 * These are not dead code. Everything behind them works and is kept compiling
 * and tested, so turning one on is a one-line change rather than an excavation.
 */

/**
 * Teacher document upload in the Iqraa chat (PDF / Word / PowerPoint / images).
 *
 * Off since 2026-08-09. The reasoning is about cost, not capability: the whole
 * Jordanian curriculum is already in the app, so a teacher photographing a
 * textbook page pays to send the app content it already holds — and once real
 * generation is on, every one of those pages is tokens on every request that
 * references it.
 *
 * What upload is genuinely for is material the app does NOT have: last year's
 * exam, the department's own worksheet, a school lesson-plan template. Those
 * are planned as a proper library rather than an ad-hoc attachment, which is
 * why this is paused instead of deleted.
 *
 * Left intact behind the flag: `services/documents/*` (extraction, quick
 * actions), `DocumentAttachmentBar`, session-document state, and the
 * `attachments` field on chat messages. Flip this to `true` to restore.
 */
export const DOCUMENT_UPLOAD_ENABLED = false;

// ─── Served by the server, not baked into the build ──────────────────────────
//
// Everything above is a constant compiled into the bundle. Everything below is
// asked of the API at runtime, and the difference is deliberate:
// DOCUMENT_UPLOAD_ENABLED is a product decision that ships with a build, while
// student accounts are refused by the *server* — so a build-time copy could
// disagree with the thing actually enforcing it, and the register screen needs
// the answer before anyone has signed in.

import { useEffect, useState } from 'react';
import { apiJson } from './apiClient';

export type Features = { studentAccounts: boolean };

/** Fails closed. Offering a signup door that answers 403 is worse than hiding one that works. */
const CLOSED: Features = { studentAccounts: false };

let cached: Features | null = null;

export async function fetchFeatures(): Promise<Features> {
  if (cached) return cached;
  try {
    const res = await apiJson<Partial<Features>>('/healthz/features');
    // Only a success is cached: caching a network blip would hide the feature
    // for the rest of the session with no way back short of a restart.
    cached = { studentAccounts: res.studentAccounts === true };
    return cached;
  } catch {
    return CLOSED;
  }
}

/** Test seam, and the way a sign-out clears state that belonged to a session. */
export function resetFeatureCache(): void {
  cached = null;
}

/**
 * Starts closed and opens if the server says so, rather than the reverse: a
 * frame of "signup available" that then disappears is a worse thing to render
 * than a frame without it.
 */
export function useStudentAccountsEnabled(): boolean {
  const [enabled, setEnabled] = useState(cached?.studentAccounts ?? false);

  useEffect(() => {
    let live = true;
    fetchFeatures().then(f => {
      if (live) setEnabled(f.studentAccounts);
    });
    return () => {
      live = false;
    };
  }, []);

  return enabled;
}
