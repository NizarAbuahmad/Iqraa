import { useEffect, useRef, useState } from 'react';
import { getItem, type SavedMaterial } from '@/services/workspace';
import { isPreEnglishMaterial } from '@/services/contentLanguage';
import { DEMO_MODE } from '@/services/ai/demoMode';

/**
 * Whether opening this material redoes it in English. Not on a demo build:
 * its generators are templates, and the copy being replaced may be a real
 * one made on a phone.
 */
export const redoesInEnglish = (item: SavedMaterial): boolean => !DEMO_MODE && isPreEnglishMaterial(item);

/**
 * Redoes a reopened English material that was saved in Arabic, and saves the
 * English version over it — once, as soon as the old copy is on screen.
 *
 * `current` is what the screen shows (null while it generates). A failed or
 * cancelled run puts the old object back, and that is never saved, so the
 * Arabic copy is only replaced by a finished English one.
 */
export function useEnglishRefresh({ savedId, current, generate, save }: {
  savedId: string | undefined;
  current: unknown;
  generate: () => unknown;
  save: () => unknown;
}): void {
  const [stale, setStale] = useState(false);
  // undefined: not started; the old copy: generating; null: done.
  const old = useRef<unknown>(undefined);

  useEffect(() => {
    if (!savedId) return;
    let live = true;
    void getItem(savedId).then(item => {
      if (live && item && redoesInEnglish(item)) setStale(true);
    });
    return () => { live = false; };
  }, [savedId]);

  useEffect(() => {
    if (!stale || old.current !== undefined || !current) return;
    old.current = current;
    void generate();
  }, [stale, current]);

  useEffect(() => {
    if (!old.current || !current || current === old.current) return;
    old.current = null;
    void save();
  }, [current]);
}
