/**
 * Parse teacher-uploaded document prompt blocks into structured grounding
 * for Demo Mode generators and Teaching Assistant replies.
 */

export type DocumentGrounding = {
  fileNames: string[];
  title: string | null;
  summary: string | null;
  objectives: string[];
  concepts: string[];
  examples: string[];
  plainSnippets: string[];
  /** True when the prompt block looks like teacher-uploaded materials. */
  present: boolean;
};

function takeBullets(block: string, headerRe: RegExp): string[] {
  const m = block.match(headerRe);
  if (!m || m.index == null) return [];
  const from = m.index + m[0].length;
  const rest = block.slice(from);
  const nextHeader = rest.search(/\n(?:عنوان|Title|ملخص|Summary|أهداف|Objectives|مفاهيم|Concepts|نص مستخرج|Extracted text|ملف \d+|File \d+)/i);
  const section = nextHeader >= 0 ? rest.slice(0, nextHeader) : rest.slice(0, 800);
  return section
    .split(/\r?\n/)
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 2 && l.length < 200)
    .slice(0, 6);
}

function takeField(block: string, labelRe: RegExp): string | null {
  const m = block.match(labelRe);
  if (!m?.[1]) return null;
  const v = m[1].trim();
  return v.length ? v.slice(0, 160) : null;
}

function takePlain(block: string): string[] {
  const m = block.match(/(?:نص مستخرج|Extracted text):\s*\n?([\s\S]+)/i);
  if (!m?.[1]) return [];
  const body = m[1]
    .split(/\n---\n/)[0]
    ?.trim()
    .slice(0, 1200) ?? '';
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 8 && !l.startsWith('==='))
    .slice(0, 8);
}

/** Parse `buildDocumentPromptBlock` output (or any similar additionalContext). */
export function parseDocumentGrounding(raw?: string | null): DocumentGrounding {
  const empty: DocumentGrounding = {
    fileNames: [],
    title: null,
    summary: null,
    objectives: [],
    concepts: [],
    examples: [],
    plainSnippets: [],
    present: false,
  };
  const block = raw?.trim();
  if (!block) return empty;
  if (!/مواد المعلم المرفوعة|Teacher-uploaded materials/i.test(block)) {
    // Still try light parse if callers pass a partial block
    if (!/(?:ملف|File)\s*\d+|عنوان:|Title:|نص مستخرج|Extracted text/i.test(block)) {
      return empty;
    }
  }

  const fileNames = [...block.matchAll(/(?:ملف|File)\s*\d+:\s*(.+?)\s*\(/gi)]
    .map(m => m[1]?.trim())
    .filter((n): n is string => !!n);

  const title =
    takeField(block, /(?:عنوان|Title):\s*(.+)/i)
    ?? (fileNames[0] ? fileNames[0].replace(/\.[^.]+$/, '') : null);

  const summary = takeField(block, /(?:ملخص|Summary):\s*(.+)/i);

  const objectives = takeBullets(block, /(?:أهداف|Objectives):\s*\n?/i);

  const conceptsLine = takeField(block, /(?:مفاهيم|Concepts):\s*(.+)/i);
  const concepts = conceptsLine
    ? conceptsLine.split(/\s*[·•|,،]\s*/).map(s => s.trim()).filter(Boolean).slice(0, 8)
    : [];

  const plainSnippets = takePlain(block);
  const examples = plainSnippets.filter(l => /مثال|example|تمرين|exercise/i.test(l)).slice(0, 3);

  return {
    fileNames,
    title,
    summary,
    objectives,
    concepts,
    examples: examples.length ? examples : plainSnippets.slice(0, 2),
    plainSnippets,
    present: true,
  };
}

/** Prefer document title/topic over a soft-pinned curriculum lesson. */
export function topicFromDocumentGrounding(
  grounding: DocumentGrounding,
  fallback: string,
): string {
  if (grounding.title?.trim()) return grounding.title.trim();
  if (grounding.fileNames[0]) {
    return grounding.fileNames[0].replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  }
  return fallback;
}
