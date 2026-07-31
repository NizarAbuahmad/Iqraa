/**
 * API client with automatic token refresh and auth headers.
 * Mirrors the URL pattern from RemoteAIService.
 */
import * as storage from './secureStorage';

const ACCESS_TOKEN_KEY = 'iqra_access_token';
const REFRESH_TOKEN_KEY = 'iqra_refresh_token';

export function getApiBaseUrl(): string {
  // Local / explicit override (e.g. http://localhost:8080/api)
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain) {
    // Allow full URLs for local http; bare hostnames keep Replit https behavior.
    if (/^https?:\/\//i.test(domain)) {
      return `${domain.replace(/\/+$/, '')}/api`;
    }
    return `https://${domain}/api`;
  }

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
