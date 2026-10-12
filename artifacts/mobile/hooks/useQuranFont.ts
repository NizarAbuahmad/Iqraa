/**
 * The Quran Corner's script — the King Fahd Complex's own font, unmodified —
 * loaded by the screens that draw Quran text rather than at app start, so a
 * 300 KB font is not on the cold-start path of everyone who never opens the
 * corner. A bundled asset (a static require), so it ships over the air: no
 * native module, no app.json version bump. `expo-font` caches by name, so the
 * reader and the memorise page share one load. A failed load counts as ready:
 * the text then draws in the system font with gaps, which is better than a
 * screen that never opens.
 */
import { useFonts } from 'expo-font';

export function useQuranFont(): boolean {
  const [loaded, error] = useFonts({
    UthmanicHafs: require('../assets/fonts/UthmanicHafs-v-3.0.ttf'),
  });
  return loaded || error != null;
}
