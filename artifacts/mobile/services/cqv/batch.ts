/**
 * CQV "Test Entire Lesson" — generates all 8 artifacts for one lesson via Demo Mode AI.
 * Internal tooling only; does not touch Investor MVP screens.
 */

import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { runLessonFlowFrom } from '@/services/ai/lessonFlowRunner';
import type { AIRequest } from '@/services/ai/AIService';
import { buildGeneratorContext } from '@/services/kbContext';
import { saveItem, type MaterialType } from '@/services/workspace';
import { getArtifactDef } from './artifacts';
import { getCqvLesson } from './catalog';
import {
  createEmptyReport,
  getReport,
  saveGeneratedOutput,
  saveReport,
} from './reports';
import { CQV_ARTIFACT_IDS, type CqvArtifactId, type CqvReport } from './types';

export type BatchArtifactState =
  | 'pending'
  | 'running'
  | 'done'
  | 'error'
  | 'skipped';

export type BatchProgressEvent = {
  artifactId: CqvArtifactId;
  label: string;
  state: BatchArtifactState;
  index: number;
  total: number;
  error?: string;
  report?: CqvReport;
};

export type BatchRunResult = {
  lessonId: string;
  reports: CqvReport[];
  succeeded: number;
  failed: number;
};

function baseRequest(topic: string, additionalContext?: string): AIRequest {
  return {
    grade: 'الصف العاشر',
    subject: 'الرياضيات',
    topic,
    duration: 45,
    language: 'arabic',
    additionalContext,
    difficulty: 'mixed',
    numQuestions: 8,
    totalMarks: 20,
    activityType: 'group',
    teachingStyle: 'inquiry',
  };
}

function materialTypeFor(artifactId: CqvArtifactId): MaterialType {
  switch (artifactId) {
    case 'lesson-plan':
    case 'classroom-activity':
      return 'lesson';
    case 'worksheet':
    case 'homework':
    case 'answer-key':
      return 'worksheet';
    case 'quiz':
    case 'assessment':
      return 'quiz';
    case 'interactive-lesson':
      return 'flow';
    default:
      return 'lesson';
  }
}

async function generateArtifactContent(
  artifactId: CqvArtifactId,
  req: AIRequest,
): Promise<{ title: string; content: unknown }> {
  const def = getArtifactDef(artifactId);
  switch (artifactId) {
    case 'lesson-plan': {
      const out = await aiService.generateLessonPlan(req);
      return { title: out.title || def.labelAr, content: out };
    }
    case 'worksheet': {
      const out = await aiService.generateWorksheet(req);
      return { title: out.title || def.labelAr, content: out };
    }
    case 'quiz': {
      const out = await aiService.generateQuiz(req);
      return { title: out.title || def.labelAr, content: out };
    }
    case 'homework': {
      const out = await aiService.generateHomework(req);
      return { title: out.title || `واجب: ${req.topic}`, content: out };
    }
    case 'classroom-activity': {
      const out = await aiService.generateActivity(req);
      return { title: out.title || def.labelAr, content: out };
    }
    case 'assessment': {
      const out = await aiService.generateQuiz({
        ...req,
        numQuestions: 10,
        totalMarks: 30,
        additionalContext: [req.additionalContext, 'Assessment / summative check'].filter(Boolean).join('\n'),
      });
      return { title: `تقييم: ${req.topic}`, content: out };
    }
    case 'answer-key': {
      const out = await aiService.generateWorksheet({
        ...req,
        additionalContext: [req.additionalContext, 'Include a clear answer key for teacher use.'].filter(Boolean).join('\n'),
      });
      return {
        title: `مفتاح الإجابة: ${req.topic}`,
        content: {
          title: `مفتاح الإجابة – ${req.topic}`,
          instructions: 'مفتاح الإجابة للمعلم',
          answerKey: out.answerKey,
          sections: out.sections,
          sourceWorksheetTitle: out.title,
        },
      };
    }
    case 'interactive-lesson': {
      const prior = await runLessonFlowFrom(
        'objectives',
        req,
        aiService,
        {},
        {
          onStepStart: () => {},
          onStepDone: () => {},
        },
      );
      return {
        title: `درس تفاعلي: ${req.topic}`,
        content: prior,
      };
    }
    default:
      throw new Error(`Unsupported artifact: ${artifactId}`);
  }
}

/**
 * Generate all 8 CQV artifacts for a lesson sequentially.
 * Saves each output to workspace + CQV storage and marks generatedAt on the report.
 */
export async function testEntireLesson(
  lessonId: string,
  onProgress?: (event: BatchProgressEvent) => void,
): Promise<BatchRunResult> {
  const lesson = getCqvLesson(lessonId);
  if (!lesson) throw new Error(`Unknown CQV lesson: ${lessonId}`);

  const topic = lesson.lessonNameAr;
  const additionalContext = buildGeneratorContext(topic, 'ar');
  const req = baseRequest(topic, additionalContext);
  const total = CQV_ARTIFACT_IDS.length;
  const reports: CqvReport[] = [];
  let succeeded = 0;
  let failed = 0;

  for (let index = 0; index < CQV_ARTIFACT_IDS.length; index++) {
    const artifactId = CQV_ARTIFACT_IDS[index]!;
    const def = getArtifactDef(artifactId);

    onProgress?.({
      artifactId,
      label: def.label,
      state: 'running',
      index,
      total,
    });

    try {
      const { title, content } = await generateArtifactContent(artifactId, req);
      const contentStr = JSON.stringify(content);
      const materialType = materialTypeFor(artifactId);

      let savedMaterialId: string | null = null;
      try {
        const saved = await saveItem({
          type: materialType,
          title: `[CQV] ${title}`,
          subject: 'الرياضيات',
          grade: 'الصف العاشر',
          topic,
          language: 'ar',
          content: contentStr,
          formState: {
            cqv: true,
            cqvLessonId: lessonId,
            cqvArtifact: artifactId,
            topic,
          },
        });
        savedMaterialId = saved.id;
      } catch {
        // Workspace save is best-effort; CQV output store is source of truth for TAT.
      }

      const existing = await getReport(lessonId, artifactId);
      const base = existing ?? createEmptyReport(lessonId, artifactId)!;
      const now = new Date().toISOString();
      const next = await saveReport({
        ...base,
        generatedAt: now,
        generationError: null,
        savedMaterialId: savedMaterialId ?? base.savedMaterialId,
      });

      await saveGeneratedOutput({
        reportId: next.id,
        lessonId,
        artifactId,
        title,
        content: contentStr,
        materialType,
        generatedAt: now,
      });

      reports.push(next);
      succeeded += 1;
      onProgress?.({
        artifactId,
        label: def.label,
        state: 'done',
        index,
        total,
        report: next,
      });
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : String(e);
      const existing = await getReport(lessonId, artifactId);
      const base = existing ?? createEmptyReport(lessonId, artifactId)!;
      const next = await saveReport({
        ...base,
        generationError: message,
      });
      reports.push(next);
      onProgress?.({
        artifactId,
        label: def.label,
        state: 'error',
        index,
        total,
        error: message,
        report: next,
      });
    }
  }

  return { lessonId, reports, succeeded, failed };
}
