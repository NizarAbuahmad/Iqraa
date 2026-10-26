/**
 * The filter chips on «البريد المجمّع» (`app/admin/signups.tsx`), and the link
 * the dashboard's overview tiles use to open it on one of them.
 *
 * Kept out of the screen so a test can load it: the mobile runner cannot import
 * anything that pulls in `react-native`.
 */
export const SIGNUP_KINDS = ['all', 'waitlist', 'contact', 'idea'] as const;
export type SignupKind = (typeof SIGNUP_KINDS)[number];

/**
 * The chip a `?kind=` param names. Anything else — a missing param, a typo, a
 * name copied from somewhere else — opens on «الكل» rather than on a filter that
 * matches nothing. expo-router gives an array for a repeated param.
 */
export function parseSignupKind(param: string | string[] | undefined): SignupKind {
  const value = Array.isArray(param) ? param[0] : param;
  return SIGNUP_KINDS.find(kind => kind === value) ?? 'all';
}

/** The signups screen opened on `kind`; «الكل» is the screen's own default. */
export function signupsHref(kind: SignupKind): string {
  return kind === 'all' ? '/admin/signups' : `/admin/signups?kind=${kind}`;
}
