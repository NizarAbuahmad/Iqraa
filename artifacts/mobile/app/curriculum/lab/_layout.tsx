import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/lab takes the Lab's hue (constants/corners.ts). */
export default function LabLayout() {
  return (
    <CornerThemeProvider corner="lab">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
