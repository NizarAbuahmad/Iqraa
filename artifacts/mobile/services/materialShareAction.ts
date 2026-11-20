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

export async function shareMaterialLink(id: string | null, title: string, isAr: boolean): Promise<TranslationKey | null> {
  if (!id || isLocalMaterialId(id)) return 'shareLinkNeedsAccount';
  let code: string;
  try {
    code = await shareMaterial(id);
  } catch {
    return 'shareLinkFailed';
  }
  const how = await shareAsText(shareLinkMessage(title, materialShareUrl(code), isAr), title);
  return how === 'copied' ? 'shareLinkCopied' : how === 'both' ? 'shareLinkAlsoCopied' : null;
}
