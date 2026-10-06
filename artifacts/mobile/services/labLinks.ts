/**
 * Routes for the Science Lab. A present-mode URL is shareable, so the id that
 * arrives in the route param is untrusted: it resolves to a known item or to
 * null, never to a guess.
 */
import { getLabItem, type LabItem } from '@workspace/curriculum/lab';

export const LAB_ROUTE = '/curriculum/lab';

export function labItemPath(id: string): string {
  return `${LAB_ROUTE}/${encodeURIComponent(id)}`;
}

export function resolveLabParam(param: string | string[] | undefined): LabItem | null {
  const id = Array.isArray(param) ? param[0] : param;
  if (!id) return null;
  return getLabItem(id) ?? null;
}
