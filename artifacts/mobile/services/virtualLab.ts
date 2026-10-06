/**
 * A virtual-lab sheet as a worksheet, so export, save, class filing and the
 * student/teacher copy all work through the worksheet paths unchanged.
 * Pure — no react-native — so the tests can load it.
 */
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';
import { getExternalResource, releasedVirtualLab } from '@workspace/curriculum';
import type { WorksheetOutput, WorksheetSection } from './ai/AIService.ts';

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
