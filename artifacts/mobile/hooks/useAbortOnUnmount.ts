import { useEffect, type RefObject } from 'react';

/**
 * Abort the screen's in-flight generation when the teacher leaves it.
 *
 * Every generator screen keeps its `AbortController` in a ref so Cancel can
 * reach the request, and every one of them let the request keep running when
 * the screen unmounted — still billing against AI_BUDGET_USD for a result
 * nobody would see. The ref is the same one Cancel uses; this only adds the
 * unmount case.
 */
export function useAbortOnUnmount(abortRef: RefObject<AbortController | null>): void {
  useEffect(() => () => { abortRef.current?.abort(); }, [abortRef]);
}
