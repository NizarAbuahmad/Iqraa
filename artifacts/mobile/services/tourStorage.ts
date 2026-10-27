/**
 * Device-local flags for the first-run tour. The keys are built in `tour.ts`
 * (the file `node --test` can load); this is only the AsyncStorage I/O, in the
 * shape of `appIntro.ts` and `gradeSetupSkip.ts`.
 *
 * Both reads fail CLOSED: a broken store reads as "done" / "suppressed", so a
 * device that cannot remember never nags. The worst a failed write does is show
 * the tour once more on a later launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOUR_OFF_KEY, tourDoneKey } from './tour.ts';

export async function hasDoneTour(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(tourDoneKey(userId))) === '1';
  } catch {
    return true;
  }
}

export async function markTourDone(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(tourDoneKey(userId), '1');
  } catch {
    // best-effort; see above
  }
}

/** The device-wide switch the e2e sets (`@iqra_tour_off_v1` = '1'). */
export async function isTourSuppressed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TOUR_OFF_KEY)) === '1';
  } catch {
    return true;
  }
}
