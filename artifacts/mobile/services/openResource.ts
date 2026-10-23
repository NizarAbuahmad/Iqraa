/**
 * Open a Library item someone put in front of a class — a shelf row on the
 * class screen, or an attachment on a homework in «المدرسة». Where it goes is
 * decided by `openTargetFor` (pure, tested); this file only acts on it, which
 * is why it is split out: expo-router cannot load under bare `node --test`.
 *
 * A premade sheet opens in the viewer for a teacher. The viewer lives under
 * /workspace, which is teacher-only, so a parent or student gets the sheet as
 * a PDF to print instead — the Library screen's rule, and its code.
 */
import { router } from 'expo-router';
import { allPremade } from '@workspace/curriculum/premade';
import { getSubjectsForGrade, getVisibleGrades } from '@workspace/curriculum';
import { readPrintStyle } from '@/hooks/usePrintStyle';
import { openTargetFor } from './classResources';
import type { HomeworkGameResource, HomeworkMaterialResource } from './homework';
import { openExternal } from './externalLinks';
import { buildWorksheetHTML, exportAsPDF } from './share';

export function openResource(
  resource: (Parameters<typeof openTargetFor>[0] & { title: string }) | HomeworkMaterialResource | HomeworkGameResource,
  opts: { teacher: boolean; isAr: boolean; homeworkId?: string },
): void {
  // A lesson game: straight into the attached game. `/play` is public, and `hw`
  // is what makes a student's finished round post back to the teacher.
  if ('game' in resource) {
    router.push({
      pathname: '/play/lesson/[lessonId]',
      params: { lessonId: resource.lessonId, game: resource.game, ...(opts.homeworkId ? { hw: opts.homeworkId } : {}) },
    } as never);
    return;
  }
  // A teacher's saved material on a homework: the viewer's read-only family
  // source, which /workspace/view lets a parent or student into (routeGating.ts).
  if ('materialId' in resource) {
    if (opts.homeworkId) {
      router.push({ pathname: '/workspace/view' as never, params: { hw: opts.homeworkId, material: resource.materialId } });
    }
    return;
  }
  const target = openTargetFor(resource);
  if (target.kind === 'url') void openExternal(target.url);
  else if (target.kind === 'premade') {
    // `as never`: the typed route has no `premade` param, as in the Library screen.
    if (opts.teacher) router.push({ pathname: '/workspace/view' as never, params: { premade: target.id } });
    else void printPremadeSheet(target.id, resource.title, opts.isAr);
  }
  // `as never`: the lab routes are typed per-id, as the premade branch above is.
  else if (target.kind === 'lab') router.push(target.path as never);
}

/**
 * A frozen sheet has no URL: it is rendered on the spot and handed to the
 * print/share sheet, the same path the worksheet generator's PDF export takes.
 * No export menu on this path, so it prints in the style last picked in one.
 */
export async function printPremadeSheet(sheetId: string, title: string, isAr: boolean): Promise<void> {
  const sheet = allPremade().find(s => s.id === sheetId);
  if (!sheet) return;
  const grade = getVisibleGrades().find(g => g.id === sheet.gradeId);
  const subject = getSubjectsForGrade(sheet.gradeId).find(s => s.id === sheet.subjectId);
  const html = buildWorksheetHTML(
    sheet.content,
    title,
    {
      subject: subject ? (isAr ? subject.nameAr : subject.name) : '',
      grade: grade ? (isAr ? grade.nameAr : grade.name) : '',
    },
    isAr,
    [],
    true,
    await readPrintStyle(),
  );
  void exportAsPDF(html, `${title}.pdf`);
}
