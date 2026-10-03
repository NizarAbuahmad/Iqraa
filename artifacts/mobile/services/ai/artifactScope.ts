/**
 * The subject and grade a chat-generated material is labelled with.
 *
 * Chat's `buildRequest` used to fall back to الرياضيات / الصف العاشر whenever
 * no KB lesson was resolved — the document-upload path and every ungrounded
 * topic. Generators branch on the subject NAME (`isMathContext`, see
 * CLAUDE.md), so a chemistry teacher's uploaded worksheet came back as a maths
 * quiz headed «الرياضيات». The lesson, when there is one, still names its own
 * book; otherwise the scope the screen already holds — the picked subject and
 * grade — names the request, and only with nothing known at all does the
 * historical default remain.
 *
 * Pure, and apart from `chatArtifacts.ts` for the reason `artifactTopic.ts`
 * is: that module imports `RemoteAIService` at value level, which `node:test`
 * cannot load.
 */

import { GRADES, SUBJECTS } from '../curriculumData.ts';
import type { KBLesson } from '../knowledgeBase.ts';
import { resolveCurriculumContext } from './teachingAssistant.ts';

export type ArtifactScope = {
  subjectId?: string | null;
  gradeId?: string | null;
};

export function resolveArtifactScope(
  lesson: KBLesson | null,
  scope: ArtifactScope | null | undefined,
  lang: 'ar' | 'en',
): { subject: string; grade: string } {
  const isAr = lang === 'ar';
  if (lesson) {
    const ctx = resolveCurriculumContext(lesson);
    return isAr
      ? { subject: ctx.subjectAr, grade: ctx.gradeAr }
      : { subject: ctx.subjectEn, grade: ctx.gradeEn };
  }
  const subject = scope?.subjectId ? SUBJECTS.find(s => s.id === scope.subjectId) : undefined;
  const grade = scope?.gradeId ? GRADES.find(g => g.id === scope.gradeId) : undefined;
  return {
    subject: subject ? (isAr ? subject.nameAr : subject.name) : (isAr ? 'الرياضيات' : 'Mathematics'),
    grade: grade ? (isAr ? grade.nameAr : grade.name) : (isAr ? 'الصف العاشر' : 'Grade 10'),
  };
}
