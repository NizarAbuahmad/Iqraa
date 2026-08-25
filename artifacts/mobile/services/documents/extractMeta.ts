/**
 * Turning a picked file into lesson context — the part that reads no files.
 *
 * Split out of `extract.ts` for the reason `exportHtml.ts` was split out of
 * `share.ts`: that module imports `react-native` at module scope for
 * `Platform`, and `node:test` cannot parse it, so nothing here could be tested.
 * That was not a theoretical gap. `demoExtractFromName` spent months inventing
 * learning objectives, formulas and worked examples out of a *filename* and
 * putting them in a prompt, and no test could see it because no test could
 * load the file.
 *
 * Everything here is pure: filenames and already-read text in, structured meta
 * and prompt blocks out. The Platform-dependent readers and `processDocument`
 * stay in `extract.ts`, which re-exports this module so no caller changed.
 */
import type {
  DocumentExtractQuality,
  DocumentExtractedMeta,
  DocumentSourceKind,
  SessionDocument,
} from './types';

const PROMPT_CHAR_BUDGET = 6000;

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function titleTokens(title: string): string[] {
  return title
    .split(/[\s_\-–—|/\\,،]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !/^(pdf|docx?|pptx?|txt|jpg|png|lesson|درس|unit|وحدة|ch|الفصل)$/i.test(t))
    .slice(0, 6);
}

function metaFromPlainText(
  title: string,
  plain: string,
  quality: DocumentExtractQuality,
): DocumentExtractedMeta {
  const isAr = /[\u0600-\u06FF]/.test(title) || /[\u0600-\u06FF]/.test(plain);
  const lines = plain.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const head = lines.slice(0, 10);
  const tokens = titleTokens(title);
  const objFromText = head
    .filter(l => /هدف|أن ي|objective|students will/i.test(l))
    .slice(0, 3)
    .map(l => l.slice(0, 120));
  const concepts = [
    ...tokens,
    ...head.filter(l => l.length < 60).slice(0, 4),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

  return {
    lessonTitle: title,
    learningObjectives: objFromText.length
      ? objFromText
      : (isAr
        ? [
            `أن يفهم الطالب المفاهيم الأساسية في «${title}»`,
            tokens[0] ? `أن يشرح الطالب ${tokens[0]} بأمثلة` : 'أن يطبق أمثلة صفية مرتبطة بالدرس',
            'أن يحل تمارين بمستويات صعوبة متدرجة',
          ]
        : [
            `Students understand core ideas in “${title}”`,
            tokens[0] ? `Students explain ${tokens[0]} with examples` : 'Students apply classroom examples',
            'Students solve practice at progressive difficulty',
          ]),
    keyConcepts: concepts.length ? concepts : [title],
    vocabulary: tokens.slice(0, 4),
    formulas: lines.filter(l => /[=∑∫√^]|معادلة|formula/i.test(l)).slice(0, 3).map(l => l.slice(0, 80)),
    definitions: lines.filter(l => /تعريف|يُعرّف|definition|is defined/i.test(l)).slice(0, 3).map(l => l.slice(0, 160)),
    examples: lines.filter(l => /مثال|example|تمرين/i.test(l)).slice(0, 3).map(l => l.slice(0, 160)),
    activities: [],
    plainText: plain.slice(0, PROMPT_CHAR_BUDGET),
    summary: isAr
      ? `تم استخراج نص حقيقي من «${title}» (${lines.length} سطرًا) — جاهز لخطة الدرس.`
      : `Extracted real text from “${title}” (${lines.length} lines) — ready for a lesson plan.`,
    extractQuality: quality,
  };
}

/**
 * Meta for a file whose bytes could not be read — exported so the fence inside
 * it can be asserted, not just described.
 */
export function demoExtractFromName(
  name: string,
  kind: DocumentSourceKind,
  plainOverride?: string,
  qualityOverride?: DocumentExtractQuality,
): DocumentExtractedMeta {
  const title = stripExt(name) || name;
  const isAr = /[\u0600-\u06FF]/.test(title);
  const tokens = titleTokens(title);

  if (plainOverride && plainOverride.trim().length > 40) {
    return metaFromPlainText(
      title,
      plainOverride,
      qualityOverride ?? 'text',
    );
  }

  // ── The fence ──────────────────────────────────────────────────────────
  //
  // Nothing below this point was read from the file. On mobile that is every
  // PDF, every Word and PowerPoint document, and every image — there is no
  // OCR. The earlier version of this function answered that by writing
  // learning objectives, formulas, worked examples and classroom activities
  // out of the *filename*, and `buildDocumentPromptBlock` then put them in the
  // prompt under ordinary headings. It labelled the quality honestly and
  // shipped the invented content anyway, which is the same shape of bug as a
  // `verified` flag set from a code-computed fallback: the label says one
  // thing and the payload says another, and only the payload reaches a model.
  //
  // What survives is what is actually known: the filename, and the words in
  // it. Those are the teacher's own words about their own file — a hint, and
  // labelled as one. Everything that would state a curriculum fact is empty.
  const kindLabel = kind === 'pdf' ? 'PDF' : kind === 'docx' ? 'Word' : kind === 'pptx' || kind === 'ppt' ? 'PowerPoint' : kind === 'image' ? (isAr ? 'صورة' : 'Image') : 'Document';
  const unreadNote = isAr
    ? `لم يُقرأ محتوى هذا الملف (${kindLabel}). المعروف عنه هو اسمه فقط.`
    : `The contents of this ${kindLabel} were not read. Only its name is known.`;

  return {
    lessonTitle: title,
    // Empty, not invented. A generator that needs objectives should use the
    // curriculum's, or say it has none — not repeat a guess made from a filename.
    learningObjectives: [],
    // The words the teacher put in their own filename. Derived, not asserted,
    // and presented as a hint wherever it is shown.
    keyConcepts: tokens,
    vocabulary: tokens.slice(0, 4),
    formulas: [],
    definitions: [],
    examples: [],
    activities: [],
    plainText: isAr
      ? `[${kindLabel} — لم يُقرأ المحتوى]\nاسم الملف: ${title}\n${tokens.length ? `كلمات من الاسم: ${tokens.join(' · ')}\n` : ''}\n${unreadNote} الصق نص الصفحة أو ارفع ملف .txt للحصول على تحضير مبني على المحتوى فعلًا.`
      : `[${kindLabel} — contents not read]\nFile name: ${title}\n${tokens.length ? `Words from the name: ${tokens.join(' · ')}\n` : ''}\n${unreadNote} Paste the page text or upload a .txt to get prep grounded in the actual content.`,
    summary: unreadNote,
    pageHints: kind === 'pptx' || kind === 'ppt'
      ? [isAr ? 'شرائح العرض' : 'Presentation slides']
      : undefined,
    extractQuality: 'filename',
  };
}

export function buildDocumentPromptBlock(
  docs: SessionDocument[],
  lang: 'ar' | 'en',
): string {
  const ready = docs.filter(d => d.status === 'ready' && d.extracted);
  if (ready.length === 0) return '';

  const header = lang === 'ar'
    ? '=== مواد المعلم المرفوعة (سياق أساسي) ==='
    : '=== Teacher-uploaded materials (primary context) ===';

  const parts = ready.map((d, i) => {
    const e = d.extracted!;
    const label = lang === 'ar' ? `ملف ${i + 1}` : `File ${i + 1}`;
    const qualityNote = e.extractQuality === 'text'
      ? (lang === 'ar' ? 'جودة الاستخراج: نص حقيقي' : 'Extract quality: real text')
      : e.extractQuality === 'heuristic'
        ? (lang === 'ar' ? 'جودة الاستخراج: جزئي من الملف' : 'Extract quality: partial from file')
        // Not a label but an instruction. When the contents could not be read
        // the only real information is the file's name, and a model told merely
        // that the "quality" is low will still write a lesson as if it had read
        // the file. Naming what is missing is what stops that.
        : (lang === 'ar'
          ? 'تنبيه: لم يُقرأ محتوى هذا الملف — المتاح اسمه فقط. لا تفترض ما بداخله، ولا تنسب أي هدف أو مثال إليه.'
          : 'WARNING: this file\'s contents were not read — only its name is available. Do not assume what it contains, and do not attribute any objective or example to it.');
    return [
      `${label}: ${d.name} (${d.kind})`,
      qualityNote,
      e.lessonTitle ? (lang === 'ar' ? `عنوان: ${e.lessonTitle}` : `Title: ${e.lessonTitle}`) : '',
      e.summary ? (lang === 'ar' ? `ملخص: ${e.summary}` : `Summary: ${e.summary}`) : '',
      e.learningObjectives.length
        ? (lang === 'ar' ? `أهداف:\n- ${e.learningObjectives.join('\n- ')}` : `Objectives:\n- ${e.learningObjectives.join('\n- ')}`)
        : '',
      e.keyConcepts.length
        ? (lang === 'ar' ? `مفاهيم: ${e.keyConcepts.join(' · ')}` : `Concepts: ${e.keyConcepts.join(' · ')}`)
        : '',
      e.examples.length
        ? (lang === 'ar' ? `أمثلة:\n- ${e.examples.join('\n- ')}` : `Examples:\n- ${e.examples.join('\n- ')}`)
        : '',
      e.plainText
        ? (lang === 'ar' ? `نص مستخرج:\n${e.plainText.slice(0, 1800)}` : `Extracted text:\n${e.plainText.slice(0, 1800)}`)
        : '',
    ].filter(Boolean).join('\n');
  });

  const block = `${header}\n\n${parts.join('\n\n---\n\n')}`;
  return block.slice(0, PROMPT_CHAR_BUDGET);
}

export function primaryTopicFromDocuments(docs: SessionDocument[], fallback: string): string {
  const ready = docs.find(d => d.status === 'ready' && d.extracted?.lessonTitle);
  return ready?.extracted?.lessonTitle?.trim() || fallback;
}

export function sessionDocsExtractQuality(
  docs: SessionDocument[],
): DocumentExtractQuality | null {
  const ready = docs.filter(d => d.status === 'ready' && d.extracted);
  if (!ready.length) return null;
  if (ready.some(d => d.extracted?.extractQuality === 'text')) return 'text';
  if (ready.some(d => d.extracted?.extractQuality === 'heuristic')) return 'heuristic';
  return 'filename';
}
