/**
 * Module-level singleton that passes a generated ClassroomActivity from the
 * builder screen to the presentation screen without serialising it into a URL.
 */
import { ClassroomActivity } from './ai/AIService';

let _activity: ClassroomActivity | null = null;

export function setPendingClassroomActivity(a: ClassroomActivity): void {
  _activity = a;
}

export function getPendingClassroomActivity(): ClassroomActivity | null {
  return _activity;
}

export function clearClassroomActivity(): void {
  _activity = null;
}
