/** Curriculum Quality Validation (CQV) / Teacher Acceptance Testing types */

export const CQV_ARTIFACT_IDS = [
  'lesson-plan',
  'worksheet',
  'quiz',
  'homework',
  'classroom-activity',
  'interactive-lesson',
  'assessment',
  'answer-key',
] as const;

export type CqvArtifactId = (typeof CQV_ARTIFACT_IDS)[number];

export type CqvVerdict = 'pass' | 'fail' | 'pending';

export type CqvScores = {
  educationalQuality: number | null;
  arabicLanguage: number | null;
  curriculumAlignment: number | null;
  teacherUsability: number | null;
  formatting: number | null;
  teacherTrust: number | null;
};

export type CqvReport = {
  id: string;
  lessonId: string;
  lessonName: string;
  lessonNameAr: string;
  semester: 1 | 2;
  unitId: string;
  unitName: string;
  unitNameAr: string;
  artifactId: CqvArtifactId;
  artifactLabel: string;
  verdict: CqvVerdict;
  scores: CqvScores;
  notes: string;
  improvements: string;
  reviewedAt: string | null;
  updatedAt: string;
  /** Set when "Test Entire Lesson" (or manual generate) produced output. */
  generatedAt: string | null;
  generationError: string | null;
  /** Workspace material id when batch-saved. */
  savedMaterialId: string | null;
};

export type CqvLessonRef = {
  lessonId: string;
  lessonName: string;
  lessonNameAr: string;
  semester: 1 | 2;
  semesterLabel: string;
  semesterLabelAr: string;
  unitId: string;
  unitName: string;
  unitNameAr: string;
  unitOrder: number;
  bookId: string;
};
