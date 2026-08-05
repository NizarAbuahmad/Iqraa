/**
 * In-memory session document store for the Teaching Assistant chat.
 * Files persist for the conversation lifetime (not across app restarts).
 */

import {
  buildDocumentPromptBlock,
  processDocument,
} from './extract';
import {
  isAcceptedFile,
  kindFromNameAndMime,
  type DocumentContextBundle,
  type SessionDocument,
} from './types';

export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

type Listener = (docs: SessionDocument[]) => void;

let documents: SessionDocument[] = [];
const listeners = new Set<Listener>();

function emit() {
  const snapshot = [...documents];
  listeners.forEach(l => l(snapshot));
}

function uid() {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSessionDocuments(): SessionDocument[] {
  return [...documents];
}

export function subscribeSessionDocuments(listener: Listener): () => void {
  listeners.add(listener);
  listener([...documents]);
  return () => { listeners.delete(listener); };
}

export function clearSessionDocuments() {
  documents = [];
  emit();
}

export function removeSessionDocument(id: string) {
  documents = documents.filter(d => d.id !== id);
  emit();
}

export function getDocumentContextBundle(lang: 'ar' | 'en'): DocumentContextBundle {
  const docs = getSessionDocuments();
  const readyCount = docs.filter(d => d.status === 'ready').length;
  return {
    documents: docs,
    readyCount,
    promptBlock: buildDocumentPromptBlock(docs, lang),
  };
}

function patch(id: string, patch: Partial<SessionDocument>) {
  documents = documents.map(d => (d.id === id ? { ...d, ...patch } : d));
  emit();
}

/**
 * Add and process multiple picked files into the session.
 * Skips unsupported types. Processes sequentially for clearer progress UX.
 */
export async function addAndProcessFiles(
  files: PickedFile[],
  onRejected?: (name: string) => void,
): Promise<SessionDocument[]> {
  const accepted = files.filter(f => {
    const ok = isAcceptedFile(f.name, f.mimeType);
    if (!ok) onRejected?.(f.name);
    return ok;
  });

  const created: SessionDocument[] = [];

  for (const f of accepted) {
    const kind = kindFromNameAndMime(f.name, f.mimeType);
    const doc: SessionDocument = {
      id: uid(),
      name: f.name,
      mimeType: f.mimeType || 'application/octet-stream',
      kind,
      uri: f.uri,
      sizeBytes: f.size ?? 0,
      status: 'queued',
      progress: 0,
      createdAt: new Date().toISOString(),
    };
    documents = [...documents, doc];
    created.push(doc);
    emit();

    try {
      const extracted = await processDocument(doc, {
        onProgress: (status, progress) => patch(doc.id, { status, progress }),
      });
      patch(doc.id, { status: 'ready', progress: 1, extracted });
    } catch (e: any) {
      patch(doc.id, {
        status: 'error',
        progress: 1,
        errorMessage: e?.message || 'Processing failed',
      });
    }
  }

  return created;
}
