/**
 * The network half of the live game.
 *
 * Host calls (`/live-host/*`) are the teacher's, through `apiJson`, so they
 * carry and refresh the session. Player calls (`/live/*`) deliberately do NOT
 * go through `apiFetch` — the same reasoning as services/studentExam.ts: a
 * student with no account must never trigger a sign-out flow, and the player
 * token belongs to this game, not to the shared token store. The one
 * exception is `joinGame`, which sends the app session ONLY if one exists, so
 * a signed-in student is recognised by the server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiJson, getAccessToken, getApiBaseUrl } from './apiClient';
import { fetchWithTimeout } from './fetchWithTimeout';
import { originHeaders } from './clientPlatform';
import {
  liveTokenKey,
  type HostGame,
  type LiveAction,
  type LiveLang,
  type LiveQuestion,
  type PlayerState,
} from './liveGame';

// ─── Host (teacher session) ─────────────────────────────────────────────────

export function createLiveGame(body: {
  title: string;
  lang: LiveLang;
  seconds?: number;
  questions: LiveQuestion[];
}): Promise<{ id: string; code: string }> {
  return apiJson('/live-host/games', { method: 'POST', body: JSON.stringify(body) });
}

export const getHostGame = (id: string): Promise<HostGame> =>
  apiJson(`/live-host/games/${encodeURIComponent(id)}`);

export const advanceGame = (id: string, action: LiveAction): Promise<HostGame> =>
  apiJson(`/live-host/games/${encodeURIComponent(id)}/advance`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });

export async function kickPlayer(id: string, playerId: string): Promise<void> {
  await apiJson(`/live-host/games/${encodeURIComponent(id)}/kick`, {
    method: 'POST',
    body: JSON.stringify({ playerId }),
  });
}

// ─── Player (no account) ────────────────────────────────────────────────────

export class LiveApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** `Retry-After` in seconds, when the server sent one (a 429). */
  readonly retryAfterSec?: number;
  constructor(message: string, status: number, code: string, retryAfterSec?: number) {
    super(message);
    this.name = 'LiveApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

async function call<T>(
  path: string,
  init: RequestInit & { liveToken?: string; bearer?: string } = {},
): Promise<T> {
  const { liveToken, bearer, ...rest } = init;
  let res: Response;
  try {
    res = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...originHeaders(),
        ...(liveToken ? { 'X-Live-Token': liveToken } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    });
  } catch (e) {
    // status 0: the request never got an answer (offline, deadline).
    throw new LiveApiError(e instanceof Error ? e.message : 'network', 0, 'network');
  }
  const text = await res.text();
  let body: { error?: string; code?: string } & Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { /* not JSON — the status is all we have */ }
  if (!res.ok) {
    const code = typeof body.code === 'string' ? body.code
      : typeof body.error === 'string' ? body.error : '';
    const retryAfter = Number(res.headers.get('Retry-After'));
    throw new LiveApiError(
      typeof body.error === 'string' ? body.error : `Request failed (${res.status})`,
      res.status,
      code,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }
  return body as T;
}

export interface JoinResult {
  playerId: string;
  playerToken: string;
  name: string;
}

export async function joinGame(code: string, name: string): Promise<JoinResult> {
  const path = `/live/${encodeURIComponent(code)}/join`;
  const init = { method: 'POST', body: JSON.stringify({ name }) };
  const bearer = (await getAccessToken().catch(() => null)) ?? undefined;
  try {
    return await call<JoinResult>(path, { ...init, bearer });
  } catch (e) {
    // An expired session must not stop a student joining as a guest.
    if (bearer && e instanceof LiveApiError && e.status === 401) return call<JoinResult>(path, init);
    throw e;
  }
}

export const getPlayerState = (code: string, token: string): Promise<PlayerState> =>
  call(`/live/${encodeURIComponent(code)}/state`, { liveToken: token });

export const submitAnswer = (
  code: string,
  token: string,
  questionIndex: number,
  choice: number,
): Promise<{ accepted: true }> =>
  call(`/live/${encodeURIComponent(code)}/answer`, {
    method: 'POST',
    liveToken: token,
    body: JSON.stringify({ questionIndex, choice }),
  });

// ─── Token, kept per code so a reload resumes ───────────────────────────────

export async function loadLiveToken(code: string): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(liveTokenKey(code))) || null;
  } catch {
    return null;
  }
}

export async function saveLiveToken(code: string, token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(liveTokenKey(code), token);
  } catch {
    /* storage is a convenience; the game still plays without it */
  }
}

export async function clearLiveToken(code: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(liveTokenKey(code));
  } catch {
    /* nothing to clear */
  }
}
