/**
 * An account's school-notification switches (spec Part 4): `homework` (posted,
 * and the reminder the day before), `exams` (a date set, changed or cleared)
 * and `results` (released, or a paper mark typed after the release). Chat
 * messages are not governed here.
 *
 * Opt-outs: stored in `users.push_prefs` as only the choices made, so `{}` —
 * every account before this existed — is all on, and only an explicit `false`
 * turns one off. A malformed value reads as on: the failure mode of a bad
 * value is "one push too many", never a family silently cut off.
 */
export const PUSH_CATEGORIES = ["homework", "exams", "results"] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];
export type PushPrefs = Record<PushCategory, boolean>;
export type PushPrefsPatch = Partial<PushPrefs>;

export function readPushPrefs(stored: unknown): PushPrefs {
  const o = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  return { homework: o.homework !== false, exams: o.exams !== false, results: o.results !== false };
}

export function allowsPush(stored: unknown, category: PushCategory): boolean {
  return readPushPrefs(stored)[category];
}

/** The body of `PUT /auth/me/push-preferences`: one or more known switches, each true or false. */
export function parsePushPrefsPatch(body: unknown): { ok: true; value: PushPrefsPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send an object of switches: homework, exams, results" };
  }
  const b = body as Record<string, unknown>;
  const value: PushPrefsPatch = {};
  for (const c of PUSH_CATEGORIES) {
    if (b[c] === undefined) continue;
    if (typeof b[c] !== "boolean") return { ok: false, error: `${c} must be true or false` };
    value[c] = b[c] as boolean;
  }
  if (Object.keys(value).length === 0) return { ok: false, error: "Nothing to change: send homework, exams or results" };
  return { ok: true, value };
}
