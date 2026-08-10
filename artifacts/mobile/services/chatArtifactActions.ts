/**
 * What a teacher can do with a result the chat produced.
 *
 * Chat could already copy, share and export — but only behind a long-press on
 * the message bubble, which nothing on screen advertises and which barely
 * exists as a gesture on web. A teacher who generated a worksheet in chat had
 * no visible way to get it anywhere.
 *
 * Editing is the harder half. The tool screens already have full editors for
 * every artifact kind; chat renders only lesson plans structurally and shows
 * the rest as text. Rather than rebuild three editors inside the timeline, an
 * artifact is saved to the workspace and opened in its own tool screen, which
 * is where the editing, saving and exporting already live.
 */
import type { ChatArtifactData } from './ai/chatArtifacts.ts';
import type { MaterialType } from './workspace.ts';

/** The tool screen that owns editing for each artifact kind. */
const ROUTE_BY_KIND: Record<ChatArtifactData['kind'], string> = {
  'lesson-plan': '/ai-tools/lesson-plan',
  worksheet: '/ai-tools/worksheet',
  quiz: '/ai-tools/quiz',
  activity: '/ai-tools/activity',
};

const MATERIAL_BY_KIND: Record<ChatArtifactData['kind'], MaterialType> = {
  'lesson-plan': 'lesson',
  worksheet: 'worksheet',
  quiz: 'quiz',
  activity: 'activity',
};

/** The generator output itself, unwrapped from its discriminated union. */
export function artifactPayload(data: ChatArtifactData): unknown {
  switch (data.kind) {
    case 'lesson-plan':
      return data.plan;
    case 'worksheet':
      return data.worksheet;
    case 'quiz':
      return data.quiz;
    case 'activity':
      return data.activity;
  }
}

export function artifactRoute(data: ChatArtifactData): string {
  return ROUTE_BY_KIND[data.kind];
}

export function artifactMaterialType(data: ChatArtifactData): MaterialType {
  return MATERIAL_BY_KIND[data.kind];
}

/**
 * Title for the saved item, in the teacher's language.
 *
 * Falls back to the kind alone when there is no topic: an untitled row in the
 * workspace is still findable, an empty one is not.
 */
export function artifactTitle(
  data: ChatArtifactData,
  topic: string,
  lang: 'ar' | 'en',
): string {
  const labels: Record<ChatArtifactData['kind'], { ar: string; en: string }> = {
    'lesson-plan': { ar: 'خطة درس', en: 'Lesson plan' },
    worksheet: { ar: 'ورقة عمل', en: 'Worksheet' },
    quiz: { ar: 'اختبار', en: 'Quiz' },
    activity: { ar: 'نشاط', en: 'Activity' },
  };
  const label = lang === 'ar' ? labels[data.kind].ar : labels[data.kind].en;
  const t = topic.trim();
  return t ? `${label}: ${t}` : label;
}
