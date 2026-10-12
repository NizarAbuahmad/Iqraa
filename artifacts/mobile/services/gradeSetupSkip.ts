/**
 * Whether this account chose «تخطي» on the class picker (`/setup-grade`).
 *
 * On the device, per account — see `gradeSetupSkipKey` in routeGating.ts for
 * why, and for why the key is built there. No server column: a skipped picker
 * is a preference about this phone's first run, and a schema change for it
 * would not be worth a migration. The cost is that the same account on a
 * second device is asked once more.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gradeSetupSkipKey } from '@/services/routeGating';

export async function hasSkippedGradeSetup(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(gradeSetupSkipKey(userId))) === '1';
  } catch {
    return false; // a broken store asks again; it never hides the picker
  }
}

export async function markGradeSetupSkipped(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(gradeSetupSkipKey(userId), '1');
  } catch {
    // best-effort; worst case the picker shows again next boot
  }
}
