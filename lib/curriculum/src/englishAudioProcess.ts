/**
 * How an English-hub recording is cleaned before it is stored, as constants and
 * pure functions: the generator (`scripts/generate-english-audio.ts`) applies them
 * and the audit (`scripts/audit-english-audio.ts`) measures with the same rules, so
 * "trimmed" and "levelled" mean one thing. The parts that run `ffmpeg` live next
 * to the scripts (`scripts/audioFfmpeg.ts`); nothing here does I/O.
 *
 * Why (audit of the bucket, 2026-10-24): the model's MP3s carried a median 0.69 s
 * of silence after the word (up to 2 s; 14 of 32 minutes were silence), up to 1.1 s
 * before it, were 128 kbps for a single spoken word, and their speech level spread
 * from −37.8 to −21.6 dBFS — so one card whispered and the next shouted.
 */

// ─── Trim ─────────────────────────────────────────────────────────────────

/** A 10 ms frame whose RMS is above this is speech; below it is silence. */
export const TRIM_THRESHOLD_DB = -45;
/** Silence kept before the first speech frame, so a soft onset ("h", "f") is not clipped. */
export const LEAD_KEEP_S = 0.06;
/** Silence kept after the last speech frame, so a release ("t", "s") rings out. */
export const TAIL_KEEP_S = 0.15;
/** The analysis frame. */
export const FRAME_S = 0.01;
/**
 * Where to cut is decided this far ABOVE `TRIM_THRESHOLD_DB` (at the output level),
 * so the cut never hangs on a frame sitting right at the threshold. The encoder moves
 * a faint frame by about a decibel; without the margin a −44 dBFS click 0.1 s before
 * the word was kept by the cut, dropped to −46 by the encoder, and left 0.14–0.2 s of
 * measured silence in front of the word (16 of 1,049 live clips). Frames between the
 * two levels inside the kept margins stay; only ones beyond them go, and those sit at
 * least 19 dB under the speech level.
 */
export const TRIM_DECISION_MARGIN_DB = 1.5;

// ─── Level ────────────────────────────────────────────────────────────────

/** Target speech level: the RMS over the speech span (first to last speech frame), in dBFS. */
export const TARGET_MEAN_DB = -24;
/** No sample may end up above this after the gain. */
export const PEAK_CEILING_DB = -1.5;
/** Never move a clip by more than this either way: a clip that needs more is a bad take, not a quiet one. */
export const MAX_GAIN_DB = 12;

// ─── Encode ───────────────────────────────────────────────────────────────

/** Speech needs about this; the model returns 128 kbps. */
export const MP3_BITRATE = '40k';
export const SAMPLE_RATE = 24000;
export const CHANNELS = 1;

/**
 * Bump when the trim, level or encode changes, so `--reprocess` redoes every clip
 * made under the old rules (the manifest records the version each clip was made with).
 */
export const PROCESS_VERSION = 1;

// ─── Verdict ──────────────────────────────────────────────────────────────

/** A peak below this is a blank take (`tie` came back as 0.36 s at −90 dBFS). */
export const BLANK_MAX_DB = -40;
/** Less speech than this is not a word: a click, a breath. */
export const MIN_SPEECH_S = 0.15;
/** More speech than this is not one word or one sentence: the model rambled or repeated. */
export const MAX_SPEECH_S = 6;

export interface ClipStats {
  /** Whole clip. */
  durationS: number;
  /** First speech frame to last, inclusive. 0 when no frame is speech. */
  speechS: number;
  /** Silence before the first speech frame (the whole clip when there is none). */
  leadS: number;
  /** Silence after the last speech frame (the whole clip when there is none). */
  trailS: number;
  /** RMS over the speech span in dBFS (over the whole clip when there is no speech). −120 for digital silence. */
  meanDb: number;
  /** Sample peak in dBFS. −120 for digital silence. */
  maxDb: number;
}

export type ClipVerdict = { ok: true } | { ok: false; reason: 'blank' | 'too-short' | 'too-long' };

/**
 * Whether a raw model result may be stored. Judged on the RAW clip, before trimming:
 * blank (peak below −40 dBFS, or no speech frame at all), too short (under 0.15 s
 * of speech) or too long (over 6 s of speech). There is deliberately no "mostly
 * silent" rule: raw clips legitimately carry up to 2 s of silence after a 0.5 s word.
 */
export function clipVerdict(stats: ClipStats): ClipVerdict {
  if (stats.maxDb < BLANK_MAX_DB || stats.speechS === 0) return { ok: false, reason: 'blank' };
  if (stats.speechS < MIN_SPEECH_S) return { ok: false, reason: 'too-short' };
  if (stats.speechS > MAX_SPEECH_S) return { ok: false, reason: 'too-long' };
  return { ok: true };
}

/**
 * The gain, in dB, that brings a clip's speech level to `TARGET_MEAN_DB`: clamped to
 * ±`MAX_GAIN_DB`, and lowered whenever it would push the peak above `PEAK_CEILING_DB`.
 * Rounded to 0.01 dB so the ffmpeg argument is stable.
 */
export function gainDb(meanDb: number, maxDb: number): number {
  let g = TARGET_MEAN_DB - meanDb;
  g = Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, g));
  if (maxDb + g > PEAK_CEILING_DB) g = PEAK_CEILING_DB - maxDb;
  return Math.round(g * 100) / 100;
}

/**
 * The gain for a clip, measured the way the result will be measured. Raising a clip
 * lifts its soft edges ("f", "th", a fading vowel) above the speech threshold, so the
 * speech span of the RESULT is longer and its mean lower than the raw clip's: one
 * `gainDb` from the raw stats landed a median 0.5 dB under target and 21 of 1,049
 * live clips more than 1.5 dB under. So the span is re-measured at the threshold the
 * gain implies and the gain recomputed, a few times (it settles in two or three).
 */
export function levelGain(samples: Int16Array | Float32Array, sampleRate = SAMPLE_RATE): number {
  const raw = statsFromSamples(samples, sampleRate);
  let gain = gainDb(raw.meanDb, raw.maxDb);
  for (let i = 0; i < 3; i += 1) {
    const s = statsFromSamples(samples, sampleRate, TRIM_THRESHOLD_DB - gain);
    gain = gainDb(s.meanDb, s.maxDb);
  }
  return gain;
}

/** RMS of `x[from, to)` in dBFS, floored at −120. */
function rmsDb(x: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += x[i] * x[i];
  const n = to - from;
  if (n <= 0 || sum === 0) return -120;
  return Math.max(-120, 10 * Math.log10(sum / n));
}

function toFloat(samples: Int16Array | Float32Array): Float32Array {
  if (samples instanceof Float32Array) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] / 32768;
  return out;
}

/**
 * The stats of a mono clip, from its samples (16-bit PCM or floats in [−1, 1]). The
 * method of the 2026-10-24 audit: 10 ms frames, frame RMS in dBFS, a frame is speech
 * when above `thresholdDb`; a trailing partial frame counts toward the duration only.
 */
export function statsFromSamples(
  samples: Int16Array | Float32Array,
  sampleRate = SAMPLE_RATE,
  thresholdDb = TRIM_THRESHOLD_DB,
): ClipStats {
  const x = toFloat(samples);
  const durationS = x.length / sampleRate;
  const frame = Math.round(sampleRate * FRAME_S);
  const frames = Math.floor(x.length / frame);
  let first = -1;
  let last = -1;
  for (let f = 0; f < frames; f += 1) {
    if (rmsDb(x, f * frame, (f + 1) * frame) > thresholdDb) {
      if (first < 0) first = f;
      last = f;
    }
  }
  let peak = 0;
  for (let i = 0; i < x.length; i += 1) peak = Math.max(peak, Math.abs(x[i]));
  const maxDb = peak === 0 ? -120 : Math.max(-120, 20 * Math.log10(peak));
  if (first < 0) {
    return { durationS, speechS: 0, leadS: durationS, trailS: durationS, meanDb: rmsDb(x, 0, x.length), maxDb };
  }
  const r = (s: number) => Math.round(s * 1e6) / 1e6;
  return {
    durationS,
    speechS: r((last - first + 1) * FRAME_S),
    leadS: r(first * FRAME_S),
    trailS: r(Math.max(0, durationS - (last + 1) * FRAME_S)),
    meanDb: rmsDb(x, first * frame, (last + 1) * frame),
    maxDb,
  };
}

// ─── ffmpeg arguments ─────────────────────────────────────────────────────

/** Decode anything ffmpeg reads (stdin) to raw 16-bit mono PCM at `SAMPLE_RATE` (stdout). */
export function ffmpegDecodeArgs(): string[] {
  return ['-hide_banner', '-v', 'error', '-i', 'pipe:0', '-f', 's16le', '-ac', String(CHANNELS), '-ar', String(SAMPLE_RATE), 'pipe:1'];
}

/** The part of a clip to keep, in samples at `SAMPLE_RATE`: `[start, end)`. */
export interface TrimWindow {
  start: number;
  end: number;
}

/**
 * The threshold, on the RAW clip, at which to decide the cut for a clip about to be
 * moved by `gain` dB: `TRIM_THRESHOLD_DB + TRIM_DECISION_MARGIN_DB` at the output
 * level. Silence is judged at the level the listener will hear: a quiet clip raised by
 * 8 dB keeps what becomes audible, a loud one lowered by 2 dB is not cut tighter.
 */
export function trimDecisionThresholdDb(gain: number): number {
  return TRIM_THRESHOLD_DB + TRIM_DECISION_MARGIN_DB - gain;
}

/**
 * What to keep of a clip whose stats were measured at `trimDecisionThresholdDb`:
 * `LEAD_KEEP_S` before the first speech frame and `TAIL_KEEP_S` after the last.
 * A clip with no speech is kept whole (it is rejected before it gets here).
 */
export function trimWindow(stats: ClipStats, sampleRate = SAMPLE_RATE): TrimWindow {
  const total = Math.round(stats.durationS * sampleRate);
  if (stats.speechS === 0) return { start: 0, end: total };
  const startS = Math.max(0, stats.leadS - LEAD_KEEP_S);
  const endS = Math.min(stats.durationS, stats.durationS - stats.trailS + TAIL_KEEP_S);
  return { start: Math.round(startS * sampleRate), end: Math.min(total, Math.round(endS * sampleRate)) };
}

/**
 * The `-af` step that cuts a clip to `w`, sample-exact.
 *
 * Ruling (2026-10-24, measured on the 1,050 live clips): not `silenceremove`.
 * `silenceremove=…:detection=rms:window=0.01` (forward, `areverse`, again,
 * `areverse`, after the gain) judges silence on a sliding window, so it disagrees with
 * the 10 ms frames the audit measures: on 23 of 1,049 clips it left 0.13–0.28 s of leading
 * silence or up to 0.43 s of trailing silence, because a faint bump straddling two
 * frames read as speech to it and as silence to the audit. The cut is therefore
 * computed from the same frames the audit uses (`statsFromSamples` → `trimWindow`)
 * and applied with `atrim`.
 */
export function ffmpegTrimFilter(w: TrimWindow): string {
  return `atrim=start_sample=${w.start}:end_sample=${w.end},asetpts=PTS-STARTPTS`;
}

/**
 * Raw PCM (as `ffmpegDecodeArgs` writes it) on stdin → cut to `w` → the gain → a
 * `MP3_BITRATE` mono MP3 at `output`, in one pass. `gain` is in dB, from `levelGain`
 * on the raw samples (trimming removes only silence, so the speech level and the
 * peak are the same before and after it).
 *
 * `output` should be a seekable FILE, not `pipe:1`: ffmpeg writes the LAME/Xing
 * header (encoder delay and padding, which players use to drop the encoder's
 * priming) only by seeking back at the end. Through a pipe the header is missing
 * and every clip starts with 1,105 samples (46 ms) of extra silence — measured.
 */
export function ffmpegEncodeArgs(gain: number, w: TrimWindow, output: string): string[] {
  return [
    '-hide_banner', '-v', 'error', '-y',
    '-f', 's16le', '-ac', String(CHANNELS), '-ar', String(SAMPLE_RATE), '-i', 'pipe:0',
    '-af', `${ffmpegTrimFilter(w)},volume=${gain.toFixed(2)}dB`,
    '-c:a', 'libmp3lame', '-b:a', MP3_BITRATE, '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS),
    '-f', 'mp3', output,
  ];
}
