/**
 * What a generator screen holds about a wide scope: the structured selection
 * `TopicSelector` reports, and how the teacher wants questions spread over it.
 *
 * Both are seeded from route params, because a saved material reopens through
 * them (`scopeFormState` writes the same two keys). A material saved before
 * this existed has neither and reads as no scope, balanced — today's behaviour.
 */
import { useState } from 'react';
import type { Distribution } from '@/services/coveragePlan';
import { distributionFromParam, scopeFromParam } from '@/services/wideScopeRequest';
import type { ScopeSelection } from '@/services/scopeSelection';

export function useWideScope(params: { scope?: string; distribution?: string }) {
  const [scopeSel, setScopeSel] = useState<ScopeSelection | null>(() => scopeFromParam(params.scope));
  const [distribution, setDistribution] = useState<Distribution>(() => distributionFromParam(params.distribution));
  const isWide = !!scopeSel && scopeSel.kind !== 'lesson';
  return { scopeSel, setScopeSel, distribution, setDistribution, isWide };
}
