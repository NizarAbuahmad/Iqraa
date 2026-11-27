/**
 * Turns a standalone SVG (`buildBoardPageSVG`) into a PNG and puts it where a teacher can send
 * it: the system share sheet when the browser can share files (a phone's browser: WhatsApp is
 * in it), a download otherwise (a desktop browser: drag it into WhatsApp Web).
 *
 * Web only. A native app needs a native image capture module, which is a new build rather than an
 * over-the-air update; the native board shares its PDF through the share sheet instead.
 */
import { saveBlob } from './webSave.ts';

const PNG_W = 1920;
const PNG_H = 1080;

export function svgToPngBlob(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PNG_W;
      canvas.height = PNG_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas')); return; }
      ctx.drawImage(img, 0, 0, PNG_W, PNG_H);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/png');
    };
    img.onerror = () => reject(new Error('svg did not load'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** 'shared' through the share sheet, or 'saved' as a download. Rejects only when neither worked. */
export async function shareSvgAsImage(svg: string, filename: string): Promise<'shared' | 'saved'> {
  const blob = await svgToPngBlob(svg);
  const name = filename.endsWith('.png') ? filename : `${filename}.png`;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.share && nav.canShare) {
    const file = new File([blob], name, { type: 'image/png' });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: name });
        return 'shared';
      } catch (e) {
        // The person closing the sheet is not a failure and must not also start a download.
        if (e instanceof Error && e.name === 'AbortError') return 'shared';
      }
    }
  }
  await saveBlob(blob, name);
  return 'saved';
}
