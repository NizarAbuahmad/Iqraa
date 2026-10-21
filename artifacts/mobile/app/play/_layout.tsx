import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/**
 * Every screen under /play takes the games hub's hue (constants/corners.ts).
 * Each game keeps its own band and accent colour inside `GameShell`; the hub's
 * band is magenta. Shared components inside the games (secondary buttons, such
 * as the game-over sign-up button and the drill's share button) read
 * `useColors()`, so they take the hub's tint.
 */
export default function PlayLayout() {
  return (
    <CornerThemeProvider corner="play">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
