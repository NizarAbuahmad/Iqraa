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

import { visualForSlide } from './deckVisuals.ts';
import type { ActivitySlide, ClassroomActivity } from '@/services/ai/AIService';
import { mathLineToUnicode, prettifySymPy } from '@/services/mathRender';
import { trackEvent } from '@/services/analytics';

/** Cairo carries headings, Almarai body copy — the same split app/_layout.tsx makes on screen. */
const HEAD_FONT = 'Cairo';
const BODY_FONT = 'Almarai';

import * as theme from './deckTheme.ts';

// pptxgenjs takes hex without the leading '#'; deckTheme stores it with one.
const DECK_BG = theme.pptxHex(theme.DECK_BG);
const DECK_CARD = theme.pptxHex(theme.DECK_CARD_BG);
const DECK_BORDER = theme.pptxHex(theme.DECK_BORDER);
const DECK_TEXT = theme.pptxHex(theme.DECK_TEXT);
const DECK_MUTED = theme.pptxHex(theme.DECK_MUTED);
const DECK_ACCENT = theme.pptxHex(theme.DECK_ACCENT);
const DECK_PINK = theme.pptxHex(theme.DECK_PINK);
const DECK_BLOB = theme.pptxHex(theme.DECK_BLOB);

const deckSlideAccent = (type: ActivitySlide['type']): string =>
  theme.pptxHex(theme.slideTypeAccent(type));

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

/**
 * The two soft circles the projected slide sits on. Drawn first so every
 * later shape and text box stacks above them — pptxgenjs has no z-index, add
 * order is the whole story.
 */
function addBlobs(s: PptxSlide): void {
  const blob = { color: DECK_BLOB };
  s.addShape('ellipse', { x: -1.0, y: -1.1, w: 3.2, h: 3.2, fill: blob, line: blob });
  s.addShape('ellipse', { x: 7.9, y: 3.7, w: 3.4, h: 3.4, fill: blob, line: blob });
}

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
  // The app's real typefaces instead of Arial. PowerPoint cannot embed a font
  // from pptxgenjs — this NAMES them, so the deck renders correctly wherever
  // Cairo/Almarai are installed and falls back to a system Arabic face
  // otherwise, which is no worse than the Arial it printed before. It also
  // covers the Google Slides route: both are Google Fonts, so a .pptx
  // uploaded there resolves them from Google's own catalogue.
  // Set on the theme rather than per-run so no addText call can be missed.
  pptx.theme = { headFontFace: HEAD_FONT, bodyFontFace: BODY_FONT };

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
      const onPhoto = slide.mediaUrl ? await addHeroBackground(s, slide.mediaUrl) : false;
      if (!onPhoto) addBlobs(s);
      const [meta, ...rest] = slide.content.split('\n\n');
      s.addText('IQRA', {
        x: 0, y: 0.5, w: '100%', h: 0.4, align: 'center',
        fontSize: 12, color: onPhoto ? 'FFFFFF' : DECK_ACCENT, bold: true, charSpacing: 4,
      });
      s.addText(slide.title, {
        x: 0.6, y: 1.6, w: 8.8, h: 1.4, align: 'center',
        fontSize: 32, color: onPhoto ? 'FFFFFF' : DECK_TEXT, bold: true, fontFace: HEAD_FONT, valign: 'middle',
      });
      // The pink rule under the title — the projector's one flash of the
      // second accent, and the quickest tell that this is the same deck.
      s.addShape('rect', { x: 4.4, y: 3.0, w: 1.2, h: 0.06, fill: { color: DECK_PINK } });
      if (meta) {
        s.addText(meta, {
          x: 0.6, y: 3.2, w: 8.8, h: 0.5, align: 'center',
          fontSize: 14, color: onPhoto ? 'FFFFFF' : DECK_MUTED,
        });
      }
      if (rest.length) {
        s.addText(rest.join(' '), {
          x: 1.2, y: 3.8, w: 7.6, h: 1.2, align: 'center',
          fontSize: 11, color: onPhoto ? 'FFFFFF' : DECK_MUTED,
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
        fontSize: 36, color: 'FFFFFF', bold: true, fontFace: HEAD_FONT,
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
    addBlobs(s);

    // Header bar: accent-coloured left rule + title.
    s.addShape('rect', { x: 0, y: 0, w: 0.06, h: 0.75, fill: { color: accent } });
    s.addText(slide.title, {
      x: 0.35, y: 0.12, w: 9.3, h: 0.55, align: rtlAlign, valign: 'middle',
      fontSize: 18, color: accent, bold: true, fontFace: HEAD_FONT,
    });

    if (slide.type === 'graph') {
      const [context] = slide.content.split('\n\n');
      const commands = slide.graphCommands ?? [];
      // A NATIVE PowerPoint chart, not a picture of one. The teacher can
      // restyle it, and it stays sharp at any projector resolution. Until this
      // existed the slide printed the equation as text beside a note saying
      // the graph was interactive inside the app — an apology where the
      // mathematics should have been.
      const visual = visualForSlide(slide);
      if (visual?.kind === 'plot' && visual.series.length) {
        if (context) {
          s.addText(context, { x: 0.8, y: 1.25, w: 8.4, h: 0.5, align: 'center', fontSize: 13, color: DECK_TEXT });
        }
        s.addChart(
          'line',
          visual.series.map(series => ({
            name: series.label,
            labels: series.points.map(p => p.x.toFixed(2)),
            values: series.points.map(p => p.y),
          })),
          {
            x: 1.0, y: 1.85, w: 8.0, h: 3.2,
            showLegend: visual.series.length > 1,
            legendPos: 'b',
            lineSmooth: true,
            lineDataSymbol: 'none',
            // Sampled at 80 points — every category label would be an
            // unreadable smear along the axis.
            catAxisHidden: true,
          },
        );
        continue;
      }
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

    // Any slide may carry a visual, not just graph slides. A chart attached to
    // a content slide reached neither export until this existed — the drawing
    // was only ever wired into the graph branch above.
    const slideVisual = visualForSlide(slide);
    if (slideVisual?.kind === 'chart' && slideVisual.categories.length) {
      const [context] = slide.content.split('\n\n');
      if (context) {
        s.addText(context, { x: 0.8, y: 1.25, w: 8.4, h: 0.5, align: 'center', fontSize: 13, color: DECK_TEXT });
      }
      s.addChart(
        slideVisual.chartType === 'pie' ? 'pie' : 'bar',
        [{
          name: slide.title,
          labels: slideVisual.categories,
          values: slideVisual.values,
        }],
        {
          x: 1.4, y: 1.85, w: 7.2, h: 3.2,
          showLegend: slideVisual.chartType === 'pie',
          legendPos: 'r',
          showValue: slideVisual.chartType !== 'pie',
        },
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
        fontSize: 22, color: DECK_TEXT, bold: true,
      });
      if (slide.answer) {
        s.addShape('roundRect', {
          x: 2.0, y: 2.4, w: 6.0, h: slide.verified ? 1.6 : 1.1,
          fill: { color: DECK_CARD }, line: { color: accent, width: 1.5 }, rectRadius: 0.08,
        });
        s.addText(L('الإجابة', 'Answer'), {
          x: 2.0, y: 2.5, w: 6.0, h: 0.3, align: 'center', fontSize: 9, color: accent, bold: true,
        });
        s.addText(pptxLine(slide.answer, true), {
          x: 2.0, y: 2.8, w: 6.0, h: 0.5, align: 'center', fontSize: 16, color: DECK_TEXT, bold: true,
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

    /**
     * Whole-class MCQ. Like the HTML export, this had no branch at all until
     * now: a question slide fell through to the generic content block below
     * and printed its stem with no options, so the deck asked the class to
     * answer by letter and then showed no letters to answer with.
     *
     * The correct option is marked, matching the challenge branch above —
     * the exported file is the teacher's copy.
     */
    if (slide.type === 'question') {
      const options = slide.options ?? [];
      const letters = isAr ? ['أ', 'ب', 'ج', 'د', 'هـ'] : ['A', 'B', 'C', 'D', 'E'];
      s.addText(pptxLine(slide.content, true), {
        x: 0.6, y: 1.1, w: 8.8, h: 0.9, align: 'center', valign: 'middle',
        fontSize: 20, color: DECK_TEXT, bold: true,
      });
      const rowH = 0.62;
      const top = 2.15;
      options.forEach((opt, i) => {
        const correct = i === slide.correctIndex;
        const y = top + i * (rowH + 0.12);
        s.addShape('roundRect', {
          x: 2.0, y, w: 6.0, h: rowH,
          fill: { color: correct ? `${DECK_ACCENT}` : DECK_CARD },
          line: { color: correct ? accent : '2A2B3A', width: correct ? 1.5 : 1 },
          rectRadius: 0.08,
        });
        s.addText(`${letters[i] ?? String(i + 1)}`, {
          x: 2.15, y, w: 0.5, h: rowH, align: 'center', valign: 'middle',
          fontSize: 12, color: accent, bold: true,
        });
        s.addText(`${pptxLine(opt, true)}${correct ? '   ✓' : ''}`, {
          x: 2.65, y, w: 5.2, h: rowH, align: rtlAlign, valign: 'middle',
          fontSize: 13, color: correct ? 'FFFFFF' : DECK_TEXT, bold: correct,
        });
      });
      if (slide.verified) {
        const verifiedColor = slide.verifiedBy === 'symbolic' ? '22C55E' : DECK_MUTED;
        s.addText(
          slide.verifiedBy === 'symbolic'
            ? L('تم التحقق من الإجابة رياضيًا (SymPy)', 'Answer symbolically verified (SymPy)')
            : L('من بنك الأسئلة المُراجَع', 'From the reviewed question bank'),
          {
            x: 2.0, y: top + options.length * (rowH + 0.12) + 0.08, w: 6.0, h: 0.3,
            align: 'center', fontSize: 9, color: verifiedColor, bold: true,
          },
        );
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
