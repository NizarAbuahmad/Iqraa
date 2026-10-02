/**
 * Headers that say where a request comes from. The API reads them once, at
 * registration, into `users.signup_platform` / `signup_referrer`, so the admin
 * dashboard can answer "did they join from the app or the web, and from
 * where". Sent on every request because it is two tiny headers and the
 * alternative is remembering to attach them on exactly the right call.
 */
import { Platform } from 'react-native';

const LANDING_KEY = 'iqra_landing';

export function originHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'X-Iqraa-Platform': Platform.OS };
  if (Platform.OS === 'web') {
    const landing = rememberLanding();
    if (landing) h['X-Iqraa-Landing'] = landing;
  }
  return h;
}

/**
 * The first thing this tab saw: a `?utm_source` if the link carried one,
 * otherwise the referring site. Remembered in sessionStorage so it survives
 * onboarding → login → register inside the same tab; our own origin is not
 * a referrer. Empty string means "typed the address / nothing known".
 */
function rememberLanding(): string {
  try {
    const stored = sessionStorage.getItem(LANDING_KEY);
    if (stored !== null) return stored;
    const params = new URLSearchParams(window.location.search);
    const src = params.get('utm_source');
    const campaign = params.get('utm_campaign');
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : '';
    const landing = (src ? `utm:${src}${campaign ? `/${campaign}` : ''}` : ref).slice(0, 300);
    sessionStorage.setItem(LANDING_KEY, landing);
    return landing;
  } catch {
    return '';
  }
}
