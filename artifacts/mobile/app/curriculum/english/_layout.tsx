import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/english takes the English corner's hue (constants/corners.ts). */
export default function EnglishCornerLayout() {
  return (
    <CornerThemeProvider corner="english">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
