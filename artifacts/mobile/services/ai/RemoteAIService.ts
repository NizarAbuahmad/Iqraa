/**
 * AI service used by the app.
 *
 * Investor Demo Mode (DEMO_MODE=true): always uses MockAIService locally.
 * No OpenAI / network calls.
 *
 * When DEMO_MODE is flipped off post-funding, this resumes remote API calls
 * with mock fallback on failure.
 */
import {
  ActivityOutput, AIRequest, AIService,
  ClassroomActivity, ClassroomActivityRequest,
  LessonPlanOutput, QuizOutput, WorksheetOutput,
} from './AIService';
import { DEMO_MODE } from './demoMode';
import { MockAIService } from './generators';
import { apiFetch } from '../apiClient';

// Routes under /generate/* and /chat require auth (routes/index.ts scopes
// authMiddleware to those prefixes) — go through apiFetch, not a bare fetch(),
// so the access token actually rides along and a 401 gets one refresh-and-retry
// instead of silently falling through to the mock generator below.
async function postJSON<T>(path: string, body: unknown, timeoutMs = 18_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
  } finally {
    clearTimeout(timer);
  }
}

export class RemoteAIService extends AIService {
  private fallback = new MockAIService();

  async generateLessonPlan(req: AIRequest): Promise<LessonPlanOutput> {
    if (DEMO_MODE) return this.fallback.generateLessonPlan(req);
    try {
      return await postJSON<LessonPlanOutput>('/generate/lesson-plan', req);
    } catch (e) {
      console.warn('[RemoteAIService] lesson-plan fallback:', e);
      return this.fallback.generateLessonPlan(req);
    }
  }

  async generateWorksheet(req: AIRequest): Promise<WorksheetOutput> {
    if (DEMO_MODE) return this.fallback.generateWorksheet(req);
    try {
      return await postJSON<WorksheetOutput>('/generate/worksheet', req);
    } catch (e) {
      console.warn('[RemoteAIService] worksheet fallback:', e);
      return this.fallback.generateWorksheet(req);
    }
  }

  async generateQuiz(req: AIRequest): Promise<QuizOutput> {
    if (DEMO_MODE) return this.fallback.generateQuiz(req);
    try {
      return await postJSON<QuizOutput>('/generate/quiz', req);
    } catch (e) {
      console.warn('[RemoteAIService] quiz fallback:', e);
      return this.fallback.generateQuiz(req);
    }
  }

  async generateActivity(req: AIRequest): Promise<ActivityOutput> {
    if (DEMO_MODE) return this.fallback.generateActivity(req);
    try {
      return await postJSON<ActivityOutput>('/generate/activity', req);
    } catch (e) {
      console.warn('[RemoteAIService] activity fallback:', e);
      return this.fallback.generateActivity(req);
    }
  }

  async generateHomework(req: AIRequest): Promise<WorksheetOutput> {
    if (DEMO_MODE) return this.fallback.generateHomework(req);
    try {
      return await postJSON<WorksheetOutput>('/generate/homework', req);
    } catch (e) {
      console.warn('[RemoteAIService] homework fallback:', e);
      return this.fallback.generateHomework(req);
    }
  }

  async generateClassroomActivity(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    if (DEMO_MODE) return this.fallback.generateClassroomActivity(req);
    try {
      return await postJSON<ClassroomActivity>('/generate/classroom-activity', req);
    } catch (e) {
      console.warn('[RemoteAIService] classroom-activity fallback:', e);
      return this.fallback.generateClassroomActivity(req);
    }
  }

  /**
   * Chat with iQra. In Demo Mode this throws so callers use local KB text.
   */
  async chat(params: {
    messages: { role: string; content: string }[];
    context?: string;
    mode: 'teacher' | 'student';
    language: 'ar' | 'en';
  }): Promise<string> {
    if (DEMO_MODE) {
      // Prefer grounding text already built by the chat screen.
      if (params.context?.trim()) return params.context.trim();
      throw new Error('Demo Mode: local KB only');
    }
    const res = await postJSON<{ content: string }>('/chat', params);
    return res.content ?? '';
  }
}

export const remoteAIService = new RemoteAIService();
