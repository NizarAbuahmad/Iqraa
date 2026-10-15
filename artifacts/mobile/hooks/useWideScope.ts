/**
 * What a generator screen holds about a wide scope: the structured selection
 * `TopicSelector` reports, and how the teacher wants questions spread over it.
 *
 * Both are seeded from route params, because a saved material reopens through
 * them (`scopeFormState` writes the same two keys). A material saved before
 * this existed has neither and reads as no scope, balanced — today's behaviour.
 *
 * `current` is the screen's grade/subject pickers. A saved scope belongs to the
 * book it was picked in; when the pickers have since landed elsewhere (the
 * teacher's fallback after a changed subject set) it is stale, and the scope
 * reads as not wide rather than generating a paper for the wrong book.
 * Omitted, no such check is made.
 */
import { useState } from 'react';
import type { Distribution } from '@/services/coveragePlan';
import { distributionFromParam, scopeFromParam } from '@/services/wideScopeRequest';
import type { ScopeSelection } from '@/services/scopeSelection';

export function useWideScope(
  params: { scope?: string; distribution?: string },
  current?: { gradeId: string; subjectId: string },
) {
  const [scopeSel, setScopeSel] = useState<ScopeSelection | null>(() => scopeFromParam(params.scope));
  const [distribution, setDistribution] = useState<Distribution>(() => distributionFromParam(params.distribution));
  const isWide = !!scopeSel && scopeSel.kind !== 'lesson'
    && (!current || (scopeSel.gradeId === current.gradeId && scopeSel.subjectId === current.subjectId));
  return { scopeSel, setScopeSel, distribution, setDistribution, isWide };
}
