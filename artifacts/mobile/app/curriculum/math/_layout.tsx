import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/math takes the Math Corner's hue (constants/corners.ts). */
export default function MathCornerLayout() {
  return (
    <CornerThemeProvider corner="math">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
