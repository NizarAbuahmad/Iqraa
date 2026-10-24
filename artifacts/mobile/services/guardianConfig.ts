/**
 * Whether the server asks a parent to approve email students. The register screen and the three role-switch
 * screens need the answer before anyone is signed in, so it is a public GET. Fail OFF: an unreachable server
 * leaves today's behaviour (the age tick) in place, and the server's own answer to a sign-up settles it.
 */
import { useCallback, useEffect, useState } from 'react';
import { guardianApi } from './guardianApi.ts';

export type GuardianConfig = { enabled: boolean; failed?: true };

let cached: GuardianConfig | null = null;

export function resetGuardianConfigCache(): void {
  cached = null;
}

const DEFAULT_RETRY_MS = [1000, 3000];

export async function fetchGuardianConfig(
  load: () => Promise<{ enabled: boolean }> = () => guardianApi.config(),
  retryDelaysMs: number[] = DEFAULT_RETRY_MS,
): Promise<GuardianConfig> {
  if (cached) return cached;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const out = await load();
      // Only a success is cached: caching a network blip would pin the switch off for the whole session.
      cached = { enabled: out.enabled === true };
      return cached;
    } catch {
      if (attempt < retryDelaysMs.length) await new Promise(r => setTimeout(r, retryDelaysMs[attempt]));
    }
  }
  // Another call may have filled the cache while this one was retrying.
  if (cached) return cached;
  return { enabled: false, failed: true };
}

export function useGuardianConfig(): { enabled: boolean; loading: boolean; refresh: () => void } {
  const [state, setState] = useState<{ enabled: boolean; loading: boolean }>(() => (cached ? { enabled: cached.enabled, loading: false } : { enabled: false, loading: true }));
  // Bumped by `refresh()`: a screen that was refused because its copy of the switch was stale clears the cache
  // (resetGuardianConfigCache) and calls this to read it again without leaving the screen.
  const [round, setRound] = useState(0);
  const refresh = useCallback(() => setRound(n => n + 1), []);
  useEffect(() => {
    // Always ask, even if `cached` is set by now: another screen can fill it between the first render and this
    // effect, and returning early left `loading` true for good (the bug `features.ts` documents). A cache hit
    // answers without a request.
    let live = true;
    void fetchGuardianConfig().then(c => { if (live) setState({ enabled: c.enabled, loading: false }); });
    return () => { live = false; };
  }, [round]);
  return { enabled: state.enabled, loading: state.loading, refresh };
}
