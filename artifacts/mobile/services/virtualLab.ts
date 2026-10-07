/**
 * A virtual-lab sheet as a worksheet, so export, save, class filing and the
 * student/teacher copy all work through the worksheet paths unchanged.
 * Pure — no react-native — so the tests can load it.
 */
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';
import { getExternalResource, releasedVirtualLab } from '@workspace/curriculum';
import type { WorksheetOutput, WorksheetSection } from './ai/AIService.ts';
// Type-only: workspace.ts pulls in AsyncStorage, which `node --test` cannot load.
import type { SavedMaterial } from './workspace.ts';

const SECTIONS = [['predict', 'أتوقّع'], ['observe', 'ألاحظ'], ['explain', 'أفسّر']] as const;

export function virtualLabWorksheet(sheet: VirtualLabSheet, resource: ExternalResource, lessonTitle: string): WorksheetOutput {
  const sections: WorksheetSection[] = SECTIONS.map(([part, title]) => ({
    type: 'short_answer',
    title,
    questions: sheet[part].map(text => ({ text, points: 1 })),
  }));
  let num = 0;
  const answerKey = SECTIONS.flatMap(([part]) => sheet.teacherKey[part].map(answer => ({ num: ++num, answer })));
  return {
    title: `مختبر افتراضي: ${lessonTitle}`,
    instructions: sheet.aimAr,
    sections,
    answerKey,
    lab: { url: resource.sourceUrl, simName: resource.titleAr, attribution: resource.attribution, steps: sheet.procedure },
  };
}

export function virtualLabFor(lessonId: string, opts: { dev: boolean }): { sheet: VirtualLabSheet; resource: ExternalResource } | null {
  const sheet = releasedVirtualLab(lessonId, { dev: opts.dev });
  const resource = sheet ? getExternalResource(sheet.resourceId) : undefined;
  return sheet && resource ? { sheet, resource } : null;
}

/**
 * The chat message for the lab chip: the worksheet as the card, and the link
 * and credit in the prose around it, so they survive when the card is not
 * what gets copied.
 */
export function virtualLabChatMessage(
  sheet: VirtualLabSheet, resource: ExternalResource,
  ctx: { topic: string; subjectLabel: string; gradeName: string },
) {
  const worksheet = virtualLabWorksheet(sheet, resource, ctx.topic);
  const prose = `هذه ورقة المختبر الافتراضي لدرس «${ctx.topic}». يفتح الطلبة المحاكاة على موقعها:\n${resource.sourceUrl}\n${resource.attribution}`;
  return {
    text: prose,
    prose,
    data: { kind: 'worksheet' as const, worksheet },
    meta: { title: worksheet.title, subject: ctx.subjectLabel, grade: ctx.gradeName, lang: 'ar' as const },
  };
}

/**
 * Whether the thread already holds this lesson's lab sheet. The chip stays
 * after it is tapped, and a second tap should not post the sheet twice.
 */
export function hasLabSheetMessage(
  messages: ReadonlyArray<{ curriculumLessonId?: string; artifactData?: { kind: string; worksheet?: WorksheetOutput } }>,
  lessonId: string,
): boolean {
  return messages.some(msg =>
    msg.curriculumLessonId === lessonId
    && msg.artifactData?.kind === 'worksheet'
    && Boolean(msg.artifactData.worksheet?.lab));
}

/**
 * What «احفظ في موادي» stores. It is an ordinary worksheet — so view, export,
 * class filing and the student/teacher copy need no new branch — with
 * `materialKind` left in formState to tell it apart (and `topic` beside it, so
 * nothing reopening it can fall back to the teacher's default scope), and the `lab` block kept
 * in `content` so the printed copy still carries the link, credit and QR.
 */
export function virtualLabSavePayload(
  ws: WorksheetOutput,
  lessonId: string,
  ctx: { topic: string; subjectLabel: string; gradeName: string },
): Omit<SavedMaterial, 'id' | 'savedAt' | 'isFavorite'> {
  return {
    type: 'worksheet',
    title: ws.title,
    subject: ctx.subjectLabel,
    grade: ctx.gradeName,
    topic: ctx.topic,
    language: 'ar',
    content: JSON.stringify(ws),
    formState: { lessonId, topic: ctx.topic, materialKind: 'virtual-lab' },
  };
}
