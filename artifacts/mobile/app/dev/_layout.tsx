import { Stack } from 'expo-router';

/** Internal developer routes — not linked from Investor MVP tabs. */
export default function DevLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="cqv/index" />
      <Stack.Screen name="cqv/[lessonId]" />
    </Stack>
  );
}
