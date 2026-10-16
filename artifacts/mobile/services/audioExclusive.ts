/**
 * "One audio at a time". Each module that plays sound registers a `stop` under
 * a name; starting any of them calls `claim(name)`, which runs every OTHER
 * module's stop. `englishAudio.ts` (a word, or a student's own recording)
 * registers as 'word', `quranAudio.ts` as 'quran' — so a listen button cannot
 * talk over a flashcard, without the two files importing each other.
 *
 * No `react-native` / `expo-*` import, so `node --test` can load it.
 */
export interface AudioExclusive {
  register(owner: string, stop: () => void): void;
  claim(owner: string): void;
}

export function createAudioExclusive(): AudioExclusive {
  const stops = new Map<string, () => void>();
  return {
    register(owner, stop) {
      stops.set(owner, stop);
    },
    claim(owner) {
      for (const [name, stop] of stops) {
        if (name === owner) continue;
        try {
          stop();
        } catch {
          // A player that is already gone is already silent.
        }
      }
    },
  };
}

const shared = createAudioExclusive();
export const registerAudioStop = shared.register;
export const claimAudio = shared.claim;
