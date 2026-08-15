/**
 * Whether this install has seen the product-intro onboarding carousel.
 *
 * Global, not per-user — the carousel explains what Iqraa is before a
 * teacher ever signs in, so scoping it to a signed-in user (the way
 * lessonContext.ts's "onboarded" flag is scoped) would never fire. That
 * flag is a different concept anyway: has this teacher picked a lesson,
 * not has this device seen the intro.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const INTRO_SEEN_KEY = '@iqra_intro_seen_v1';

export async function hasSeenAppIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === '1';
  } catch {
    return true; // fail closed: never trap a teacher behind a broken store
  }
}

export async function markAppIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // best-effort; worst case the carousel shows again next boot
  }
}
