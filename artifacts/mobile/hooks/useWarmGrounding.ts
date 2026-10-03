import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { resolveGeneratorGrounding } from '@/services/kbContext';

/**
 * Ranks the KB for the topic while the teacher pauses, so the Generate tap
 * finds the result cached. The first scan of a new topic costs 100+ ms on a
 * desktop and several times that on a phone; paying it here, idle, instead of
 * on the tap is the difference between a spinner at once and a frozen button.
 */
export function useWarmGrounding(topic: string, lang: string): void {
  useEffect(() => {
    const q = topic.trim();
    if (q.length < 3) return;
    let task: { cancel: () => void } | undefined;
    const id = setTimeout(() => {
      task = InteractionManager.runAfterInteractions(() => {
        resolveGeneratorGrounding(q, lang as 'ar' | 'en');
      });
    }, 400);
    return () => { clearTimeout(id); task?.cancel(); };
  }, [topic, lang]);
}
