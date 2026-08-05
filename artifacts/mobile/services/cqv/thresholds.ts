/**
 * CQV quality targets — single configuration file.
 * Adjust values here; validation / dashboard / queues read from this only.
 * Internal TAT tooling — not part of Investor MVP.
 */

export const SCORE_DIMENSION_KEYS = [
  'educationalQuality',
  'arabicLanguage',
  'curriculumAlignment',
  'teacherUsability',
  'formatting',
  'teacherTrust',
] as const;

export type ScoreDimensionKey = (typeof SCORE_DIMENSION_KEYS)[number];

export const SCORE_DIMENSION_LABELS: Record<ScoreDimensionKey, string> = {
  educationalQuality: 'Educational Quality',
  arabicLanguage: 'Arabic Language',
  curriculumAlignment: 'Curriculum Alignment',
  teacherUsability: 'Teacher Usability',
  formatting: 'Formatting',
  teacherTrust: 'Teacher Trust',
};

/**
 * Default per-dimension quality targets (1–10 scale).
 * A score must be >= its threshold to pass that dimension.
 */
export const CQV_THRESHOLDS: Record<ScoreDimensionKey, number> = {
  educationalQuality: 8.5,
  arabicLanguage: 9.0,
  curriculumAlignment: 9.0,
  teacherUsability: 8.5,
  formatting: 9.0,
  teacherTrust: 9.0,
};

export function getThreshold(key: ScoreDimensionKey): number {
  return CQV_THRESHOLDS[key];
}

export function getAllThresholds(): Record<ScoreDimensionKey, number> {
  return { ...CQV_THRESHOLDS };
}

/** True when every entered score meets its configured threshold. */
export function scoresMeetThresholds(
  scores: Partial<Record<ScoreDimensionKey, number | null | undefined>>,
): boolean {
  return SCORE_DIMENSION_KEYS.every(key => {
    const v = scores[key];
    if (typeof v !== 'number') return false;
    return v >= CQV_THRESHOLDS[key];
  });
}

/** Dimensions whose entered scores are below the configured target. */
export function dimensionsBelowThreshold(
  scores: Partial<Record<ScoreDimensionKey, number | null | undefined>>,
): ScoreDimensionKey[] {
  return SCORE_DIMENSION_KEYS.filter(key => {
    const v = scores[key];
    return typeof v === 'number' && v < CQV_THRESHOLDS[key];
  });
}
