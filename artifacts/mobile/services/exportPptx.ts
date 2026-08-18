/**
 * Real .pptx export for a Slides Maker deck — a native PowerPoint file the
 * teacher can open, edit, and reuse, not a PDF that merely looks like slides.
 *
 * PPTX text runs have no layout engine: there's no way to draw a stacked
 * fraction bar or a raised exponent inside a text box the way MathText.tsx
 * or the HTML export can. `mathLineToUnicode` degrades math to real Unicode
 * superscripts where one exists (covers every exponent this curriculum
 * actually uses) and parenthesized `(a)/(b)` / `√(...)` otherwise — readable,
 * and the teacher can still reshape it once the file is open in PowerPoint.
 *
 * Save/share follows the exact pattern `exportAsWord` already established for
 * `docx` in `share.ts`: a Blob + browser download on web, a base64 write to
 * cache + the native share sheet everywhere else. Kept in its own module
 * (rather than folded into share.ts) because pptxgenjs is a meaningfully
 * larger dependency than docx and this way it only loads when exported.
 */
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import type { ActivitySlide, ClassroomActivity } from '@/services/ai/AIService';
import { mathLineToUnicode, prettifySymPy } from '@/services/mathRender';
import { trackEvent } from '@/services/analytics';

const DECK_BG = '0D0D14';
const DECK_TEXT = 'F2F2F6';
const DECK_MUTED = '8B8CA4';
const DECK_ACCENT = '4F46E5';

function deckSlideAccent(type: ActivitySlide['type']): string {
  if (type === 'challenge') return 'E67E22';
  if (type === 'summary') return DECK_ACCENT;
  if (type === 'graph') return '0EA5E9';
  if (type === 'divider') return DECK_ACCENT;
  return DECK_MUTED;
}

/**
 * Fetches an image URL ourselves and hands pptxgenjs the raw bytes (`data:`)
 * instead of a remote `path`. pptxgenjs's own remote-image path does an
 * internal XHR/https fetch with no error boundary the caller can react to —
 * if that fetch fails (offline, a CORS-restrictive host, a dead link), the
 * whole `pptx.write()` call rejects and the export fails outright. Fetching
 * up front means a failed photo degrades to "no photo on this slide",
 * matching the unconfigured-key fallback, rather than losing the export.
 */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Full-bleed cover image plus a dark scrim, for the title slide and dividers.
 * pptxgenjs has no gradient fill, so the scrim is one flat semi-transparent
 * rectangle rather than the top-to-bottom fade the HTML/native versions use.
 * Returns whether a photo was actually placed, so the caller can fall back
 * to a flat accent panel when the fetch above came back empty.
 */
type PptxSlide = ReturnType<InstanceType<typeof import('pptxgenjs').default>['addSlide']>;

async function addHeroBackground(s: PptxSlide, url: string): Promise<boolean> {
  const dataUrl = await fetchAsDataUrl(url);
  if (!dataUrl) return false;
  s.addImage({ data: dataUrl, x: 0, y: 0, w: 10, h: 5.63, sizing: { type: 'cover', w: 10, h: 5.63 } });
  s.addShape('rect', { x: 0, y: 0, w: 10, h: 5.63, fill: { color: DECK_BG, transparency: 25 } });
  return true;
}

/** A line rendered for a PowerPoint text run: math-aware, HTML-safe is moot (no HTML here). */
function pptxLine(line: string, isEquation: boolean): string {
  return isEquation ? mathLineToUnicode(line) : line;
}

export async function exportDeckAsPptx(
  deck: ClassroomActivity,
  isAr: boolean,
  filename: string,
): Promise<void> {
  trackEvent('material_exported', { format: 'pptx' });
  // Dynamic import: pptxgenjs is a meaningfully sized dependency, loaded only
  // when a teacher actually exports — same reasoning as docx in share.ts.
  const PptxGenJS = (await import('pptxgenjs')).default;
  const L = (ar: string, en: string) => (isAr ? ar : en);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'IQRA_16x9', width: 10, height: 5.63 });
  pptx.layout = 'IQRA_16x9';
  pptx.rtlMode = isAr;

  const rtlAlign: 'right' | 'left' = isAr ? 'right' : 'left';

  // A for-of loop, not forEach, because addHeroBackground fetches the photo
  // itself now (see its comment) — forEach can't be awaited, so the fetch
  // would still be in flight when pptx.write() below runs and the image
  // would silently never make it into the file.
  for (const [i, slide] of deck.slides.entries()) {
    const s = pptx.addSlide();
    s.background = { color: DECK_BG };

    if (i === 0) {
      // Title slide.
      if (slide.mediaUrl) await addHeroBackground(s, slide.mediaUrl);
      const [meta, ...rest] = slide.content.split('\n\n');
      s.addText('IQRA', {
        x: 0, y: 0.5, w: '100%', h: 0.4, align: 'center',
        fontSize: 12, color: 'A5B4FC', bold: true, charSpacing: 4,
      });
      s.addText(slide.title, {
        x: 0.6, y: 1.6, w: 8.8, h: 1.4, align: 'center',
        fontSize: 32, color: 'FFFFFF', bold: true, fontFace: 'Arial', valign: 'middle',
      });
      if (meta) {
        s.addText(meta, {
          x: 0.6, y: 3.0, w: 8.8, h: 0.5, align: 'center',
          fontSize: 14, color: DECK_MUTED,
        });
      }
      if (rest.length) {
        s.addText(rest.join(' '), {
          x: 1.2, y: 3.6, w: 7.6, h: 1.2, align: 'center',
          fontSize: 11, color: DECK_MUTED,
        });
      }
      continue;
    }

    if (slide.type === 'divider') {
      // Full-bleed, like the title slide — a pacing break, not another
      // header-bar-and-bullets content slide.
      const gotPhoto = slide.mediaUrl ? await addHeroBackground(s, slide.mediaUrl) : false;
      if (!gotPhoto) s.background = { color: deckSlideAccent('divider') };
      s.addText(slide.title, {
        x: 0.6, y: 2.1, w: 8.8, h: 1.2, align: 'center', valign: 'middle',
        fontSize: 36, color: 'FFFFFF', bold: true, fontFace: 'Arial',
      });
      if (slide.content) {
        s.addText(slide.content, {
          x: 1.2, y: 3.3, w: 7.6, h: 0.6, align: 'center',
          fontSize: 14, color: 'FFFFFF',
        });
      }
      continue;
    }

    const accent = deckSlideAccent(slide.type);

    // Header bar: accent-coloured left rule + title.
    s.addShape('rect', { x: 0, y: 0, w: 0.06, h: 0.75, fill: { color: accent } });
    s.addText(slide.title, {
      x: 0.35, y: 0.12, w: 9.3, h: 0.55, align: rtlAlign, valign: 'middle',
      fontSize: 18, color: accent, bold: true, fontFace: 'Arial',
    });

    if (slide.type === 'graph') {
      const [context] = slide.content.split('\n\n');
      const commands = slide.graphCommands ?? [];
      let y = 1.3;
      if (context) {
        s.addText(context, { x: 0.8, y, w: 8.4, h: 0.6, align: 'center', fontSize: 13, color: DECK_TEXT });
        y += 0.8;
      }
      if (commands.length) {
        s.addText(commands.join('   •   '), {
          x: 0.8, y, w: 8.4, h: 0.5, align: 'center', fontSize: 16, color: accent, bold: true,
        });
        y += 0.7;
      }
      s.addText(
        L(
          'الرسم البياني تفاعلي داخل التطبيق — افتح الشرائح على الشاشة لتحريكه أمام الصف.',
          'The graph is interactive inside the app — open the deck on screen to move it live in front of the class.',
        ),
        { x: 1.2, y, w: 7.6, h: 0.8, align: 'center', fontSize: 10, color: DECK_MUTED },
      );
      continue;
    }

    if (slide.type === 'media' && slide.mediaKind === 'image' && slide.mediaUrl) {
      const dataUrl = await fetchAsDataUrl(slide.mediaUrl);
      if (dataUrl) {
        s.addImage({
          data: dataUrl, x: 2.0, y: 1.2, w: 6.0, h: 3.4, sizing: { type: 'cover', w: 6.0, h: 3.4 },
        });
      }
      if (slide.mediaCaption) {
        s.addText(slide.mediaCaption, {
          x: 0.8, y: 4.75, w: 8.4, h: 0.4, align: 'center', fontSize: 10, color: DECK_MUTED,
        });
      }
      continue;
    }

    if (slide.type === 'media' && slide.mediaKind === 'video' && slide.mediaUrl) {
      // PowerPoint can embed an online video, but only via a player shim that
      // varies by PowerPoint version and often fails offline or on mobile —
      // an inert placeholder in front of a class. A real hyperlink always
      // works, in every version, and matches what the PDF export does.
      if (slide.mediaCaption) {
        s.addText(slide.mediaCaption, {
          x: 0.8, y: 1.5, w: 8.4, h: 1.2, align: 'center', valign: 'middle',
          fontSize: 15, color: DECK_TEXT,
        });
      }
      s.addText(`▶ ${L('شاهد الفيديو', 'Watch the video')}`, {
        x: 3.0, y: 2.9, w: 4.0, h: 0.5, align: 'center', valign: 'middle',
        fontSize: 16, color: 'B45309', bold: true,
        hyperlink: { url: slide.mediaUrl },
      });
      s.addText(slide.mediaUrl, {
        x: 1.2, y: 3.6, w: 7.6, h: 0.4, align: 'center', fontSize: 9, color: DECK_MUTED,
      });
      if (slide.content) {
        s.addText(slide.content, {
          x: 1.2, y: 4.05, w: 7.6, h: 0.4, align: 'center', fontSize: 10, color: DECK_MUTED,
        });
      }
      continue;
    }

    if (slide.type === 'challenge') {
      s.addText(pptxLine(slide.content, true), {
        x: 0.6, y: 1.2, w: 8.8, h: 1.0, align: 'center', valign: 'middle',
        fontSize: 22, color: 'FFFFFF', bold: true,
      });
      if (slide.answer) {
        s.addShape('roundRect', {
          x: 2.0, y: 2.4, w: 6.0, h: slide.verified ? 1.6 : 1.1,
          fill: { color: '1A1B26' }, line: { color: accent, width: 1.5 }, rectRadius: 0.08,
        });
        s.addText(L('الإجابة', 'Answer'), {
          x: 2.0, y: 2.5, w: 6.0, h: 0.3, align: 'center', fontSize: 9, color: accent, bold: true,
        });
        s.addText(pptxLine(slide.answer, true), {
          x: 2.0, y: 2.8, w: 6.0, h: 0.5, align: 'center', fontSize: 16, color: 'FFFFFF', bold: true,
        });
        if (slide.verified) {
          const verifiedColor = slide.verifiedBy === 'symbolic' ? '22C55E' : DECK_MUTED;
          const label = slide.verifiedBy === 'symbolic'
            ? L('تم التحقق من الإجابة رياضيًا (SymPy)', 'Answer symbolically verified (SymPy)')
            : L('من بنك الأسئلة المُراجَع', 'From the reviewed question bank');
          s.addText(label, {
            x: 2.0, y: 3.35, w: 6.0, h: 0.3, align: 'center', fontSize: 9, color: verifiedColor, bold: true,
          });
          if (slide.verifiedBy === 'symbolic' && slide.computedAnswer) {
            s.addText(
              `${L('حسبها المُحقِّق مستقلًّا', 'Verifier computed independently')}: ${mathLineToUnicode(prettifySymPy(slide.computedAnswer))}`,
              { x: 2.0, y: 3.62, w: 6.0, h: 0.3, align: 'center', fontSize: 8, color: DECK_MUTED },
            );
          }
        }
      }
      continue;
    }

    // Generic content slide: one text block per line, matching how the
    // projector reads them — a short list, not a paragraph.
    const lines = slide.content.split('\n').filter(Boolean);
    s.addText(
      lines.map(l => ({
        text: pptxLine(l, false),
        options: { fontSize: 14, color: DECK_TEXT, breakLine: true, paraSpaceAfter: 10 },
      })),
      { x: 0.8, y: 1.15, w: 8.4, h: 4.0, align: rtlAlign, valign: 'top' },
    );
  }

  const outFilename = `${filename}.pptx`;

  if (Platform.OS === 'web') {
    // Same pattern as exportAsWord: generate a Blob and trigger a browser
    // download — expo-file-system/expo-sharing are unavailable on web.
    const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    return;
  }

  const b64 = (await pptx.write({ outputType: 'base64' })) as string;
  const file = new File(Paths.cache, outFilename);
  file.write(b64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    dialogTitle: filename,
  });
}
