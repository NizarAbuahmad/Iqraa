/**
 * What the English corner's recordings should be: one item per distinct
 * `audioSlug`, with the text to say and the register to say it in. Read by the
 * generator (`scripts/generate-english-audio.ts`), which voices what is missing,
 * and by the audit (`scripts/audit-english-audio.ts`), which counts what is there.
 * Pure: no I/O, no keys.
 *
 * Two registers. The Grade 1–4 words were first voiced on 2026-09-25 with a
 * "reading to a young child" prompt; the Grade 9–10 words with the teenage one. A
 * slug heard in any Grade 1–4 lesson — as a hub word, or as a string a Grade 1–4
 * grammar unit speaks — is young (so `--only eraser` stays in the voice of the rest
 * of its lesson); everything else is teen. Until 2026-10-24 every grammar string
 * was young ("all are Grade 1–2"), which stopped being true once Grades 5, 9 and 10
 * got grammar units: about 1,700 of their grammar strings (more as Grade 10 Semester
 * 2 lands) would have been read as if to a six-year-old. None had been voiced yet.
 */
import { ENGLISH_HUB_LESSONS, allHubWords, audioSlug, hubLesson } from './englishHub.ts';
import { GRAMMAR_UNITS, unitSpoken } from './englishGrammar.ts';

/** Object prefix in the public bucket; the app's `ENGLISH_AUDIO_BASE_URL` ends with it. */
export const ENGLISH_AUDIO_PREFIX = 'english-audio';
/** The manifest the generator keeps next to the clips (`<prefix>/_manifest.json`). */
export const ENGLISH_AUDIO_MANIFEST_KEY = `${ENGLISH_AUDIO_PREFIX}/_manifest.json`;
/**
 * Where the generator copies a stored clip, once, before it first replaces it
 * (`--reprocess`, `--force`, `--only`). A SIBLING prefix, never under
 * `english-audio/`, or the bucket listing would read the backups as clips.
 */
export const ENGLISH_AUDIO_BACKUP_PREFIX = 'english-audio-original';
/** Object metadata key (S3 `x-amz-meta-process-version`) stamped on every processed upload. */
export const PROCESS_VERSION_METADATA = 'process-version';

/** The process version an object's metadata records; 0 when it records none (or nonsense). */
export function metadataProcessVersion(metadata: Record<string, string> | undefined): number {
  const v = Number(metadata?.[PROCESS_VERSION_METADATA]);
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

export const AUDIO_MODEL = 'gpt-4o-mini-tts';
export const AUDIO_VOICE = 'coral';

/** The highest grade voiced in the young register. */
export const YOUNG_MAX_GRADE = 4;

export type Register = 'young' | 'teen';

export interface AudioItem {
  /** The object name, without prefix or `.mp3` (`audioSlug(text)`). */
  slug: string;
  /** What the model is asked to say: the first text seen for this slug. */
  text: string;
  register: Register;
  /** Where `text` was first seen: a hub word, or a string a grammar unit speaks. */
  source: 'word' | 'grammar';
  /** Every grade whose lessons or grammar units use this slug, ascending. */
  grades: number[];
}

// The books are British ("mum", "colourful", "trainers"), so the voice is too.
//
// Both end on a teacher's correction (2026-10-15): "apples" came out with its
// first sound hit hard and held apart from the rest ("A… pples"), which teaches
// a long, stressed vowel where the word has a short /æ/. "Clearly" on its own
// invites that over-articulation. A word already voiced keeps its recording
// until re-voiced with `--only`.
export const SMOOTH =
  'Say it as one smooth word, the way it sounds in ordinary speech: do not stretch, ' +
  'hit or separate the first sound or any single letter, and keep short vowels short ' +
  '(the a in "apples" is a quick, short sound).';
export const YOUNG_INSTRUCTIONS =
  'You are reading a vocabulary card to a six-year-old child learning English. ' +
  'Say only the given word or phrase, once, clearly and a little slowly, ' +
  'in a warm, friendly tone, with a British accent. ' + SMOOTH;
export const TEEN_INSTRUCTIONS =
  'You are reading a vocabulary card to a teenage student learning English. ' +
  'Say only the given word or phrase, once, clearly and at a natural, unhurried pace, ' +
  'in a warm but not childish tone, with a British accent. ' + SMOOTH;

/**
 * Words the model has said wrongly, with how to say them. Added to the
 * instructions for that word only; re-voice with `--only <word>` after adding
 * one. Checked by ear or by a phoneme recogniser, never assumed.
 */
export const PRONUNCIATION: Record<string, string> = {
  // A Grade 1 teacher flagged it (2026-10-15); the recording says /iːˈreɪsɚ/,
  // "EE-ray-ser".
  eraser:
    'Pronounce it the British way, ih-RAY-zuh (/ɪˈreɪzə/): a short "i" at the start, not "ee"; ' +
    'stress on "RAY"; a "z" sound in the middle, not "s"; no "r" sound at the end.',
};

/** The model instructions for one item: its register, plus its pronunciation hint if it has one. */
export function instructionsFor(item: Pick<AudioItem, 'text' | 'register'>): string {
  const base = item.register === 'young' ? YOUNG_INSTRUCTIONS : TEEN_INSTRUCTIONS;
  const hint = PRONUNCIATION[item.text.toLowerCase().trim()];
  return hint ? `${base} ${hint}` : base;
}

// ─── The manifest ─────────────────────────────────────────────────────────

/**
 * How one stored clip was made. `processVersion` 0 means stored as the model
 * returned it (`--no-process`); `speechS` is null then, because nothing measured it.
 */
export interface AudioManifestItem {
  text: string;
  register: Register;
  model: string;
  voice: string;
  processVersion: number;
  speechS: number | null;
  bytes: number;
}

export interface AudioManifest {
  version: 1;
  items: Record<string, AudioManifestItem>;
}

export function emptyManifest(): AudioManifest {
  return { version: 1, items: {} };
}

/**
 * Reads `_manifest.json`. Throws on anything that is not a version-1 manifest, so a
 * run never starts from a half-read file and then overwrites the real one with it.
 */
export function parseManifest(json: string): AudioManifest {
  const m = JSON.parse(json) as Partial<AudioManifest> | null;
  if (!m || m.version !== 1 || typeof m.items !== 'object' || m.items === null || Array.isArray(m.items)) {
    throw new Error('not a version-1 English audio manifest');
  }
  for (const [slug, it] of Object.entries(m.items)) {
    if (!it || typeof it.processVersion !== 'number' || typeof it.text !== 'string') {
      throw new Error(`manifest entry "${slug}" is malformed`);
    }
  }
  return m as AudioManifest;
}

/** Whether `--reprocess` should (re)process this slug: no entry yet, or one made under older rules. */
export function needsReprocess(manifest: AudioManifest, slug: string, processVersion: number): boolean {
  const it = manifest.items[slug];
  return !it || it.processVersion < processVersion;
}

/**
 * Every recording the corner needs, once per slug. Case-only twins ("Jordan" /
 * "jordan") share one; hub words come first, then grammar strings, and the first
 * text seen for a slug is the one voiced — the order the generator always used.
 * Grammar strings are keyed like words («I've got a pen.» → i-ve-got-a-pen) so
 * `playWord(text)` finds them; `englishGrammar.test.ts` pins that no two collide.
 */
export function audioPlan(): AudioItem[] {
  const young = new Set<string>();
  const grades = new Map<string, Set<number>>();
  const note = (slug: string, grade: number | undefined) => {
    if (grade === undefined) return;
    if (grade <= YOUNG_MAX_GRADE) young.add(slug);
    let g = grades.get(slug);
    if (!g) grades.set(slug, (g = new Set()));
    g.add(grade);
  };
  for (const l of ENGLISH_HUB_LESSONS) for (const w of l.words) note(audioSlug(w.en), l.grade);
  for (const u of GRAMMAR_UNITS) {
    const grade = hubLesson(u.lessonId)?.grade;
    for (const t of unitSpoken(u)) note(audioSlug(t), grade);
  }

  const items = new Map<string, AudioItem>();
  const add = (text: string, source: AudioItem['source']) => {
    const slug = audioSlug(text);
    if (items.has(slug)) return;
    items.set(slug, {
      slug,
      text,
      register: young.has(slug) ? 'young' : 'teen',
      source,
      grades: [...(grades.get(slug) ?? [])].sort((a, b) => a - b),
    });
  };
  for (const w of allHubWords()) add(w, 'word');
  for (const u of GRAMMAR_UNITS) for (const t of unitSpoken(u)) add(t, 'grammar');
  return [...items.values()];
}
