/**
 * Reading a picked file, and turning it into lesson context.
 *
 * This half needs `react-native`'s `Platform` and so cannot be loaded by
 * `node:test`. Everything that does not need it — building the meta, building
 * the prompt block — lives in `extractMeta.ts` and is re-exported here, so
 * callers import from one place and tests import from the testable one.
 *
 * Demo Mode: real text for .txt; a light PDF text scrape on web when the
 * streams are uncompressed; and for everything else, an honest "not read"
 * result. It does not guess at contents from a filename — see the fence in
 * `extractMeta.ts`.
 * Live Mode (future): swap processDocument() to call /api/documents without
 * changing the UI.
 */

import { Platform } from 'react-native';
import type {
  DocumentExtractQuality,
  DocumentExtractedMeta,
  SessionDocument,
} from './types';
import { demoExtractFromName } from './extractMeta.ts';

export {
  buildDocumentPromptBlock,
  demoExtractFromName,
  primaryTopicFromDocuments,
  sessionDocsExtractQuality,
} from './extractMeta.ts';

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
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
