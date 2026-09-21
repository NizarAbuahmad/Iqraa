/**
 * A teacher's weekly period timetable — which class meets on which day at
 * which period, and what time each period actually is. See
 * artifacts/api-server/src/routes/schedule.ts.
 *
 * Distinct from teachingPlans.ts: a plan is *what curriculum lesson* is
 * covered on a date, for one class; this is *which class* a teacher is in
 * front of at a recurring day+period, every week. Same shape as roster.ts and
 * teachingPlans.ts otherwise — no local fallback, server state with no
 * offline meaning.
 */
import { apiFetch } from './apiClient.ts';

export interface SchedulePeriod {
  id: string;
  periodNumber: number;
  /** "HH:MM", 24-hour. */
  startTime: string;
  durationMinutes: number;
}

export interface ScheduleSlot {
  id: string;
  /** 0 = Sunday .. 6 = Saturday — matches Date#getDay() and planEntries.ts. */
  dayOfWeek: number;
  periodNumber: number;
  /** Empty slot (free period, lunch, admin time) when null. */
  classGroupId: string | null;
  notes: string;
}

export class ScheduleError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ScheduleError';
    this.status = status;
    this.code = code;
  }

  get isStorageUnavailable(): boolean {
    return this.code === 'schedule_storage_unavailable';
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
    throw new ScheduleError(detail || `${action} failed (${res.status})`, res.status, code);
  }
  return (await res.json()) as T;
}

export async function getSchedule(): Promise<{ periods: SchedulePeriod[]; slots: ScheduleSlot[] }> {
  const res = await apiFetch('/schedule');
  return readJson(res, 'Loading schedule');
}

export async function setSchedulePeriod(
  periodNumber: number,
  input: { startTime: string; durationMinutes?: number },
): Promise<SchedulePeriod> {
  const res = await apiFetch(`/schedule/periods/${periodNumber}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  const data = await readJson<{ period: SchedulePeriod }>(res, 'Saving period');
  return data.period;
}

export async function deleteSchedulePeriod(periodNumber: number): Promise<void> {
  const res = await apiFetch(`/schedule/periods/${periodNumber}`, { method: 'DELETE' });
  await readJson(res, 'Deleting period');
}

export async function setScheduleSlot(
  dayOfWeek: number,
  periodNumber: number,
  input: { classGroupId?: string | null; notes?: string },
): Promise<ScheduleSlot> {
  const res = await apiFetch(`/schedule/slots/${dayOfWeek}/${periodNumber}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  const data = await readJson<{ slot: ScheduleSlot }>(res, 'Saving schedule slot');
  return data.slot;
}
