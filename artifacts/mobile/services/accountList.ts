/**
 * The list of other accounts kept on this device, as pure functions.
 *
 * Split from savedAccounts.ts (which touches AsyncStorage / SecureStore) for the
 * usual reason: this file can be loaded by `node --test`, that one cannot.
 *
 * An entry is display data only — who it is, and when it was last the open
 * account. The refresh token that makes it usable lives under its own
 * SecureStore key (see savedAccounts.ts), never in this list.
 *
 * The rule the whole feature rests on: a refresh token exists in exactly one
 * place. The signed-in account's is in the active token slot; every other
 * account's is in its saved slot. The server retires a refresh token the moment
 * it is exchanged and revokes the whole session if a retired one comes back
 * (routes/auth.ts, decideRefresh), so a copy left in two places would end up
 * signing the person out of that account for good.
 */

export type SavedAccountMeta = {
  userId: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  /** Epoch ms of the moment this account stopped being the open one. */
  lastUsedAt: number;
};

/** Other accounts, not counting the open one — so five in all. */
export const MAX_SAVED_ACCOUNTS = 4;

/** Most recently used first. The first entry is the one badged «آخر استخدام». */
export function sortSavedAccounts(list: SavedAccountMeta[]): SavedAccountMeta[] {
  return [...list].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/** Replaces an entry for the same user, otherwise appends. Never grows past the cap. */
export function upsertSavedAccount(
  list: SavedAccountMeta[],
  entry: SavedAccountMeta,
): SavedAccountMeta[] | null {
  const others = list.filter(a => a.userId !== entry.userId);
  if (others.length >= MAX_SAVED_ACCOUNTS) return null;
  return [...others, entry];
}

/** Whether saving one more account (this one, if not already saved) would break the cap. */
export function isSavedFull(list: SavedAccountMeta[], userId: string): boolean {
  return list.filter(a => a.userId !== userId).length >= MAX_SAVED_ACCOUNTS;
}

export function withoutSavedAccount(list: SavedAccountMeta[], userId: string): SavedAccountMeta[] {
  return list.filter(a => a.userId !== userId);
}

/**
 * Reads the stored index back. Defensive on purpose: this is parsed on every
 * launch, and a malformed value (older shape, a half-written save) must mean
 * "no saved accounts", never a crash on the login screen.
 */
export function parseSavedAccounts(raw: string | null): SavedAccountMeta[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: SavedAccountMeta[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      if (typeof o.userId !== 'string' || !o.userId || seen.has(o.userId)) continue;
      if (typeof o.email !== 'string' || typeof o.name !== 'string') continue;
      seen.add(o.userId);
      out.push({
        userId: o.userId,
        name: o.name,
        email: o.email,
        role: typeof o.role === 'string' ? o.role : 'teacher',
        avatarUrl: typeof o.avatarUrl === 'string' ? o.avatarUrl : null,
        lastUsedAt: typeof o.lastUsedAt === 'number' && Number.isFinite(o.lastUsedAt) ? o.lastUsedAt : 0,
      });
    }
    return out.slice(0, MAX_SAVED_ACCOUNTS);
  } catch {
    return [];
  }
}
