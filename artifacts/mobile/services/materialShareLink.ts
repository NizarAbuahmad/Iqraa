/**
 * The share link for a saved material, `https://app.iqrra.com/m/CODE` (spec
 * docs/superpowers/specs/2026-11-20-material-share-link-design.md). Pure: the
 * calls are in materialShareApi.ts, the page is app/m/[code].tsx.
 */
import { PROD_ORIGIN } from './siteOrigin.ts';

/** Always the live site: a teacher on localhost or a preview build sends a link a colleague can open. */
export function materialShareUrl(code: string): string {
  return `${PROD_ORIGIN}/m/${code}`;
}

/** What goes into WhatsApp: the title first, so the chat says what it is before anyone taps. */
export function shareLinkMessage(title: string, url: string, isAr: boolean): string {
  return isAr ? `${title} — افتحها على إقرأ:\n${url}` : `${title} — open it on Iqrra:\n${url}`;
}

/**
 * A material saved on this device only (signed out, or the server save failed):
 * `ws_<time>_<rand>` from services/workspace.ts. The server has no row for it,
 * so it has nothing to share.
 */
export function isLocalMaterialId(id: string): boolean {
  return id.startsWith('ws_');
}
