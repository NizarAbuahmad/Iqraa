import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/**
 * Every screen under /play takes the games hub's hue (constants/corners.ts).
 * Each game keeps its own colour inside `GameShell`: only the hub's band and
 * chrome are magenta.
 */
export default function PlayLayout() {
  return (
    <CornerThemeProvider corner="play">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
