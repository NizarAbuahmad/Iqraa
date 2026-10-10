/**
 * The login code of an account that has been created on the server but not yet
 * adopted on this device.
 *
 * `POST /auth/redeem` returns the code exactly once and keeps only its hash.
 * The sign-up screen then shows it and waits for «حفظت الرمز» before it opens
 * the session — so if the app is closed or crashes in between, the account
 * exists, nobody holds its tokens, and the code is the only way in. Writing it
 * here first means the next launch can offer it on the «الدخول برمز الحساب»
 * screen instead of leaving a child locked out of an account they just made.
 *
 * Deliberately short-lived: cleared the moment the session is adopted. A login
 * code never expires, and on web this storage is `localStorage`, so keeping it
 * around would turn a 30-day session into a permanent credential sitting where
 * any script on the origin can read it.
 */
import * as storage from './secureStorage';

const KEY = 'iqra_pending_login_code_v1';

export async function savePendingLoginCode(code: string): Promise<void> {
  try {
    await storage.setItem(KEY, code);
  } catch {
    // Best effort: the code is also on screen. Losing this only loses the
    // crash-recovery convenience, never the sign-up.
  }
}

export async function readPendingLoginCode(): Promise<string | null> {
  try {
    return (await storage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export async function clearPendingLoginCode(): Promise<void> {
  try {
    await storage.deleteItem(KEY);
  } catch {
    // Nothing to do; it is overwritten by the next sign-up.
  }
}
