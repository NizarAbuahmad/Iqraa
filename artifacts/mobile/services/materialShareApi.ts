/**
 * Calls for a saved material's share link (spec
 * docs/superpowers/specs/2026-11-20-material-share-link-design.md):
 * the owner makes and stops it on /workspace; anyone reads /shared/:code;
 * a teacher reads /full and saves a copy.
 */
import { apiFetch } from './apiClient';
import type { SavedMaterial } from './workspace';

export class MaterialShareError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function ok<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new MaterialShareError(`${action} failed (${res.status})`, res.status);
  return (await res.json()) as T;
}

/** The material's code, made on first call; the same on every call after. */
export async function shareMaterial(id: string): Promise<string> {
  const res = await apiFetch(`/workspace/items/${encodeURIComponent(id)}/share`, { method: 'POST' });
  return (await ok<{ shareCode: string }>(res, 'Sharing')).shareCode;
}

export async function stopSharingMaterial(id: string): Promise<void> {
  const res = await apiFetch(`/workspace/items/${encodeURIComponent(id)}/share`, { method: 'DELETE' });
  await ok(res, 'Stopping the link');
}

export interface SharedMaterialView {
  material: SavedMaterial;
  /** True when the answers are in it (a teacher's view). */
  full: boolean;
}

/**
 * The material behind a link, or null when the link is dead. `full` asks for
 * the answers, which the server gives a teacher only — so a refusal there (the
 * session is not a teacher's after all) falls back to the public read.
 */
export async function getSharedMaterial(code: string, full: boolean): Promise<SharedMaterialView | null> {
  const path = `/shared/${encodeURIComponent(code)}`;
  let res = await apiFetch(full ? `${path}/full` : path);
  if (full && (res.status === 401 || res.status === 403)) res = await apiFetch(path);
  if (res.status === 404) return null;
  const body = await ok<{ material: Omit<SavedMaterial, 'id' | 'isFavorite' | 'formState'>; full: boolean }>(res, 'Opening the link');
  const m = body.material;
  return {
    material: { ...m, id: '', language: m.language === 'en' ? 'en' : 'ar', isFavorite: false, formState: {} },
    full: body.full,
  };
}

/** A copy in the calling teacher's own files; returns its id. */
export async function saveSharedMaterial(code: string): Promise<string> {
  const res = await apiFetch(`/shared/${encodeURIComponent(code)}/save`, { method: 'POST' });
  return (await ok<{ item: { id: string } }>(res, 'Saving a copy')).item.id;
}
