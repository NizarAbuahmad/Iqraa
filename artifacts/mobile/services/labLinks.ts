/**
 * Routes for the Science Lab. A present-mode URL is shareable, so the id that
 * arrives in the route param is untrusted: it resolves to a known item or to
 * null, never to a guess.
 */
import { getLabItem, type LabItem } from '@workspace/curriculum/lab';
import { PROD_ORIGIN } from './siteOrigin.ts';

export const LAB_ROUTE = '/curriculum/lab';

export function labItemPath(id: string): string {
  return `${LAB_ROUTE}/${encodeURIComponent(id)}`;
}

/**
 * The link a teacher pastes into a chat. Built from the production origin, not
 * `Linking.createURL`: that follows the browsing host on web (a dev host once
 * leaked into an invite) and the bare `mobile://` scheme on Android, which
 * does nothing in WhatsApp. See `services/claimCodeMessage.ts`.
 */
export function labShareUrl(id: string): string {
  return `${PROD_ORIGIN}${labItemPath(id)}`;
}

export function resolveLabParam(param: string | string[] | undefined): LabItem | null {
  const id = Array.isArray(param) ? param[0] : param;
  if (!id) return null;
  return getLabItem(id) ?? null;
}
