/**
 * RemoteAIService – calls the Replit API server which proxies to OpenAI.
 * Falls back to MockAIService automatically if the network call fails
 * (e.g. offline, server unavailable).
 */
import {
  ActivityOutput, AIRequest, AIService,
  ClassroomActivity, ClassroomActivityRequest,
  LessonPlanOutput, QuizOutput, WorksheetOutput,
} from './AIService';
import { MockAIService } from './generators';

// The API server is available at /api on the same Replit dev domain.
// In Expo web the domain is the same origin, so a relative URL works.
// In Expo Go / native builds we prefix with the dev domain env var.
function apiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  // Fallback: relative URL works for Expo web
  return '/api';
}

async function postJSON<T>(path: string, body: unknown, timeoutMs = 18_000): Promise<T> {
  const url = `${apiBase()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    try {
      return await postJSON<LessonPlanOutput>('/generate/lesson-plan', req);
    } catch (e) {
      console.warn('[RemoteAIService] lesson-plan fallback:', e);
      return this.fallback.generateLessonPlan(req);
    }
  }

  async generateWorksheet(req: AIRequest): Promise<WorksheetOutput> {
    try {
      return await postJSON<WorksheetOutput>('/generate/worksheet', req);
    } catch (e) {
      console.warn('[RemoteAIService] worksheet fallback:', e);
      return this.fallback.generateWorksheet(req);
    }
  }

  async generateQuiz(req: AIRequest): Promise<QuizOutput> {
    try {
      return await postJSON<QuizOutput>('/generate/quiz', req);
    } catch (e) {
      console.warn('[RemoteAIService] quiz fallback:', e);
      return this.fallback.generateQuiz(req);
    }
  }

  async generateActivity(req: AIRequest): Promise<ActivityOutput> {
    try {
      return await postJSON<ActivityOutput>('/generate/activity', req);
    } catch (e) {
      console.warn('[RemoteAIService] activity fallback:', e);
      return this.fallback.generateActivity(req);
    }
  }

  async generateHomework(req: AIRequest): Promise<WorksheetOutput> {
    try {
      return await postJSON<WorksheetOutput>('/generate/homework', req);
    } catch (e) {
      console.warn('[RemoteAIService] homework fallback:', e);
      return this.fallback.generateHomework(req);
    }
  }

  async generateClassroomActivity(req: ClassroomActivityRequest): Promise<ClassroomActivity> {
    try {
      return await postJSON<ClassroomActivity>('/generate/classroom-activity', req);
    } catch (e) {
      console.warn('[RemoteAIService] classroom-activity fallback:', e);
      return this.fallback.generateClassroomActivity(req);
    }
  }

  /**
   * Chat with iQra — sends conversation history + KB context to the server.
   * Returns the assistant's text reply.
   */
  async chat(params: {
    messages: { role: string; content: string }[];
    context?: string;
    mode: 'teacher' | 'student';
    language: 'ar' | 'en';
  }): Promise<string> {
    const res = await postJSON<{ content: string }>('/chat', params);
    return res.content ?? '';
  }
}

export const remoteAIService = new RemoteAIService();
