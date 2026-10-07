/**
 * A QR code for a printed link, as inline SVG — no canvas, no image file, so
 * it prints in the PDF exactly where the link is. `qrcode-generator` is pure
 * JS (MIT, no dependencies): no native module, no app version bump.
 */
import qrcode from 'qrcode-generator';

export function labQrSvg(url: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
}
