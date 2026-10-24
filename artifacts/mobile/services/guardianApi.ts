/**
 * Calls for parent approval. The parent's page has no account, so its three calls (config, lookup, decide) go
 * out WITHOUT the app's session and without the refresh-and-sign-out behaviour of `apiFetch`, the same rule
 * `services/studentExam.ts` follows. `request` is the student's own call and uses the authenticated client.
 *
 * Dependencies are injected so `node --test` can load this file: the real ones import `apiClient`, which pulls
 * in secure storage.
 */
import { fetchWithTimeout } from './fetchWithTimeout.ts';

export class GuardianApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GuardianApiError';
    this.status = status;
    this.code = code;
  }
}

export type ConsentLookup =
  | { status: 'open'; childFirstName: string }
  | { status: 'expired' | 'decided' | 'invalid' };

export type GuardianRequestResult = { parentEmailMasked: string; emailSent: boolean; expiresAt: string | null };

type ApiJson = <T>(path: string, init?: RequestInit) => Promise<T>;

export interface GuardianApiDeps {
  baseUrl: () => Promise<string>;
  fetchImpl?: typeof fetch;
  apiJson?: ApiJson;
}

export function makeGuardianApi(deps: GuardianApiDeps) {
  async function publicCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${await deps.baseUrl()}${path}`;
    const init: RequestInit = {
      method,
      // No body, no Content-Type: a plain GET stays a simple request and avoids a CORS preflight on web.
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    };
    let res: Response;
    try {
      res = deps.fetchImpl ? await deps.fetchImpl(url, init) : await fetchWithTimeout(url, init);
    } catch {
      throw new GuardianApiError('Network request failed', 0);
    }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      throw new GuardianApiError(
        typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`,
        res.status,
        typeof json?.code === 'string' ? json.code : undefined,
      );
    }
    return json as T;
  }

  return {
    async config(): Promise<{ enabled: boolean }> {
      const body = await publicCall<{ enabled?: unknown } | null>('GET', '/guardian-consent/config');
      return { enabled: body?.enabled === true };
    },

    async lookup(token: string): Promise<ConsentLookup> {
      let body: any;
      try {
        body = await publicCall<any>('POST', '/guardian-consent/lookup', { token });
      } catch (e) {
        // Approval switched off (or off mid-session): to the parent that is a link that does not work, not a retry.
        if (e instanceof GuardianApiError && e.status === 404 && e.code === 'guardian_approval_disabled') return { status: 'invalid' };
        throw e;
      }
      if (body?.status === 'open' && typeof body.childFirstName === 'string') return { status: 'open', childFirstName: body.childFirstName };
      if (body?.status === 'expired' || body?.status === 'decided') return { status: body.status };
      return { status: 'invalid' };
    },

    async decide(token: string, decision: 'approved' | 'declined', confirmGuardian: boolean): Promise<{ decision: 'approved' | 'declined' }> {
      const body = await publicCall<{ decision?: unknown } | null>('POST', '/guardian-consent/decide', { token, decision, confirmGuardian });
      // A 200 that is not the answer we expect must not read as a recorded decision.
      if (body?.decision !== 'approved' && body?.decision !== 'declined') throw new GuardianApiError('Unexpected response', 200);
      return { decision: body.decision };
    },

    async request(parentEmail: string): Promise<GuardianRequestResult> {
      if (!deps.apiJson) throw new Error('guardianApi.request needs an authenticated client');
      return deps.apiJson<GuardianRequestResult>('/auth/guardian-request', { method: 'POST', body: JSON.stringify({ parentEmail }) });
    },
  };
}

/** The real thing: the lazy imports keep `apiClient` out of what `node --test` loads. */
export const guardianApi = makeGuardianApi({
  baseUrl: async () => (await import('./apiClient')).getApiBaseUrl(),
  apiJson: async (path, init) => (await import('./apiClient')).apiJson(path, init),
});
