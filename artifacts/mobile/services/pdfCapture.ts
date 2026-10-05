/**
 * Native stub. The real implementation is `pdfCapture.web.ts`; native builds
 * export through `expo-print` instead and never call this. It exists so the
 * import in `share.ts` typechecks and so a native bundle does not pull in
 * html2canvas / jsPDF.
 */
export async function capturePdf(_iframe: HTMLIFrameElement, _filename: string): Promise<void> {
  throw new Error('capturePdf is web-only');
}
