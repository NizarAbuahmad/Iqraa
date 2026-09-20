/**
 * Teaching plans service — a teacher's own free-text notes of what they
 * intend to teach (school, grades, topics, schedule). See
 * artifacts/api-server/src/routes/teachingPlans.ts.
 *
 * Same shape as roster.ts: no local fallback, since a plan is server state
 * with no offline meaning.
 */
import { apiFetch } from './apiClient.ts';

export interface TeachingPlan {
  id: string;
  title: string;
  schoolName: string;
  /** The linked class's id, null if the teacher hasn't attached one. */
  classGroupId: string | null;
  grades: string;
  topics: string;
  date: string;
  time: string;
  notes: string;
  createdAt: string;
}

export class TeachingPlanError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'TeachingPlanError';
    this.status = status;
    this.code = code;
  }

  get isStorageUnavailable(): boolean {
    return this.code === 'teaching_plans_storage_unavailable';
  }
}

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new TeachingPlanError(
      detail || `${action} failed (${res.status})`,
      res.status,
      code,
    );
  }
  return (await res.json()) as T;
}

export async function listTeachingPlans(): Promise<TeachingPlan[]> {
  const res = await apiFetch('/teaching-plans');
  const data = await readJson<{ plans: TeachingPlan[] }>(res, 'Loading teaching plans');
  return data.plans;
}

export async function createTeachingPlan(input: {
  title: string;
  schoolName?: string;
  classGroupId?: string | null;
  grades?: string;
  topics?: string;
  date?: string;
  time?: string;
  notes?: string;
}): Promise<TeachingPlan> {
  const res = await apiFetch('/teaching-plans', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await readJson<{ plan: TeachingPlan }>(res, 'Creating teaching plan');
  return data.plan;
}

export async function updateTeachingPlan(
  planId: string,
  patch: {
    title?: string;
    schoolName?: string;
    classGroupId?: string | null;
    grades?: string;
    topics?: string;
    date?: string;
    time?: string;
    notes?: string;
  },
): Promise<TeachingPlan> {
  const res = await apiFetch(`/teaching-plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await readJson<{ plan: TeachingPlan }>(res, 'Updating teaching plan');
  return data.plan;
}

export async function archiveTeachingPlan(planId: string): Promise<void> {
  const res = await apiFetch(`/teaching-plans/${planId}`, { method: 'DELETE' });
  await readJson<{ archived: string }>(res, 'Deleting teaching plan');
}
