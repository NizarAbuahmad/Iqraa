/**
 * AI service used by the app.
 *
 * Investor Demo Mode (DEMO_MODE=true): always uses MockAIService locally.
 * No OpenAI / network calls.
 *
 * With DEMO_MODE off it calls the API and falls back to the mock generator on
 * failure — but never silently. Every call records where its content came from
 * in `aiProvenance`, which the UI badge reads, because mock output is
 * indistinguishable from a real answer by inspection: it is a well-formed
 * Arabic lesson plan either way. A `console.warn` is not a disclosure to a
 * teacher holding the result.
 */
import {
  ActivityOutput, AIRequest, AIService,
  ClassroomActivity, ClassroomActivityRequest,
  GenerateOptions,
  LessonPlanOutput, QuizOutput, WorksheetOutput,
} from './AIService';
import { DEMO_MODE } from './demoMode';
import { MockAIService } from './generators';
import { applyClassroomSetup } from '@/services/classroomRouting';
import { apiFetch } from '../apiClient';
import { describeAiError, generateWithProvenance, recordGeneration } from './aiProvenance.ts';

// Routes under /generate/* and /chat require auth (routes/index.ts scopes
// authMiddleware to those prefixes) — go through apiFetch, not a bare fetch(),
// so the access token actually rides along and a 401 gets one refresh-and-retry
// instead of silently falling through to the mock generator below.
/**
 * The request ran out of time — deliberately NOT an `AbortError`.
 *
 * `iqraa-api` is a free Render service: it sleeps after ~15 minutes idle and
 * takes 30-60s to answer the first request after that (see render.yaml). The
 * old 18s ceiling was below that floor, so the first generation of any session
 * timed out — and, being an `AbortError`, was classified as a cancellation,
 * which is the one failure the fallback deliberately does not cover. Every
 * activity type failed identically with no sample content and no explanation.
 */
class TimeoutError extends Error {
  constructor(path: string, ms: number) {
    super(`Request to ${path} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

async function postJSON<T>(
  path: string,
  body: unknown,
  opts: GenerateOptions = {},
  timeoutMs = 45_000,
): Promise<T> {
  const controller = new AbortController();
  // Which of the two aborts fired. Both reach `fetch` through one controller
  // and both surface as `AbortError`, and the fallback policy reads that name
  // to mean "the teacher pressed Cancel" and refuses to substitute mock
  // content (see generateWithProvenance). A timeout is not a cancel: without
  // this flag every timeout was reported as a cancellation and the teacher got
  // «تعذر إتمام العملية» with no fallback and nothing on screen.
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  // Two things can end this request — the timeout above and the teacher
  // pressing Cancel — and `fetch` takes one signal. Forwarding the caller's
  // abort into the same controller keeps one signal on the wire without either
  // side having to know about the other.
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);
  if (opts.signal?.aborted) controller.abort();
  try {
    const res = await apiFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  } catch (e) {
    // A real cancel still wins: if the caller's signal is aborted the teacher
    // asked to stop, whatever the timer did afterwards.
    if (timedOut && !opts.signal?.aborted) {
      throw new TimeoutError(path, timeoutMs);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export class RemoteAIService extends AIService {
  private fallback = new MockAIService();

  async generateLessonPlan(req: AIRequest, opts?: GenerateOptions): Promise<LessonPlanOutput> {
    return generateWithProvenance(
      'lesson-plan',
      () => postJSON<LessonPlanOutput>('/generate/lesson-plan', req, opts),
      () => this.fallback.generateLessonPlan(req),
    );
  }

  async generateWorksheet(req: AIRequest, opts?: GenerateOptions): Promise<WorksheetOutput> {
    return generateWithProvenance(
      'worksheet',
      () => postJSON<WorksheetOutput>('/generate/worksheet', req, opts),
      () => this.fallback.generateWorksheet(req),
    );
  }

  async generateQuiz(req: AIRequest, opts?: GenerateOptions): Promise<QuizOutput> {
    return generateWithProvenance(
      'quiz',
      () => postJSON<QuizOutput>('/generate/quiz', req, opts),
      () => this.fallback.generateQuiz(req),
    );
  }

  async generateActivity(req: AIRequest, opts?: GenerateOptions): Promise<ActivityOutput> {
    return generateWithProvenance(
      'activity',
      () => postJSON<ActivityOutput>('/generate/activity', req, opts),
      () => this.fallback.generateActivity(req),
    );
  }

  async generateHomework(req: AIRequest, opts?: GenerateOptions): Promise<WorksheetOutput> {
    return generateWithProvenance(
      'homework',
      () => postJSON<WorksheetOutput>('/generate/homework', req, opts),
      () => this.fallback.generateHomework(req),
    );
  }

  async generateClassroomActivity(req: ClassroomActivityRequest, opts?: GenerateOptions): Promise<ClassroomActivity> {
    const activity = await generateWithProvenance(
      'classroom-activity',
      () => postJSON<ClassroomActivity>('/generate/classroom-activity', req, opts),
      () => this.fallback.generateClassroomActivity(req),
    );
    // Applied here rather than inside the generators: the mock deck, the live
    // deck and any future source all pass through this method, and a model
    // that ignored the prompt's "there is a projector" line would otherwise
    // still tell the teacher to print the slides.
    return applyClassroomSetup(
      activity,
      req.classroomSetup ?? 'screen',
      req.language === 'arabic',
    );
  }

  /**
   * Chat with iQra. In Demo Mode this throws so callers use local KB text.
   *
   * No mock fallback here — the chat screen has its own local answer path and
   * catches. It still records the failure, so the badge reports it: a
   * knowledge-base answer and a model answer read alike to a teacher.
   */
  async chat(params: {
    messages: { role: string; content: string }[];
    context?: string;
    mode: 'teacher' | 'student';
    language: 'ar' | 'en';
  }): Promise<string> {
    if (DEMO_MODE) {
      recordGeneration({ kind: 'chat', source: 'mock', reason: 'demo-mode', at: Date.now() });
      // Prefer grounding text already built by the chat screen.
      if (params.context?.trim()) return params.context.trim();
      throw new Error('Demo Mode: local KB only');
    }
    try {
      const res = await postJSON<{ content: string }>('/chat', params);
      recordGeneration({ kind: 'chat', source: 'live', reason: 'live', at: Date.now() });
      return res.content ?? '';
    } catch (e) {
      recordGeneration({
        kind: 'chat', source: 'none', reason: 'failed',
        error: describeAiError(e), at: Date.now(),
      });
      throw e;
    }
  }
}

export const remoteAIService = new RemoteAIService();
