import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Real browser viewport width on web (RN's own dimensions lag behind on
 * resize); falls straight through to RN's width on native. Extracted from
 * the pattern in app/(auth)/login.tsx.
 */
export function useViewportWidth(): number {
  const { width } = useWindowDimensions();
  const [viewportW, setViewportW] = useState(width);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setViewportW(width);
      return;
    }
    const sync = () => setViewportW(window.innerWidth);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [width]);

  return viewportW;
}
