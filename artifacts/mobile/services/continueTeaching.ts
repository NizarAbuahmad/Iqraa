/**
 * Continue Teaching helpers — resume card copy + navigation for the Home dashboard.
 * Presentation-only; does not add product features.
 */
import type { SavedMaterial } from '@/services/workspace';

export type ContinueMaterialKind =
  | 'lesson'
  | 'worksheet'
  | 'quiz'
  | 'homework'
  | 'activity'
  | 'flow';

/** Investor MVP demo lesson when workspace has nothing to resume — live NCCD S2 lesson. */
export const DEMO_CONTINUE = {
  /** Same id as KB / browser: تركيب الاقترانات (NCCD u5_l3). */
  lessonId: 'kbl-math-s2-nccd-u5_l3',
  unitNumber: 5,
  lessonNumber: 3,
  lessonTitleAr: 'تركيب الاقترانات',
  lessonTitleEn: 'Composition of Functions',
  unitTopicAr: 'الاقترانات',
  unitTopicEn: 'Functions',
  materialKind: 'lesson' as ContinueMaterialKind,
} as const;

export type ContinueCardModel = {
  primaryHeading: string;
  secondaryLine: string;
  materialLabel: string;
  focusTitle: string;
  editedLabel: string;
  materialKind: ContinueMaterialKind;
};

type Translate = (key: string, arg?: string | number) => string;

export function resolveMaterialKind(item: SavedMaterial): ContinueMaterialKind {
  const kind = item.formState?.materialKind;
  if (
    kind === 'lesson' || kind === 'worksheet' || kind === 'quiz'
    || kind === 'homework' || kind === 'activity' || kind === 'flow'
  ) {
    return kind;
  }
  if (item.formState?.isHomework === true) return 'homework';
  if (item.type === 'activity') return 'activity';
  if (item.type === 'flow') return 'flow';
  if (item.type === 'worksheet') return 'worksheet';
  if (item.type === 'quiz') return 'quiz';
  return 'lesson';
}

export function materialKindLabel(kind: ContinueMaterialKind, t: Translate): string {
  switch (kind) {
    case 'worksheet': return t('materialWorksheet');
    case 'quiz': return t('materialQuiz');
    case 'homework': return t('materialHomework');
    case 'activity': return t('materialActivity');
    case 'flow': return t('materialFlow');
    default: return t('materialLessonPlan');
  }
}

export function relativeEditWhen(
  iso: string,
  lang: 'ar' | 'en',
): 'yesterday' | 'justNow' | string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);
    if (diffH < 1) return 'justNow';
    if (diffH >= 18 && diffD < 2) return 'yesterday';
    if (lang === 'ar') {
      if (diffH === 1) return 'منذ ساعة';
      if (diffH === 2) return 'منذ ساعتين';
      if (diffH < 11) return `منذ ${diffH} ساعات`;
      if (diffH < 24) return `منذ ${diffH} ساعة`;
      if (diffD === 2) return 'منذ يومين';
      if (diffD < 7) return `منذ ${diffD} أيام`;
      return new Date(iso).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short' });
    }
    if (diffH < 24) return `${diffH}h ago`;
    if (diffD < 7) return `${diffD}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return 'justNow';
  }
}

export function formatEditedLabel(iso: string | null, lang: 'ar' | 'en', t: Translate): string {
  if (!iso) return t('lastEditedYesterday');
  const when = relativeEditWhen(iso, lang);
  if (when === 'yesterday') return t('lastEditedYesterday');
  if (when === 'justNow') return t('lastEditedJustNow');
  return t('lastEditedAt', when);
}

export function buildContinueCardFromItem(
  item: SavedMaterial,
  lang: 'ar' | 'en',
  t: Translate,
): ContinueCardModel {
  const fs = item.formState ?? {};
  const unitNumber = typeof fs.unitNumber === 'number' ? fs.unitNumber : null;
  const lessonNumber = typeof fs.lessonNumber === 'number' ? fs.lessonNumber : null;
  const lessonTitle = (
    (typeof fs.lessonTitle === 'string' && fs.lessonTitle.trim())
    || item.topic?.trim()
    || item.title
  ).trim();
  const unitTopic = (
    (typeof fs.unitTitle === 'string' && fs.unitTitle.trim())
    || (typeof fs.unitTopic === 'string' && fs.unitTopic.trim())
    || item.topic?.trim()
    || ''
  ).trim();

  const lessonPrefix = lessonNumber != null ? t('lessonNumberLabel', lessonNumber) : null;
  const primaryHeading = lessonPrefix ? `${lessonPrefix}: ${lessonTitle}` : lessonTitle;

  const unitPrefix = unitNumber != null
    ? t('unitNumberLabel', unitNumber)
    : (typeof fs.unitLabel === 'string' ? fs.unitLabel : null);
  const secondaryLine = [unitPrefix, unitTopic].filter(Boolean).join(' • ');

  const materialKind = resolveMaterialKind(item);

  return {
    primaryHeading,
    secondaryLine,
    materialLabel: materialKindLabel(materialKind, t),
    focusTitle: lessonTitle,
    editedLabel: formatEditedLabel(item.savedAt, lang, t),
    materialKind,
  };
}

export function buildDemoContinueCard(lang: 'ar' | 'en', t: Translate): ContinueCardModel {
  const lessonTitle = lang === 'ar' ? DEMO_CONTINUE.lessonTitleAr : DEMO_CONTINUE.lessonTitleEn;
  const unitTopic = lang === 'ar' ? DEMO_CONTINUE.unitTopicAr : DEMO_CONTINUE.unitTopicEn;
  return {
    primaryHeading: `${t('lessonNumberLabel', DEMO_CONTINUE.lessonNumber)}: ${lessonTitle}`,
    secondaryLine: `${t('unitNumberLabel', DEMO_CONTINUE.unitNumber)} • ${unitTopic}`,
    materialLabel: materialKindLabel(DEMO_CONTINUE.materialKind, t),
    focusTitle: lessonTitle,
    editedLabel: t('lastEditedYesterday'),
    materialKind: DEMO_CONTINUE.materialKind,
  };
}

export function typeColor(kind: ContinueMaterialKind): string {
  switch (kind) {
    case 'worksheet':
    case 'homework':
      return '#0E8F86';
    case 'quiz':
      return '#C9860A';
    case 'activity':
      return '#1B6B62';
    case 'flow':
      return '#081B3A';
    default:
      return '#00A99D';
  }
}
