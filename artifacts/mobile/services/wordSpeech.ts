/**
 * Web-only safety net for the English hub's word audio.
 *
 * The recordings are pre-voiced into a bucket by a script that has to be re-run
 * whenever words are added (see `englishAudio.ts`). A word with no file used to
 * be silent. On the web we can do better: if the recording will not play, say
 * the word with the browser's own English voice.
 *
 * Why this is not inside `expo-audio`: its web player builds an <audio>
 * element with no `onerror` and does not await `play()`, so a 404 is invisible
 * to anything built on top of it. We drive an element ourselves instead.
 *
 * No `react-native` / `expo-*` imports, so `node --test` can load it. Native has
 * no equivalent here — it would need `expo-speech`, a native module, and with it
 * a `version` bump and a new build (see CLAUDE.md).
 */

/** The slice of `SpeechSynthesis` we use. */
export interface SpeechSynthLike {
  speak(utterance: unknown): void;
  cancel(): void;
  getVoices(): { lang: string }[];
}

/** The slice of `HTMLAudioElement` we use. */
export interface AudioLike {
  onerror: null | (() => void);
  play(): Promise<void> | void;
  pause(): void;
}

interface UtteranceLike {
  lang: string;
  voice: unknown;
}

/** The books are British ("mum", "colourful"), and so are the recordings. */
const LANG = 'en-GB';

/**
 * Says `word` with the browser's voice. Returns whether it was handed to the
 * engine — never throws, because silence is the failure it is covering for.
 */
export function speakWordAloud(
  word: string,
  synth: SpeechSynthLike | undefined = (globalThis as { speechSynthesis?: SpeechSynthLike }).speechSynthesis,
  Utterance: (new (text: string) => UtteranceLike) | undefined = (
    globalThis as { SpeechSynthesisUtterance?: new (text: string) => UtteranceLike }
  ).SpeechSynthesisUtterance,
): boolean {
  if (!synth || !Utterance) return false;
  try {
    const voices = synth.getVoices();
    const voice =
      voices.find(v => v.lang.replace('_', '-').toLowerCase() === 'en-gb') ??
      voices.find(v => v.lang.toLowerCase().startsWith('en')) ??
      null;
    const u = new Utterance(word);
    u.lang = LANG;
    u.voice = voice;
    synth.cancel(); // a second tap cuts the first off, like the recordings do
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export interface RecordingDeps {
  createAudio(url: string): AudioLike;
  speak(word: string): boolean;
  cancelSpeech(): void;
}

function browserDeps(): RecordingDeps {
  return {
    createAudio: url => new (globalThis as unknown as { Audio: new (src: string) => AudioLike }).Audio(url),
    speak: word => speakWordAloud(word),
    cancelSpeech: () => {
      try {
        (globalThis as { speechSynthesis?: SpeechSynthLike }).speechSynthesis?.cancel();
      } catch {
        /* nothing to cancel */
      }
    },
  };
}

/**
 * Plays `url`; if it errors or `play()` rejects (404, blocked, undecodable),
 * speaks `word` instead. The returned function stops both — call it before
 * starting the next word.
 *
 * Stopping is not a failure: `pause()` makes the browser reject the pending
 * `play()` with an AbortError, and that must not trigger the fallback, or
 * tapping a second word would speak the first one over it.
 */
export function playRecordingOrSpeak(url: string, word: string, deps: RecordingDeps = browserDeps()): () => void {
  let settled = false; // the fallback ran, or we were stopped
  const el = deps.createAudio(url);
  const fallBack = () => {
    if (settled) return;
    settled = true;
    deps.speak(word);
  };
  el.onerror = fallBack;
  try {
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(fallBack);
  } catch {
    fallBack();
  }
  return () => {
    settled = true;
    try {
      el.pause();
    } catch {
      /* already gone */
    }
    deps.cancelSpeech();
  };
}
