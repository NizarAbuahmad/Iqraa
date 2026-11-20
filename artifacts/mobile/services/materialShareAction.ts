/**
 * «مشاركة رابط»: the whole tap, shared by the generator screens
 * (`useGeneratorExport`) and a saved material's own screen (`workspace/view`).
 * Gets the material's code, then hands «<title> — <link>» to the share sheet,
 * which also copies it (services/shareText.ts). Returns the toast to show.
 */
import type { TranslationKey } from './i18n';
import { isLocalMaterialId, materialShareUrl, shareLinkMessage } from './materialShareLink.ts';
import { shareMaterial } from './materialShareApi';
import { shareAsText } from './share';

export async function shareMaterialLink(
  id: string | null,
  title: string,
  isAr: boolean,
  /**
   * Called once the link exists, before the share sheet opens. The sheet's
   * promise settles only when it closes (on web, when the person picks or
   * dismisses), so a screen that waits for it to show «مُشارَك برابط» shows
   * nothing while the sheet is up.
   */
  onLinkReady?: (code: string) => void,
): Promise<TranslationKey | null> {
  if (!id || isLocalMaterialId(id)) return 'shareLinkNeedsAccount';
  let code: string;
  try {
    code = await shareMaterial(id);
  } catch {
    return 'shareLinkFailed';
  }
  onLinkReady?.(code);
  try {
    // Throws only when neither the sheet nor the clipboard worked.
    const how = await shareAsText(shareLinkMessage(title, materialShareUrl(code), isAr), title);
    return how === 'copied' ? 'shareLinkCopied' : how === 'both' ? 'shareLinkAlsoCopied' : null;
  } catch {
    return 'shareLinkFailed';
  }
}
