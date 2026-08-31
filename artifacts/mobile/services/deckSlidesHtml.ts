/**
 * Slides HTML (Slides Maker deck) — the projector deck exported to PDF.
 *
 * Every "Slides HTML" builder in share.ts is a light, print-optimised
 * handout — correct for a worksheet or lesson plan going through a printer.
 * This one is not that: it is the projector deck itself, exported so a
 * teacher can present from PowerPoint/Google Slides/Preview when the app
 * isn't in front of the class, or file it for later. It renders the SAME
 * `ClassroomActivity` object the presenter shows on screen — same dark
 * background, same per-type accent colour, same math layout, same
 * verification badge — because a deck that looked different exported than it
 * did on the projector would just be a second, wrong deck.
 *
 * Pure logic, no React Native — kept out of share.ts deliberately, since that
 * file imports `react-native` at module scope (for Platform/Share), which
 * node:test cannot parse. Everything here only imports other pure modules,
 * so it's directly testable.
 */
import { visualForSlide, visualToSvg } from './deckVisuals.ts';
import { isBulletLine, looksLikeEquation, splitEmoji, stripBullet } from './deckText.ts';
import type { ActivitySlide, ClassroomActivity } from './ai/AIService.ts';
import { hasRenderableMath, isolateForeignRuns, mathLineToHtml, MATH_HTML_STYLES, prettifySymPy } from './mathRender.ts';

import {
  DECK_ACCENT, DECK_BG, DECK_BLOB, DECK_BORDER, DECK_CARD_BG, DECK_MUTED,
  DECK_PINK, DECK_TEXT, slideTypeAccent as deckSlideAccent,
} from './deckTheme.ts';

function deckSlideEmoji(type: ActivitySlide['type']): string {
  if (type === 'challenge') return '🔐';
  if (type === 'summary') return '🎉';
  if (type === 'graph') return '📈';
  if (type === 'question') return '🙋';
  return '🎯';
}

/** Escape only. For attribute values — above all the media and video URLs,
 *  which must not carry the directional isolates `esc` adds. */
const escAttr = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Escape *and* bidi-isolate. A handout printed from a deck carries the same
 * model-written Arabic-with-equations the projector shows, and reordering
 * «f(x) = 2x⁴ - x² + 3» on paper is worse than on screen: nobody in the room
 * can reload it. `escAttr` is the deliberate opt-out for URL attributes.
 */
const esc = (s: string) => escAttr(isolateForeignRuns(s));

/**
 * A URL printed as visible text — one left-to-right unit, isolated whole.
 * Run detection would cut it at the `://` (a colon is not a maths character),
 * leaving the scheme free to swap sides with the host on an RTL page.
 */
const escUrlText = (s: string) => `\u2066${escAttr(s)}\u2069`;

/**
 * The slide header: section glyph in a chip, title on the reading edge, accent
 * rule under it — the row `SlideView` draws on screen.
 *
 * The glyph comes off the title itself when there is one. Every branch used to
 * hard-code an emoji AND print the untouched title next to it, so a heading
 * like "🎯 نتاجات التعلم" reached the PDF with its target twice.
 */
function deckHeader(title: string, accent: string, fallbackGlyph: string): string {
  const [glyph, heading] = splitEmoji(title);
  return `<div class="deck-header" style="border-color:${accent}44">
        <span class="deck-emoji">${glyph || fallbackGlyph}</span>
        <span class="deck-eyebrow" style="color:${accent}">${esc(heading)}</span>
      </div>`;
}

/** Full-bleed photo + dark gradient, or a flat accent panel with no photo — used by both the title and divider slides. */
function deckHeroLayer(mediaUrl: string | undefined): string {
  if (!mediaUrl) return '';
  return `<img class="deck-hero-img" src="${mediaUrl.replace(/"/g, '&quot;')}" alt="" />
      <div class="deck-hero-gradient"></div>`;
}

/**
 * One body line of a content slide, laid out the way the projector lays it
 * out: a bullet becomes a bordered card with an accent bar, an equation gets
 * its own box, everything else is a plain line. The export used to print all
 * three as identical small paragraphs, which is most of what "the PDF doesn't
 * look like the deck" meant.
 */
function deckBodyLine(line: string, accent: string): string {
  if (!line.trim()) return '';
  if (isBulletLine(line)) {
    return `<div class="deck-card">
          <span class="deck-card-bar" style="background:${accent}"></span>
          <span class="deck-card-text">${esc(stripBullet(line))}</span>
        </div>`;
  }
  if (looksLikeEquation(line)) {
    return `<div class="deck-formula">${
      hasRenderableMath(line) ? mathLineToHtml(line) : esc(line)
    }</div>`;
  }
  return `<div class="deck-line">${esc(line)}</div>`;
}

/** One content line, math-aware — mirrors MathText.tsx's decision on native. */
function deckContentLine(line: string, isEquation: boolean): string {
  if (!line.trim()) return '';
  const cls = isEquation && hasRenderableMath(line) ? 'deck-eq' : 'deck-line';
  // The plain-text branch is the printed twin of the projector's plain <Text>
  // fallback — the one that showed «f(x) = 2x⁴ - x² + 3» reordered. It needs
  // the same isolation; the mathLineToHtml branch builds its own markup.
  const html = isEquation && hasRenderableMath(line) ? mathLineToHtml(line) : esc(line);
  return `<div class="${cls}">${html}</div>`;
}

export function buildDeckSlidesHTML(deck: ClassroomActivity, isAr: boolean): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const total = deck.slides.length;

  const footer = (num: number) => `
    <div class="deck-footer">
      <span>${L('أُنشئ بواسطة إقرأ — مساعد التدريس الذكي', 'Generated by Iqra — AI Teaching Assistant')}</span>
      <span>${num} / ${total}</span>
    </div>`;

  const titleSlide = (slide: ActivitySlide, num: number) => {
    const [meta, ...rest] = slide.content.split('\n\n');
    return `<div class="deck-slide deck-title-slide${slide.mediaUrl ? ' deck-on-photo' : ''}">
      ${deckHeroLayer(slide.mediaUrl)}
      <div class="deck-title-content">
        <div class="deck-title-badge">IQRA</div>
        <h1 class="deck-title-main">${esc(slide.title)}</h1>
        <div class="deck-title-rule"></div>
        ${meta ? `<div class="deck-title-meta">${esc(meta)}</div>` : ''}
        ${rest.length ? `<div class="deck-title-summary">${esc(rest.join(' '))}</div>` : ''}
      </div>
      ${footer(num)}</div>`;
  };

  const dividerSlide = (slide: ActivitySlide, num: number) => {
    const accent = deckSlideAccent('divider');
    return `<div class="deck-slide deck-divider-slide" style="${slide.mediaUrl ? '' : `background:${accent}`}">
      ${deckHeroLayer(slide.mediaUrl)}
      <div class="deck-divider-content">
        <h1 class="deck-divider-title">${esc(slide.title)}</h1>
        ${slide.content ? `<div class="deck-divider-subtitle">${esc(slide.content)}</div>` : ''}
      </div>
      ${footer(num)}</div>`;
  };

  /**
   * The plotted curve a slide carries, if any.
   *
   * Split out of `contentSlide` because question and challenge slides need it
   * too: a check whose stem says «في الرسم البياني الظاهر…» now carries the
   * `graphCommands` for that figure (see lessonSlides.ts), and the printed
   * deck has to draw it for the same reason the projected one does.
   */
  const slidePlot = (slide: ActivitySlide) => {
    const visual = visualForSlide(slide);
    const svg = visual ? visualToSvg(visual, 640, 320) : '';
    return svg ? `<div class="deck-plot">${svg}</div>` : '';
  };

  const graphSlide = (slide: ActivitySlide, num: number) => {
    const accent = deckSlideAccent('graph');
    const commands = slide.graphCommands ?? [];
    const [context] = slide.content.split('\n\n');
    // The curve itself, drawn as inline SVG. Until this existed the export
    // printed `f(x)=x^2` as a text chip beside a note saying the graph was
    // interactive inside the app — so the most valuable picture in a maths
    // deck was absent from the file that goes on the projector. Inline rather
    // than an <img> so it is vector-sharp in print and there is no asset to
    // fetch and race.
    const svg = (() => {
      const visual = visualForSlide(slide);
      return visual ? visualToSvg(visual, 640, 320) : '';
    })();
    return `<div class="deck-slide">
      ${deckHeader(slide.title, accent, '📈')}
      <div class="deck-body deck-body-center">
        ${context ? `<div class="deck-line" style="text-align:center;margin-bottom:18px">${esc(context)}</div>` : ''}
        <div class="deck-chip-row">
          ${commands.map(c => `<span class="deck-chip" style="border-color:${accent}66;color:${accent}">${esc(c)}</span>`).join('')}
        </div>
        ${svg ? `<div class="deck-plot">${svg}</div>` : ''}
        ${svg ? '' : `<div class="deck-graph-note">${L(
          'الرسم البياني تفاعلي داخل التطبيق — افتح الشرائح على الشاشة لتحريك المنحنى مباشرة أمام الصف.',
          'The graph is interactive inside the app — open the deck on screen to drag the curve live in front of the class.',
        )}</div>`}
      </div>
      ${footer(num)}</div>`;
  };

  const challengeSlide = (slide: ActivitySlide, num: number) => {
    const accent = deckSlideAccent('challenge');
    const verifiedBadge = slide.verified ? `
      <div class="deck-verified" style="color:${slide.verifiedBy === 'symbolic' ? '#22C55E' : DECK_MUTED}">
        ${slide.verifiedBy === 'symbolic' ? '🛡️' : '📚'}
        ${slide.verifiedBy === 'symbolic' ? L('تم التحقق من الإجابة رياضيًا (SymPy)', 'Answer symbolically verified (SymPy)') : L('من بنك الأسئلة المُراجَع', 'From the reviewed question bank')}
        ${slide.verifiedBy === 'symbolic' && slide.computedAnswer ? `<div class="deck-evidence">${L('حسبها المُحقِّق مستقلًّا', 'Verifier computed independently')}: ${mathLineToHtml(prettifySymPy(slide.computedAnswer))}</div>` : ''}
      </div>` : '';
    return `<div class="deck-slide">
      ${deckHeader(slide.title, accent, '🔐')}
      <div class="deck-body deck-body-center">
        ${deckContentLine(slide.content, true)}
        ${slidePlot(slide)}
        ${slide.answer ? `
          <div class="deck-answer" style="border-color:${accent}44">
            <div class="deck-answer-label" style="color:${accent}">${L('الإجابة', 'Answer')}</div>
            <div class="deck-eq">${mathLineToHtml(slide.answer)}</div>
            ${verifiedBadge}
          </div>` : ''}
      </div>
      ${footer(num)}</div>`;
  };

  const mediaSlide = (slide: ActivitySlide, num: number) => {
    const accent = deckSlideAccent(slide.type);
    return `<div class="deck-slide">
      ${deckHeader(slide.title, accent, '🖼️')}
      <div class="deck-body deck-body-center deck-body-media">
        <img class="deck-media-img" src="${escAttr(slide.mediaUrl ?? '')}" alt="${esc(slide.mediaCaption ?? '')}" />
        ${slide.mediaCaption ? `<div class="deck-media-caption">${esc(slide.mediaCaption)}</div>` : ''}
      </div>
      ${footer(num)}</div>`;
  };

  /**
   * A video can't play in a PDF. Rather than dropping the slide (the teacher
   * would lose the link entirely) or faking a player, this prints the link
   * as a real clickable anchor plus the URL in plain text — so it works both
   * on screen and on paper, where a printed page can only be typed back in.
   */
  const videoSlide = (slide: ActivitySlide, num: number) => {
    const accent = '#B45309';
    const url = slide.mediaUrl ?? '';
    return `<div class="deck-slide">
      ${deckHeader(slide.title, accent, '🎬')}
      <div class="deck-body deck-body-center">
        ${slide.mediaCaption ? `<div class="deck-video-title">${esc(slide.mediaCaption)}</div>` : ''}
        <a class="deck-video-link" style="border-color:${accent}66;color:${accent}" href="${escAttr(url)}">▶ ${L('شاهد الفيديو', 'Watch the video')}</a>
        <div class="deck-video-url">${escUrlText(url)}</div>
        ${slide.content ? `<div class="deck-video-note">${esc(slide.content)}</div>` : ''}
      </div>
      ${footer(num)}</div>`;
  };

  /**
   * Whole-class MCQ. Until this existed the exports had no `question` branch
   * at all, so these fell through to the generic content slide and printed as
   * a bare stem: the projected deck asked the class to answer by letter and
   * the PDF showed no letters to answer with.
   *
   * The correct option is marked, matching what `challengeSlide` already does
   * with worked-example answers — the exported file is the teacher's copy,
   * and the live presenter is where the reveal is held back.
   */
  const questionSlide = (slide: ActivitySlide, num: number) => {
    const accent = deckSlideAccent('question');
    const options = slide.options ?? [];
    const letters = isAr ? ['أ', 'ب', 'ج', 'د', 'هـ'] : ['A', 'B', 'C', 'D', 'E'];
    const verifiedBadge = slide.verified ? `
      <div class="deck-verified" style="color:${slide.verifiedBy === 'symbolic' ? '#22C55E' : DECK_MUTED}">
        ${slide.verifiedBy === 'symbolic' ? '🛡️' : '📚'}
        ${slide.verifiedBy === 'symbolic' ? L('تم التحقق من الإجابة رياضيًا (SymPy)', 'Answer symbolically verified (SymPy)') : L('من بنك الأسئلة المُراجَع', 'From the reviewed question bank')}
      </div>` : '';
    return `<div class="deck-slide">
      ${deckHeader(slide.title, accent, '🙋')}
      <div class="deck-body deck-body-center">
        ${deckContentLine(slide.content, true)}
        ${slidePlot(slide)}
        <div class="deck-options">
          ${options.map((opt, i) => {
            const correct = i === slide.correctIndex;
            return `<div class="deck-option${correct ? ' deck-option-correct' : ''}"${correct ? ` style="border-color:${accent}"` : ''}>
              <span class="deck-option-letter" style="color:${accent}">${letters[i] ?? String(i + 1)}</span>
              <span class="deck-option-text">${mathLineToHtml(opt)}</span>
              ${correct ? `<span class="deck-option-tick" style="color:${accent}">✓</span>` : ''}
            </div>`;
          }).join('')}
        </div>
        ${verifiedBadge}
      </div>
      ${footer(num)}</div>`;
  };

  const contentSlide = (slide: ActivitySlide, num: number) => {
    const accent = deckSlideAccent(slide.type);
    const lines = slide.content.split('\n').filter(Boolean);
    return `<div class="deck-slide">
      ${deckHeader(slide.title, accent, deckSlideEmoji(slide.type))}
      <div class="deck-body">
        ${lines.map(l => deckBodyLine(l, accent)).join('')}
        ${/* Any slide may carry a visual, not just graph slides. A chart
             attached to a content slide rendered nowhere in the exports until
             this existed — the drawing was only ever wired into the graph
             branch. */ slidePlot(slide)}
      </div>
      ${footer(num)}</div>`;
  };

  const slidesHtml = deck.slides.map((slide, i) => {
    const num = i + 1;
    if (i === 0) return titleSlide(slide, num);
    if (slide.type === 'graph') return graphSlide(slide, num);
    if (slide.type === 'challenge') return challengeSlide(slide, num);
    if (slide.type === 'question') return questionSlide(slide, num);
    if (slide.type === 'media' && slide.mediaKind === 'image') return mediaSlide(slide, num);
    if (slide.type === 'media' && slide.mediaKind === 'video') return videoSlide(slide, num);
    if (slide.type === 'divider') return dividerSlide(slide, num);
    return contentSlide(slide, num);
  }).join('\n');

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<!--
  The app's real typefaces, rather than the generic Arial this used to print
  in. Linked from Google Fonts instead of base64-embedded: the four faces are
  ~440KB, which would sit in the repo AND in every user's JS bundle including
  those who never export. This export already fetches remote images, so it
  already assumes network; with none, the stack below falls back to Arial —
  exactly what it printed before, so offline is no worse than today.

  These being Google Fonts is also what makes a .pptx uploaded to Google
  Slides resolve them (see exportPptx.ts).
-->
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Cairo:wght@500;600;700&display=swap" rel="stylesheet"/>
<style>
@page { size: A4 landscape; margin: 0; }
/* Chrome and Safari drop every background colour, gradient and background
   image when printing unless this is set. Without it the dark projector deck
   printed as white pages with near-invisible white text on them — the export
   looked nothing like what the teacher saw on screen. */
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* Almarai carries body copy, Cairo every heavier weight — the same split
   app/_layout.tsx makes for the on-screen UI, so an exported deck reads as
   the same product as the projector. Arial stays as the offline fallback. */
body { font-family: 'Almarai','Arial','Tahoma',sans-serif; background:${DECK_BORDER}; }
.deck-title-badge, .deck-title-main, .deck-divider-title, .deck-eyebrow,
.deck-eq, .deck-answer-label, .deck-chip, .deck-video-link,
.deck-option-letter, .deck-title-meta { font-family: 'Cairo','Arial','Tahoma',sans-serif; }
.deck-slide { width:297mm; height:210mm; background:${DECK_BG}; color:${DECK_TEXT}; position:relative; overflow:hidden; page-break-after:always; display:flex; flex-direction:column; }
.deck-title-slide { background:radial-gradient(circle at 30% 20%, ${DECK_BLOB}, transparent 60%), ${DECK_BG}; }
.deck-hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0; }
.deck-hero-gradient { position:absolute; inset:0; z-index:1; background:linear-gradient(180deg, rgba(13,13,20,0.35), rgba(13,13,20,0.92)); }
.deck-title-content { position:relative; z-index:2; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:50px; text-align:center; }
.deck-divider-slide { display:flex; flex-direction:column; }
/* The projected deck sits on two low-contrast circles; pseudo-elements keep
   them out of the markup. Not on title or divider slides — those carry a photo
   or a flat accent panel and the circles would muddy both. */
.deck-slide:not(.deck-title-slide):not(.deck-divider-slide)::before { content:''; position:absolute; top:-95px; inset-inline-start:-70px; width:300px; height:300px; border-radius:50%; background:${DECK_BLOB}; z-index:0; }
.deck-slide:not(.deck-title-slide):not(.deck-divider-slide)::after { content:''; position:absolute; bottom:-130px; inset-inline-end:-90px; width:340px; height:340px; border-radius:50%; background:${DECK_BLOB}; z-index:0; }
.deck-divider-content { position:relative; z-index:2; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:50px; text-align:center; }
.deck-divider-title { font-size:44px; font-weight:700; color:#fff; line-height:1.35; max-width:640px; }
.deck-title-rule { width:74px; height:5px; border-radius:3px; background:${DECK_PINK}; margin:0 0 18px; }
.deck-on-photo .deck-title-main, .deck-on-photo .deck-title-meta, .deck-on-photo .deck-title-summary { color:#fff; }
.deck-on-photo .deck-title-badge { background:rgba(255,255,255,0.16); color:#fff; }
.deck-divider-subtitle { font-size:16px; color:rgba(255,255,255,0.85); margin-top:14px; }
.deck-title-badge { background:${DECK_ACCENT}1F; color:${DECK_ACCENT}; font-size:12px; letter-spacing:3px; font-weight:700; padding:5px 18px; border-radius:20px; margin-bottom:24px; }
.deck-title-main { font-size:40px; font-weight:700; color:${DECK_TEXT}; line-height:1.35; margin-bottom:18px; max-width:560px; }
.deck-title-meta { font-size:15px; color:${DECK_MUTED}; margin-bottom:12px; }
.deck-title-summary { font-size:13px; color:${DECK_MUTED}; max-width:480px; line-height:1.7; }
.deck-header { position:relative; z-index:2; display:flex; align-items:center; gap:10px; height:64px; flex-shrink:0; padding:0 32px; border-bottom:1.5px solid; }
.deck-emoji { font-size:20px; }
.deck-eyebrow { font-size:16px; font-weight:700; }
.deck-body { position:relative; z-index:2; flex:1; padding:28px 40px; overflow:hidden; display:flex; flex-direction:column; justify-content:center; gap:10px; }
.deck-body-center { align-items:center; text-align:center; }
.deck-line { font-size:17px; line-height:1.8; color:${DECK_TEXT}; }
.deck-card { display:flex; align-items:center; gap:14px; background:${DECK_CARD_BG}; border:1px solid ${DECK_BORDER}; border-radius:14px; padding:14px 18px; }
.deck-card-bar { width:5px; align-self:stretch; border-radius:3px; flex-shrink:0; }
.deck-card-text { flex:1; font-size:17px; line-height:1.7; }
.deck-formula { background:${DECK_CARD_BG}; border:1px solid ${DECK_BORDER}; border-radius:16px; padding:18px 20px; text-align:center; font-size:26px; font-weight:700; color:${DECK_TEXT}; font-family:'Cairo','Arial','Tahoma',sans-serif; }
.deck-eq { font-size:26px; font-weight:700; color:${DECK_TEXT}; text-align:center; line-height:1.6; }
.deck-answer { margin-top:22px; border:1.5px solid; border-radius:12px; padding:16px 24px; background:${DECK_CARD_BG}; min-width:320px; }
.deck-answer-label { font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px; }
.deck-plot { margin:14px auto 0; max-width:660px; }
.deck-verified { margin-top:12px; font-size:11px; font-weight:600; display:flex; flex-direction:column; align-items:center; gap:4px; }
.deck-evidence { font-size:10px; color:${DECK_MUTED}; font-weight:400; }
.deck-options { display:flex; flex-direction:column; gap:10px; margin-top:22px; min-width:420px; }
.deck-option { display:flex; align-items:center; gap:12px; border:1.5px solid ${DECK_BORDER}; border-radius:12px; padding:12px 18px; font-size:16px; color:${DECK_TEXT}; background:${DECK_CARD_BG}; }
.deck-option-correct { background:${DECK_ACCENT}14; border-color:${DECK_ACCENT}; font-weight:700; }
.deck-option-letter { font-size:14px; font-weight:700; min-width:20px; }
.deck-option-text { flex:1; }
.deck-option-tick { font-size:16px; font-weight:700; }
.deck-chip-row { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-bottom:18px; }
.deck-chip { border:1.5px solid; border-radius:8px; padding:5px 12px; font-size:13px; font-weight:700; }
.deck-graph-note { font-size:11px; color:${DECK_MUTED}; max-width:420px; line-height:1.7; }
.deck-body-media { gap:16px; }
.deck-media-img { max-width:80%; max-height:130mm; object-fit:cover; border-radius:12px; box-shadow:0 8px 24px rgba(34,48,60,0.18); }
.deck-media-caption { font-size:11px; color:${DECK_MUTED}; }
.deck-video-title { font-size:15px; color:${DECK_TEXT}; max-width:520px; line-height:1.6; margin-bottom:20px; }
.deck-video-link { display:inline-block; border:1.5px solid; border-radius:10px; padding:10px 22px; font-size:15px; font-weight:700; text-decoration:none; }
.deck-video-url { font-size:10px; color:${DECK_MUTED}; margin-top:14px; word-break:break-all; max-width:420px; }
.deck-video-note { font-size:11px; color:${DECK_MUTED}; margin-top:12px; }
.deck-footer { position:relative; z-index:2; height:30px; border-top:1px solid ${DECK_BORDER}; display:flex; align-items:center; justify-content:space-between; padding:0 32px; flex-shrink:0; }
.deck-footer span { font-size:9px; color:${DECK_MUTED}; }
${MATH_HTML_STYLES}
</style>
</head>
<body>
${slidesHtml}
</body>
</html>`;
}
