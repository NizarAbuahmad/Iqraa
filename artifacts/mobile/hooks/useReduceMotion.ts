import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the device asks for reduced motion. It is read once when this
 * module first loads. A screen mounted after the answer arrives knows on its
 * first render; one mounted before it gets the answer moments later, so
 * `Entrance` snaps its card into place rather than finishing the motion. The
 * hook then follows the setting while the app runs. On the web,
 * react-native-web answers from `prefers-reduced-motion`.
 */
let current = false;
const first = AccessibilityInfo.isReduceMotionEnabled()
  .then(v => { current = v; })
  .catch(() => {});

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(current);
  useEffect(() => {
    let alive = true;
    void first.then(() => { if (alive) setReduced(current); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      current = v;
      setReduced(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
