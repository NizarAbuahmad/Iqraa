/**
 * The `ffmpeg` half of `src/englishAudioProcess.ts`: decode, trim, level and
 * re-encode one English-hub clip. Used by `generate-english-audio.ts` and
 * `audit-english-audio.ts`; needs `ffmpeg` on PATH. Tests never load this file.
 *
 * Input goes in on stdin and decoded PCM comes back on stdout. The encoded MP3 is
 * the one exception: it is written to a file in the OS temp directory (never the
 * repo) and removed straight after, because ffmpeg writes the MP3's gapless header
 * only to a seekable output (see `ffmpegEncodeArgs`).
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  ffmpegDecodeArgs,
  ffmpegEncodeArgs,
  levelGain,
  statsFromSamples,
  trimDecisionThresholdDb,
  trimWindow,
  type ClipStats,
} from '../src/englishAudioProcess.ts';

/** Throws a message a person can act on when `ffmpeg` (with libmp3lame) is not on PATH. */
export function assertFfmpeg(): void {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    throw new Error(
      'ffmpeg is not on PATH. Install it (Windows: `winget install Gyan.FFmpeg`; macOS: ' +
        '`brew install ffmpeg`; Debian/Ubuntu: `apt install ffmpeg`) and open a new shell.',
    );
  }
  if (!r.stdout.includes('libmp3lame')) throw new Error('this ffmpeg has no libmp3lame encoder; install a full build.');
}

/** Runs ffmpeg with `input` on stdin and returns stdout. Rejects with stderr on a non-zero exit. */
function run(args: string[], input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on('data', (b: Buffer) => out.push(b));
    p.stderr.on('data', (b: Buffer) => err.push(b));
    p.on('error', reject);
    p.on('close', code => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString('utf8').trim().slice(0, 300)}`));
    });
    // A clip ffmpeg rejects early closes stdin under us; the exit code reports it.
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}

function pcm(buf: Buffer): Int16Array {
  // Copy: a Buffer's byteOffset need not be 2-aligned.
  const copy = new Uint8Array(buf.length - (buf.length % 2));
  copy.set(buf.subarray(0, copy.length));
  return new Int16Array(copy.buffer);
}

/** Decodes any clip ffmpeg reads to 24 kHz mono 16-bit PCM. */
export async function decodeClip(buf: Buffer): Promise<Int16Array> {
  return pcm(await run(ffmpegDecodeArgs(), buf));
}

/** The stats of an encoded clip (MP3 or anything ffmpeg reads). `thresholdDb` defaults to the trim threshold. */
export async function measureClip(buf: Buffer, thresholdDb?: number): Promise<ClipStats> {
  return statsFromSamples(await decodeClip(buf), undefined, thresholdDb);
}

export interface ProcessedClip {
  out: Buffer;
  before: ClipStats;
  after: ClipStats;
  /** The gain applied, in dB. */
  gain: number;
}

/**
 * Level, trim and re-encode one clip: decode → the gain (`levelGain`) → the cut,
 * decided at the output level (`trimDecisionThresholdDb` → `trimWindow`) →
 * cut, gain and encode at `MP3_BITRATE` in one ffmpeg pass. `before` is the raw
 * clip, `after` the encoded result decoded again. The caller runs `clipVerdict` on
 * the raw stats first (via `measureClip`) and never processes a reject.
 */
export async function processClip(buf: Buffer): Promise<ProcessedClip> {
  const raw = await run(ffmpegDecodeArgs(), buf);
  const samples = pcm(raw);
  const before = statsFromSamples(samples);
  const gain = levelGain(samples);
  const window = trimWindow(statsFromSamples(samples, undefined, trimDecisionThresholdDb(gain)));
  const dir = await mkdtemp(path.join(tmpdir(), 'english-audio-'));
  try {
    const file = path.join(dir, 'clip.mp3');
    await run(ffmpegEncodeArgs(gain, window, file), raw);
    const out = await readFile(file);
    const after = await measureClip(out);
    return { out, before, after, gain };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
