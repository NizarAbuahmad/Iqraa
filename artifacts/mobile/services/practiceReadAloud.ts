/**
 * Score a read-aloud recording without it counting for anything.
 *
 * The mirror of `uploadReadAloud` in `studentExam.ts`, and different in the one
 * way that matters: nothing is stored. No attempt, no mark, no audio kept —
 * the server transcribes, scores against the curated passage, and returns the
 * number. Retry as often as you like.
 *
 * Authenticated, unlike the exam upload, because there the shared link is the
 * identity and here there is a real account to bill and to cap. Transcription
 * costs money per call.
 */
import { apiJson } from './apiClient';

export interface PracticeResult {
  transcript: string;
  /** Word accuracy in [0,1] against the passage. */
  accuracy: number;
  errors: number;
  referenceWords: number;
  spokenWords: number;
  /** Rendered next to the score; every licence here requires the credit. */
  attribution: string;
}

export function scorePracticeReadAloud(
  resourceId: string,
  audioDataUrl: string,
  durationMs: number,
): Promise<PracticeResult> {
  return apiJson<PracticeResult>('/practice/read-aloud', {
    method: 'POST',
    body: JSON.stringify({ resourceId, audio: audioDataUrl, durationMs }),
  });
}
