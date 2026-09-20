/**
 * Teaching plans service — what a teacher intends to teach a class, and when.
 * See artifacts/api-server/src/routes/teachingPlans.ts.
 *
 * Same shape as roster.ts: no local fallback, since a plan is server state
 * with no offline meaning.
 */
import { apiFetch } from './apiClient.ts';
import type { PlanEntry } from './planEntries.ts';

export interface TeachingPlan {
  id: string;
  title: string;
  schoolName: string;
  /** The class this plan is for. Null only on plans predating the anchor. */
  classGroupId: string | null;
  /**
   * The schedule — lesson id against week. Comes off a `jsonb` column, so it
   * is `unknown` until `normalizePlanEntries` (services/planEntries.ts) has
   * had it: an older client wrote whatever it wrote, and nothing here can
   * assume otherwise.
   */
  entries: unknown;
  /** Legacy free text, superseded by `entries`/the class. Still displayed. */
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
  entries?: PlanEntry[];
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
    entries?: PlanEntry[];
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
