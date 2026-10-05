/**
 * API client with automatic token refresh and auth headers.
 * Mirrors the URL pattern from RemoteAIService.
 */
import * as storage from './secureStorage';
import { fetchWithTimeout } from './fetchWithTimeout';
import { originHeaders } from './clientPlatform';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, isSessionLost } from './sessionLoss';

const LOCAL_DEV_API = 'http://localhost:8080/api';

function isLocalhostUrl(url: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
}

function warnMissingApiEnv(resolved: string, detail: string) {
  const msg =
    `[api] EXPO_PUBLIC_API_BASE_URL (or EXPO_PUBLIC_DOMAIN) is unset. ${detail} ` +
    `Resolved: ${resolved}`;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(msg);
  } else {
    console.error(msg);
  }
}

function assertNotLocalhostInProduction(url: string) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;
  if (!isLocalhostUrl(url)) return;
  console.error(
    `[api] Production build resolved API to localhost (${url}). ` +
      'Rebuild with a public EXPO_PUBLIC_API_BASE_URL — localhost will not work for users.',
  );
}

export function getApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicit) {
    const url = explicit.replace(/\/+$/, '');
    assertNotLocalhostInProduction(url);
    return url;
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain) {
    // Allow full URLs for local http; bare hostnames keep hosted https behavior.
    const url = /^https?:\/\//i.test(domain)
      ? `${domain.replace(/\/+$/, '')}/api`
      : `https://${domain}/api`;
    assertNotLocalhostInProduction(url);
    return url;
  }

  // ── Missing env ──────────────────────────────────────────────────────────
  // Dev web on :8081 must not use relative `/api` (Metro returns HTML).
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (typeof window !== 'undefined') {
      const { hostname, port } = window.location;
      if (
        (hostname === 'localhost' || hostname === '127.0.0.1') &&
        port !== '8080'
      ) {
        warnMissingApiEnv(
          LOCAL_DEV_API,
          'Using local API for Expo web. Set EXPO_PUBLIC_API_BASE_URL in artifacts/mobile/.env or the repo root .env.',
        );
        return LOCAL_DEV_API;
      }
    }

    warnMissingApiEnv(
      LOCAL_DEV_API,
      'Using local API for development. Physical devices need your LAN IP, e.g. http://192.168.x.x:8080/api.',
    );
    return LOCAL_DEV_API;
  }

  // Production without env: same-origin `/api` (reverse-proxy deployments only).
  warnMissingApiEnv(
    '/api',
    'Falling back to relative "/api" (same-origin). Set EXPO_PUBLIC_API_BASE_URL at build time.',
  );
  return '/api';
}

export async function getAccessToken(): Promise<string | null> {
  return storage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return storage.getItem(REFRESH_TOKEN_KEY);
}

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    storage.setItem(ACCESS_TOKEN_KEY, accessToken),
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    storage.deleteItem(ACCESS_TOKEN_KEY),
    storage.deleteItem(REFRESH_TOKEN_KEY),
  ]);
}

type RefreshCallback = () => Promise<string | null>;

let _onRefreshFailed: (() => void) | null = null;
let _refreshInFlight: Promise<string | null> | null = null;

export function setOnRefreshFailed(cb: () => void) {
  _onRefreshFailed = cb;
}

async function refreshAccessToken(): Promise<string | null> {
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      // The deadline here is what keeps `_refreshInFlight` from wedging: the
      // reset below lives in this IIFE's `finally`, so a refresh that never
      // settles leaves the latch set and every later 401 awaits a dead promise.
      const res = await fetchWithTimeout(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        // Only the server saying "that token is no good" ends the session. A
        // 502 from the edge or a 503 from a cold API says nothing about the
        // token, and clearing on it logged a teacher out of a working
        // session because the network blinked.
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          await clearTokens();
          _onRefreshFailed?.();
        }
        return null;
      }

      let data: { accessToken?: unknown; refreshToken?: unknown };
      try {
        data = await res.json() as typeof data;
      } catch {
        return null;
      }
      if (typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') return null;
      await storeTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      // A timeout or an offline device, not a verdict on the token: keep it
      // and let the next request try again. Reproducible before this by
      // toggling airplane mode once the access token had expired — the
      // first 401 refreshed, the refresh timed out, and the teacher landed
      // on the login screen mid-worksheet.
      return null;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

/**
 * `timeoutMs` overrides the 15s default for the handful of routes that call a
 * model and legitimately run longer. Everything else is a database read.
 */
export type ApiOptions = RequestInit & { timeoutMs?: number };

export async function apiFetch(
  path: string,
  options: ApiOptions = {},
  retry = true,
): Promise<Response> {
  const { timeoutMs, ...init } = options;
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...originHeaders(),
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, { ...init, headers }, timeoutMs);

  if (res.status === 401 && retry) {
    // Read after the response, not before the request: a sign-in that landed
    // while this was in flight must not be mistaken for a lost session.
    const hadRefreshToken = !!(await getRefreshToken());
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch(path, options, false);
    }
    // Nothing to refresh with, so `refreshAccessToken` never reported a
    // failure and the screen would keep a signed-in user that every request
    // refuses. A failed refresh already reported itself.
    if (isSessionLost(path, hadRefreshToken)) _onRefreshFailed?.();
  }

  return res;
}

/** Thrown by apiJson on a non-ok response. Carries the server's `code`
 * (e.g. "email_not_verified") alongside the human-readable message, so a
 * caller can branch on it instead of pattern-matching error text. */
export class ApiError extends Error {
  code?: string;
  /** The HTTP status, so a caller can tell "the server refused" from
   *  "the server is down" — absent when the request never got an answer. */
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Whether an error means the request never reached the server (offline,
 * DNS, the fetchWithTimeout deadline) as opposed to the server answering.
 */
export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true;
  // `fetch` rejects with a bare TypeError when the network is unreachable.
  return err instanceof TypeError && !(err instanceof ApiError);
}

export async function apiJson<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const res = await apiFetch(path, options);
  // Text first, then parse: a 502 HTML page from the edge, a 413 with a
  // plain-text body or an empty 204 used to throw SyntaxError out of
  // `res.json()` before `res.ok` was ever looked at, so callers saw a parse
  // failure instead of the status and `code` they branch on.
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const body = (data && typeof data === 'object' ? data : {}) as { error?: string; code?: string };
    throw new ApiError(body.error ?? `Request failed: ${res.status}`, body.code, res.status);
  }
  if (text && data === null) {
    throw new ApiError('Unexpected response from the server', 'bad_response', res.status);
  }
  return data as T;
}
