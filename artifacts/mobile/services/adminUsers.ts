/**
 * What the admin screens say about a user's age and origin: who counts as new,
 * which channel they joined through, and the link the dashboard's «جدد» tile
 * uses to open the users list on exactly those people.
 *
 * Kept out of the screens so a test can load it: the mobile runner cannot
 * import anything that pulls in `react-native`.
 */
export const NEW_USER_DAYS = 7;

const DAY_MS = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/**
 * The first UTC day that still counts as new: seven days including today, the
 * same window as the «٧ أيام» chip (`dayAgo(6)` in components/admin/DateRange.tsx),
 * so the tile, the label and that chip never disagree about who is new.
 */
export function newUsersFrom(today: string): string {
  return new Date(dayMs(today) - (NEW_USER_DAYS - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** `createdAt` is the API's ISO timestamp; `today` a `YYYY-MM-DD` day (UTC). */
export function isNewUser(createdAt: string | null | undefined, today: string): boolean {
  return !!createdAt && createdAt.slice(0, 10) >= newUsersFrom(today);
}

/** The dashboard's per-day signup rows (`signupsByDay`) summed over the new window. */
export function countNewUsers(rows: { day: string; count: number }[], today: string): number {
  const from = newUsersFrom(today);
  return rows.reduce((n, r) => (r.day >= from && r.day <= today ? n + r.count : n), 0);
}

export type Channel = 'web' | 'mobile' | 'unknown';

/**
 * `users.signup_platform` is `web`, `android`, `ios`, or null for accounts made
 * before the app began sending it (2 Oct) or by something that does not send it.
 */
export function channelOf(signupPlatform: string | null | undefined): Channel {
  if (signupPlatform === 'web') return 'web';
  if (signupPlatform === 'android' || signupPlatform === 'ios') return 'mobile';
  return 'unknown';
}

/** The users screen opened on the new window. */
export const NEW_USERS_HREF = '/admin/users?new=1';

/** Whether `?new=` asks for the new window. expo-router gives an array for a repeated param. */
export function parseNewUsersParam(param: string | string[] | undefined): boolean {
  return (Array.isArray(param) ? param[0] : param) === '1';
}
