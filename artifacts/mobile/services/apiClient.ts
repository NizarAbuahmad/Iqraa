/**
 * API client with automatic token refresh and auth headers.
 * Mirrors the URL pattern from RemoteAIService.
 */
import * as storage from './secureStorage';

const ACCESS_TOKEN_KEY = 'iqra_access_token';
const REFRESH_TOKEN_KEY = 'iqra_refresh_token';

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

      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await clearTokens();
        _onRefreshFailed?.();
        return null;
      }

      const data = await res.json() as { accessToken: string; refreshToken: string };
      await storeTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      await clearTokens();
      _onRefreshFailed?.();
      return null;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch(path, options, false);
    }
  }

  return res;
}

export async function apiJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return data as T;
}
