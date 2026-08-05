/**
 * Modular document extraction.
 * Demo Mode: real text for .txt; light PDF text scrape when possible; honest
 * filename/heuristic scaffolds for Word / PPT / images.
 * Live Mode (future): swap processDocument() to call /api/documents without changing UI.
 */

import { Platform } from 'react-native';
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

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/** Split a lesson-like filename into usable concept tokens. */
function titleTokens(title: string): string[] {
  return title
    .split(/[\s_\-–—|/\\,،]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !/^(pdf|docx?|pptx?|txt|jpg|png|lesson|درس|unit|وحدة|ch|الفصل)$/i.test(t))
    .slice(0, 6);
}

async function readPlainText(uri: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof fetch === 'function') {
      const res = await fetch(uri);
      if (!res.ok) return null;
      const text = await res.text();
      return text.slice(0, 12000);
    }
    const FS = await import('expo-file-system');
    const anyFs = FS as any;
    if (typeof anyFs.readAsStringAsync === 'function') {
      const text = await anyFs.readAsStringAsync(uri);
      return String(text).slice(0, 12000);
    }
    if (anyFs.File && uri.startsWith('file')) {
      const file = new anyFs.File(uri);
      if (typeof file.text === 'function') {
        const text = await file.text();
        return String(text).slice(0, 12000);
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Best-effort PDF text scrape from raw bytes (simple /Flate-free streams).
 * Returns null when the file is compressed-only or unreadable — callers fall back.
 */
function scrapePdfText(raw: string): string | null {
  if (!raw.includes('%PDF')) return null;
  const chunks: string[] = [];
  const parenRe = /\((?:\\.|[^\\)]){3,200}\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(raw)) && chunks.length < 80) {
    const inner = m[0]
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\(.)/g, '$1')
      .trim();
    if (inner.length >= 3 && /[\u0600-\u06FFa-zA-Z0-9]/.test(inner)) {
      chunks.push(inner);
    }
  }
  const joined = chunks.join('\n').replace(/\s+/g, ' ').trim();
  if (joined.length < 40) return null;
  return joined.slice(0, 8000);
}

async function tryReadPdfText(uri: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof fetch === 'function') {
      const res = await fetch(uri);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 400000)));
      // Chunked Latin1 decode — small spreads avoid call-stack limits
      const parts: string[] = [];
      const chunk = 0x2000;
      for (let i = 0; i < bytes.length; i += chunk) {
        const slice = bytes.subarray(i, i + chunk);
        let s = '';
        for (let j = 0; j < slice.length; j++) s += String.fromCharCode(slice[j]!);
        parts.push(s);
      }
      return scrapePdfText(parts.join(''));
    }
  } catch {
    /* fall through */
  }
  return null;
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

function demoExtractFromName(
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

  if (kind === 'image') {
    return {
      lessonTitle: title,
      learningObjectives: [
        isAr ? `شرح محتوى الصورة المرتبط بـ«${title}»` : `Explain the image content related to “${title}”`,
        isAr ? 'تحديد المفاهيم الظاهرة في الصورة' : 'Identify concepts visible in the image',
        isAr ? 'ربط الشكل بمثال صفّي قصير' : 'Connect the figure to a short classroom example',
      ],
      keyConcepts: tokens.length ? tokens : [title],
      vocabulary: tokens.slice(0, 4),
      formulas: [],
      definitions: [],
      examples: [
        isAr
          ? `استخدم الصورة «${title}» كمنطلق: ماذا يرى الطلاب؟ ما القاعدة؟`
          : `Use the image “${title}” as a launch: what do students see? What is the rule?`,
      ],
      activities: [
        isAr ? 'اطلب من الطلاب وصف ما يرونه في الشكل' : 'Ask students to describe what they see in the figure',
      ],
      plainText: isAr
        ? `[OCR تجريبي — الوضع التجريبي]\nعنوان الصورة: ${title}\nمفاهيم محتملة: ${tokens.join(' · ') || title}\n\nملاحظة: لم يُقرأ نص حقيقي من البكسلات. الخطط تُبنى على اسم الملف وهيكل تدريسي جاهز. للصق النص من الصفحة لنتائج أدق.`
        : `[Demo OCR]\nImage title: ${title}\nLikely concepts: ${tokens.join(' · ') || title}\n\nNote: No real pixels were read. Plans use the filename + a teaching scaffold. Paste page text for stronger grounding.`,
      summary: isAr
        ? `صورة «${title}» جاهزة كسياق (OCR تجريبي من الاسم — ليس قراءة كاملة).`
        : `Image “${title}” ready as context (demo OCR from filename — not full read).`,
      pageHints: [isAr ? 'صفحة مصوّرة' : 'Photographed page'],
      extractQuality: 'filename',
    };
  }

  const kindLabel = kind === 'pdf' ? 'PDF' : kind === 'docx' ? 'Word' : kind === 'pptx' || kind === 'ppt' ? 'PowerPoint' : 'Document';
  const conceptCore = tokens[0] ?? title;

  return {
    lessonTitle: title,
    learningObjectives: isAr
      ? [
          `أن يفهم الطالب المفاهيم الأساسية في «${title}»`,
          `أن يشرح الطالب «${conceptCore}» بأمثلة صفية`,
          'أن يحل تمارين بمستويات صعوبة متدرجة مستمدة من الملف',
        ]
      : [
          `Students understand core ideas in “${title}”`,
          `Students explain “${conceptCore}” with classroom examples`,
          'Students solve practice items grounded in the uploaded material',
        ],
    keyConcepts: tokens.length
      ? tokens
      : (isAr
        ? [`مفهوم أساسي من ${title}`, 'تعريف', 'مثال محلول', 'تطبيق']
        : [`Core idea from ${title}`, 'Definition', 'Worked example', 'Application']),
    vocabulary: tokens.slice(0, 4),
    formulas: kind === 'pdf' || kind === 'pptx'
      ? [isAr ? `علاقة / صيغة مرتبطة بـ${conceptCore}` : `Key relationship tied to ${conceptCore}`]
      : [],
    definitions: [
      isAr
        ? `${title}: محتوى الملف هو مرجع التحضير — الأهداف والأمثلة تُشتق منه.`
        : `${title}: the file is the prep reference — objectives and examples derive from it.`,
    ],
    examples: [
      isAr
        ? `مثال صفّي من «${title}»: ابدأ بموقف قصير ثم قاعدة ثم تدريب.`
        : `Classroom example from “${title}”: situation → rule → practice.`,
    ],
    activities: [
      isAr ? 'نشاط افتتاحي قصير (٣ دقائق) من مفاهيم الملف' : 'Short opening activity (3 min) from file concepts',
      isAr ? 'عمل ثنائي على مثال محلول مستمد من العنوان' : 'Pair work on a worked example from the title',
    ],
    plainText: isAr
      ? `[مستند ${kindLabel} — استخراج من اسم الملف]\nالعنوان: ${title}\nمفاهيم: ${tokens.join(' · ') || title}\n\nأهداف مقترحة:\n- فهم ${conceptCore}\n- تطبيق أمثلة\n- تقويم تكويني قصير\n\nملاحظة للمعلم: الوضع التجريبي لم يقرأ كامل صفحات ${kindLabel}. الصق النص أو ارفع .txt لنتيجة أدق.`
      : `[${kindLabel} — filename-based extract]\nTitle: ${title}\nConcepts: ${tokens.join(' · ') || title}\n\nSuggested objectives:\n- Understand ${conceptCore}\n- Apply examples\n- Short formative check\n\nTeacher note: Demo Mode did not fully parse this ${kindLabel}. Paste text or upload .txt for stronger grounding.`,
    summary: isAr
      ? `ملف ${kindLabel} «${title}» جاهز كسياق درس (من العنوان — ليس قراءة كاملة للصفحات).`
      : `${kindLabel} “${title}” ready as lesson context (from title — not a full page parse).`,
    pageHints: kind === 'pptx' || kind === 'ppt'
      ? [isAr ? 'شرائح العرض' : 'Presentation slides']
      : undefined,
    extractQuality: 'filename',
  };
}

export type ProcessCallbacks = {
  onProgress?: (status: SessionDocument['status'], progress: number) => void;
};

/**
 * Process a picked file into DocumentExtractedMeta.
 * Keeps UI independent of parser internals.
 */
export async function processDocument(
  doc: Pick<SessionDocument, 'name' | 'kind' | 'uri' | 'mimeType'>,
  cbs?: ProcessCallbacks,
): Promise<DocumentExtractedMeta> {
  cbs?.onProgress?.('uploading', 0.15);
  await sleep(180);
  cbs?.onProgress?.('parsing', 0.45);
  await sleep(220);

  let plain: string | null = null;
  let quality: DocumentExtractQuality | undefined;

  if (doc.kind === 'txt') {
    plain = await readPlainText(doc.uri);
    if (plain?.trim()) quality = 'text';
  } else if (doc.kind === 'pdf') {
    plain = await tryReadPdfText(doc.uri);
    if (plain?.trim()) quality = 'heuristic';
  }

  if (doc.kind === 'image') {
    cbs?.onProgress?.('ocr', 0.7);
    await sleep(280);
  } else {
    cbs?.onProgress?.('parsing', 0.75);
    await sleep(200);
  }

  const extracted = demoExtractFromName(doc.name, doc.kind, plain ?? undefined, quality);
  cbs?.onProgress?.('ready', 1);
  return extracted;
}

/** Build a single prompt block from ready session documents. */
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
        : (lang === 'ar' ? 'جودة الاستخراج: من اسم الملف (تجريبي)' : 'Extract quality: filename scaffold (demo)');
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
