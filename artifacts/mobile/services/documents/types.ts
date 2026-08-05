/**
 * Unified Document Context model — source-agnostic teaching material.
 * PDF / DOCX / PPTX / TXT / image all normalize into this shape.
 */

export type DocumentSourceKind =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'ppt'
  | 'txt'
  | 'image'
  | 'unknown';

export type DocumentProcessStatus =
  | 'queued'
  | 'uploading'
  | 'parsing'
  | 'ocr'
  | 'ready'
  | 'error';

/** How much real file content we actually read (Demo Mode). */
export type DocumentExtractQuality =
  | 'text'       // real plain text from the file (e.g. .txt)
  | 'heuristic'  // partial / demo structure from name + light parse
  | 'filename';  // filename + synthetic teaching scaffold only

export type DocumentExtractedMeta = {
  lessonTitle?: string;
  learningObjectives: string[];
  keyConcepts: string[];
  vocabulary: string[];
  formulas: string[];
  definitions: string[];
  examples: string[];
  activities: string[];
  /** Plain extracted / OCR text (budget-trimmed for prompts). */
  plainText: string;
  /** Short teacher-facing summary. */
  summary: string;
  pageHints?: string[];
  /** Demo Mode honesty signal for chat / generators. */
  extractQuality?: DocumentExtractQuality;
};

export type SessionDocument = {
  id: string;
  name: string;
  mimeType: string;
  kind: DocumentSourceKind;
  uri: string;
  sizeBytes: number;
  status: DocumentProcessStatus;
  progress: number; // 0–1
  errorMessage?: string;
  extracted?: DocumentExtractedMeta;
  createdAt: string;
};

/** Compact prompt block injected into chat / generators. */
export type DocumentContextBundle = {
  documents: SessionDocument[];
  /** Combined context string for AI system/user prompts. */
  promptBlock: string;
  readyCount: number;
};

export const ACCEPTED_MIME: Record<string, DocumentSourceKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'text/plain': 'txt',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
};

export const ACCEPTED_EXTENSIONS = [
  'pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'jpg', 'jpeg', 'png', 'heic',
] as const;

export function kindFromNameAndMime(name: string, mimeType?: string | null): DocumentSourceKind {
  const lower = name.toLowerCase();
  if (mimeType && ACCEPTED_MIME[mimeType]) return ACCEPTED_MIME[mimeType];
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
  if (lower.endsWith('.pptx')) return 'pptx';
  if (lower.endsWith('.ppt')) return 'ppt';
  if (lower.endsWith('.txt')) return 'txt';
  if (/\.(jpe?g|png|heic|heif)$/i.test(lower)) return 'image';
  return 'unknown';
}

export function isAcceptedFile(name: string, mimeType?: string | null): boolean {
  return kindFromNameAndMime(name, mimeType) !== 'unknown';
}
