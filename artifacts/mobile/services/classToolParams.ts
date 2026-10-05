/**
 * Route params for "make a material for this class".
 *
 * The class screen's الموارد tab sends a teacher to the AI tools to create
 * something. Without this, the tools knew nothing about where they came from:
 * every screen defaulted `subjectIdx` to 0 (Mathematics), so a chemistry class
 * opened a maths tool, and the finished material had to be filed into the
 * class by hand through a picker the teacher had already answered by starting
 * from the class.
 *
 * Pure TypeScript, no React — it decides, the screens render, the tests run it.
 */
import { scopePickerParams } from './lessonPrep.ts';

export type ClassToolParams = { classId: string; gradeIdx?: string; subjectIdx?: string };

/**
 * `classId` always; the picker indices only when the class's grade and subject
 * both resolve. A class made before subjects were stored has none, and an
 * index the list cannot honour would silently become 0 — Mathematics — so the
 * indices are left out rather than guessed.
 */
export function classToolParams(group: {
  id: string;
  gradeId: string;
  subjectId: string;
}): ClassToolParams {
  return { classId: group.id, ...scopePickerParams(group.gradeId, group.subjectId) };
}

type RouteValue = string | string[] | undefined;

/** A picker index as a route param: a whole, non-negative number, or nothing. */
function indexFromParam(value: RouteValue): string | undefined {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first && /^\d+$/.test(first) ? first : undefined;
}

/**
 * What the AI-tools hub forwards to whichever tool the teacher opens, read
 * back from the hub's own route. Null without a class, which is the ordinary
 * hub. A bad index is dropped rather than passed on: it would reach a tool as
 * `NaN`, which the tools read as index 0 — Mathematics.
 */
export function classToolParamsFromRoute(params: {
  classId?: RouteValue;
  gradeIdx?: RouteValue;
  subjectIdx?: RouteValue;
}): ClassToolParams | null {
  const classId = classIdFromParam(params.classId);
  if (!classId) return null;
  const gradeIdx = indexFromParam(params.gradeIdx);
  const subjectIdx = indexFromParam(params.subjectIdx);
  return {
    classId,
    ...(gradeIdx !== undefined ? { gradeIdx } : {}),
    ...(subjectIdx !== undefined ? { subjectIdx } : {}),
  };
}

/**
 * The `classId` route param, or null. expo-router types a query value as
 * `string | string[]`, and a hand-edited URL can carry it blank.
 */
export function classIdFromParam(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  const id = first?.trim();
  return id ? id : null;
}
