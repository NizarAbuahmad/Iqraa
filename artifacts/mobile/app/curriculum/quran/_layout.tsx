import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/quran takes the Quran corner's hue (constants/corners.ts). */
export default function QuranCornerLayout() {
  return (
    <CornerThemeProvider corner="quran">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
