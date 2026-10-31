export const PHOTOS_MAX = 6;
export const NOTE_MAX = 2000;
const DATA_URL_MAX = 6_000_000;

export type SubmissionState = 'none' | 'submitted' | 'late';
export interface SubmissionPhoto { id: string; url: string | null; mime: string; sizeBytes: number }
export interface SubmissionView {
  status: SubmissionState; locked: boolean; note: string;
  photos: SubmissionPhoto[]; submittedAt: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function normalizeSubmissionState(v: unknown): SubmissionState {
  return v === 'submitted' || v === 'late' ? v : 'none';
}

export function emptySubmission(): SubmissionView {
  return { status: 'none', locked: false, note: '', photos: [], submittedAt: null };
}

export function normalizeSubmission(raw: unknown): SubmissionView {
  if (!isRecord(raw)) return emptySubmission();
  const photos: SubmissionPhoto[] = [];
  if (Array.isArray(raw['photos'])) {
    for (const p of raw['photos']) {
      if (!isRecord(p) || typeof p['id'] !== 'string' || p['id'] === '') continue;
      photos.push({
        id: p['id'],
        url: typeof p['url'] === 'string' ? p['url'] : null,
        mime: typeof p['mime'] === 'string' ? p['mime'] : '',
        sizeBytes: typeof p['sizeBytes'] === 'number' ? p['sizeBytes'] : 0,
      });
    }
  }
  return {
    status: normalizeSubmissionState(raw['status']),
    locked: raw['locked'] === true,
    note: typeof raw['note'] === 'string' ? raw['note'] : '',
    photos,
    submittedAt: typeof raw['submittedAt'] === 'string' ? raw['submittedAt'] : null,
  };
}

export function slotsLeft(photoCount: number): number {
  return Math.max(0, PHOTOS_MAX - photoCount);
}

export function canAddPhoto(v: { photos: unknown[]; locked: boolean }): boolean {
  return !v.locked && v.photos.length < PHOTOS_MAX;
}

export function canHandIn(v: { photos: unknown[]; locked: boolean }, note: string): boolean {
  return !v.locked && (v.photos.length > 0 || note.trim() !== '');
}

export function noteChanged(saved: string, draft: string): boolean {
  return saved.trim() !== draft.trim();
}

export function photoDataUrlOk(dataUrl: string): boolean {
  return dataUrl.length <= DATA_URL_MAX && /^data:image\/(jpeg|png|webp);base64,/.test(dataUrl);
}

export type SubmissionLabelKey = 'submissionNone' | 'submissionSubmitted' | 'submissionLate';
export function stateLabelKey(state: SubmissionState): SubmissionLabelKey {
  return state === 'late' ? 'submissionLate' : state === 'submitted' ? 'submissionSubmitted' : 'submissionNone';
}
