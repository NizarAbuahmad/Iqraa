/**
 * Export & sharing IO for the Iqra app: the native share sheet, the clipboard,
 * the PDF writer (expo-print) and the Word (.docx) writer.
 *
 * What this file is *not* any more: the place the exported documents are built.
 * Those moved to `exportText.ts` and `exportHtml.ts`, which import no React
 * Native and are therefore testable. This module imports `react-native` at
 * module scope, which `node:test` cannot parse — the reason for the split, and
 * the reason an RTL bug in the Arabic PDFs shipped unseen.
 *
 * Both modules are re-exported below, so every existing
 * `import { buildQuizHTML } from '@/services/share'` still resolves. Prefer
 * importing from the specific module in new code.
 */

import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { classifyDocLines, docLineText } from './docxOutline.ts';
import { trackEvent } from '@/services/analytics';

// Re-exported here so existing callers (`import { buildDeckSlidesHTML } from
// '@/services/share'`) don't need to know it actually lives in its own pure
// module — see deckSlidesHtml.ts for why it's split out.
export { buildDeckSlidesHTML } from './deckSlidesHtml.ts';

// The document builders. Pure, tested, and deliberately not in this file.
export {
  formatActivityText,
  formatAttemptResultText,
  formatLessonPlanText,
  formatQuizText,
  formatWorksheetText,
} from './exportText.ts';

export {
  buildActivityHTML,
  buildActivitySlidesHTML,
  buildLessonFlowHTML,
  buildLessonPlanHTML,
  buildLessonPlanSlidesHTML,
  buildQuizHTML,
  buildQuizSlidesHTML,
  buildWorksheetHTML,
  buildWorksheetSlidesHTML,
  type BookFigureRef,
} from './exportHtml.ts';

// ─── Clipboard ────────────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

// ─── Share as text (native share sheet) ──────────────────────────────────────

/**
 * `Share.share` throws "Share is not supported in this browser" on
 * react-native-web whenever `navigator.share` is missing — true of most
 * desktop browsers, not an edge case. Same failure shape `Alert.alert` has on
 * web (see `services/confirm.ts`): looks fine on a phone, throws in the
 * browser teachers are actually demoed on. Falls back to the clipboard rather
 * than crashing the screen, and says which one happened so the caller can
 * tell the teacher correctly.
 */
export async function shareAsText(text: string, title: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !('share' in navigator)) {
    await copyToClipboard(text);
    return 'copied';
  }
  await Share.share({ message: text, title });
  return 'shared';
}

// ─── PDF export ───────────────────────────────────────────────────────────────

/**
 * Resolves once every `<img>` in `doc` has either loaded or failed, or after
 * `maxWaitMs` — whichever comes first, so one slow/broken photo (offline,
 * hotlink blocked, whatever) can never hang the export indefinitely. An
 * already-complete image (cached, or a data: URI) resolves immediately.
 */
function waitForImages(doc: Document, maxWaitMs: number): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  const pending = images.filter(img => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return new Promise<void>(resolve => {
    let remaining = pending.length;
    const done = () => { if (--remaining <= 0) resolve(); };
    pending.forEach(img => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    setTimeout(resolve, maxWaitMs);
  });
}

/**
 * Resolves once the document's webfonts have loaded, or after `maxWaitMs`.
 * Same failure shape as the images above: the deck HTML links Almarai/Cairo
 * from Google Fonts, and printing before they arrive silently produces an
 * Arial PDF rather than erroring. `document.fonts` is absent in older
 * engines, so a missing API resolves immediately rather than blocking.
 */
function waitForFonts(doc: Document, maxWaitMs: number): Promise<void> {
  const fonts = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  if (!fonts?.ready) return Promise.resolve();
  return Promise.race([
    fonts.ready.then(() => undefined).catch(() => undefined),
    new Promise<void>(resolve => setTimeout(resolve, maxWaitMs)),
  ]);
}

export async function exportAsPDF(html: string, filename: string): Promise<void> {
  trackEvent('material_exported', { format: 'pdf' });
  if (Platform.OS === 'web') {
    // expo-print's web implementation ignores the html arg and calls window.print()
    // on the current page → blank result.  Instead, inject an iframe with our HTML
    // so the browser print dialog shows the actual lesson content.
    const iframe = document.createElement('iframe');
    // Off-screen at a real slide-sized viewport rather than 0x0: a zero-sized
    // frame lays out at zero, and images that never get a box are deprioritised
    // or skipped entirely by the engine — which is why the deck's hero photo
    // was missing from printed decks that showed it fine on screen.
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1123px;height:794px;border:none;';
    // Defense-in-depth: even though everything written below is escaped, deny
    // the iframe document script execution outright, so an escaping gap here
    // or in a future edit can't run script against our localStorage-held auth
    // tokens. `allow-same-origin` (without `allow-scripts`) is required —
    // without it the iframe gets an opaque origin and `contentDocument`
    // below returns null, breaking the print entirely. `allow-modals` is
    // required too: Chromium silently ignores `contentWindow.print()` from a
    // sandboxed frame without it — no exception, no dialog, nothing — which
    // is why this shipped looking like it worked and did nothing.
    iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    // Wait for any images (deck hero/media photos) to actually finish
    // loading before printing — a flat delay was enough when this HTML was
    // pure inline text, but an external photo is a real network fetch and a
    // fixed wait can't know how long that takes. Printing before it resolves
    // doesn't error, it just silently prints the page without the photo.
    // ponytail: 5s ceiling on the photo fetch — long enough for an Unsplash
    // hero over a school connection, short enough that a dead link doesn't
    // look like a hung export. Raise it if teachers report missing photos.
    await Promise.all([waitForImages(doc, 5000), waitForFonts(doc, 2500)]);
    iframe.contentWindow!.print();
    // Remove the iframe after the dialog has had time to open.
    setTimeout(() => document.body.removeChild(iframe), 3000);
    return;
  }
  // Native: printToFileAsync creates a proper temp PDF file.
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: filename });
}

// ─── Word (.docx) export ──────────────────────────────────────────────────────

export async function exportAsWord(
  text: string,
  filename: string,
  isAr: boolean,
): Promise<void> {
  trackEvent('material_exported', { format: 'word' });
  // Dynamic import to avoid startup cost
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');

  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const lines = text.split('\n');
  const kinds = classifyDocLines(lines);

  const children = lines.map((line, i) => {
    const kind = kinds[i]!;
    const content = docLineText(line, kind);

    switch (kind) {
      case 'blank':
        return new Paragraph({ children: [new TextRun('')] });
      // The underline belonging to the heading above has already done its
      // job by marking it; printing it would just draw dashes in the doc.
      case 'rule':
        return new Paragraph({ children: [new TextRun({ text: '', break: 1 })] });
      case 'title':
        return new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: align,
          children: [new TextRun({ text: content, bold: true, size: 32 })],
        });
      case 'heading':
        return new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: align,
          children: [new TextRun({ text: content, bold: true, size: 24 })],
        });
      case 'bullet':
        return new Paragraph({
          alignment: align,
          bullet: { level: 0 },
          children: [new TextRun({ text: content, size: 22 })],
        });
      default:
        return new Paragraph({
          alignment: align,
          children: [new TextRun({ text: content, size: 22 })],
        });
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (Platform.OS === 'web') {
    // On web, expo-file-system File API and expo-sharing are unavailable.
    // Generate a Blob and trigger a browser download instead.
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    return;
  }

  // Native: write base64 to cache then share.
  const b64 = await Packer.toBase64String(doc);
  // Use the new expo-file-system v19 File API — avoids the deprecated legacy
  // writeAsStringAsync / cacheDirectory which throw when imported from the
  // main package (not /legacy) in expo-file-system v19.
  const file = new File(Paths.cache, `${filename}.docx`);
  file.write(b64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType: MIME, dialogTitle: filename });
}
