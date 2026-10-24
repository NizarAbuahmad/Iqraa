import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FRAME_S,
  LEAD_KEEP_S,
  MAX_GAIN_DB,
  MP3_BITRATE,
  PEAK_CEILING_DB,
  PROCESS_VERSION,
  SAMPLE_RATE,
  TAIL_KEEP_S,
  TARGET_MEAN_DB,
  TRIM_DECISION_MARGIN_DB,
  TRIM_THRESHOLD_DB,
  clipVerdict,
  processedVerdict,
  ffmpegDecodeArgs,
  ffmpegEncodeArgs,
  ffmpegTrimFilter,
  gainDb,
  levelGain,
  statsFromSamples,
  trimDecisionThresholdDb,
  trimWindow,
  type ClipStats,
} from '../englishAudioProcess.ts';

const SR = SAMPLE_RATE;

/** `silence` s of zeros, `tone` s of a 440 Hz sine at `rmsDb`, `after` s of zeros. */
function clip(silence: number, tone: number, after: number, rmsDb = -23): Float32Array {
  const amp = Math.SQRT2 * 10 ** (rmsDb / 20);
  const a = Math.round(silence * SR);
  const b = Math.round(tone * SR);
  const out = new Float32Array(a + b + Math.round(after * SR));
  for (let i = 0; i < b; i += 1) out[a + i] = amp * Math.sin((2 * Math.PI * 440 * i) / SR);
  return out;
}

const close = (actual: number, expected: number, tol: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} not within ${tol} of ${expected}`);

describe('the agreed numbers', () => {
  it('are the ones the brief and the audit were measured with', () => {
    assert.equal(TRIM_THRESHOLD_DB, -45);
    assert.equal(LEAD_KEEP_S, 0.06);
    assert.equal(TAIL_KEEP_S, 0.15);
    assert.equal(TARGET_MEAN_DB, -24);
    assert.equal(PEAK_CEILING_DB, -1.5);
    assert.equal(MAX_GAIN_DB, 12);
    assert.equal(MP3_BITRATE, '40k');
    assert.equal(SAMPLE_RATE, 24000);
    assert.equal(PROCESS_VERSION, 1);
  });
});

describe('gainDb', () => {
  it('brings the speech level to the target', () => {
    assert.equal(gainDb(-30, -15), 6);
    assert.equal(gainDb(-24, -10), 0);
    assert.equal(-30 + gainDb(-30, -15), TARGET_MEAN_DB);
  });

  it('is negative for a loud clip', () => {
    assert.equal(gainDb(-20, -6), -4);
  });

  it('is clamped to ±12 dB', () => {
    assert.equal(gainDb(-40, -20), MAX_GAIN_DB);
    assert.equal(gainDb(-8, -3), -MAX_GAIN_DB);
  });

  it('is reduced so the peak stays under the ceiling', () => {
    assert.equal(gainDb(-30, -4), 2.5);
    assert.equal(gainDb(-40, -5), 3.5, 'clamped to 12 first, then reduced');
    for (const [mean, max] of [[-30, -4], [-40, -5], [-28, -2], [-35, -1.6]]) {
      assert.ok(max + gainDb(mean, max) <= PEAK_CEILING_DB + 1e-9);
    }
  });
});

describe('processedVerdict', () => {
  const before: ClipStats = { durationS: 1.8, speechS: 0.5, leadS: 0.2, trailS: 1.1, meanDb: -29, maxDb: -14 };
  const after: ClipStats = { durationS: 0.71, speechS: 0.52, leadS: 0.06, trailS: 0.15, meanDb: -24, maxDb: -9 };
  const reject = (a: ClipStats) => {
    const v = processedVerdict(before, a);
    assert.equal(v.ok, false);
    return v.ok ? '' : (assert.equal(v.reason, 'processing'), v.detail);
  };

  it('keeps a good result, and one that lost under 0.1 s of speech', () => {
    assert.deepEqual(processedVerdict(before, after), { ok: true });
    assert.deepEqual(processedVerdict(before, { ...after, speechS: 0.41 }), { ok: true });
    assert.deepEqual(processedVerdict(before, { ...after, leadS: 0.12, trailS: 0.25, maxDb: PEAK_CEILING_DB + 0.5 }), { ok: true });
  });

  it('rejects a result that fails the raw-clip verdict', () => {
    assert.match(reject({ ...after, maxDb: -90 }), /blank/);
    assert.match(reject({ ...after, speechS: 0, leadS: 0.7, trailS: 0.7 }), /blank/);
    assert.match(reject({ ...after, speechS: 0.1 }), /too-short/);
  });

  it('rejects a result that lost more than 0.1 s of speech', () => {
    assert.match(reject({ ...after, speechS: 0.39 }), /speech 0\.50 s → 0\.39 s/);
  });

  it('rejects a result that kept too much silence before or after', () => {
    assert.match(reject({ ...after, leadS: 0.13 }), /before the speech/);
    assert.match(reject({ ...after, trailS: 0.26 }), /after the speech/);
  });

  it('rejects a result that peaks over the ceiling by more than 0.5 dB', () => {
    assert.match(reject({ ...after, maxDb: PEAK_CEILING_DB + 0.6 }), /peak/);
  });
});

describe('clipVerdict', () => {
  const ok: ClipStats = { durationS: 1.8, speechS: 0.5, leadS: 0.2, trailS: 1.1, meanDb: -29, maxDb: -14 };
  it('keeps a normal word, even with 2 s of silence after it (no "mostly silent" rule)', () => {
    assert.deepEqual(clipVerdict(ok), { ok: true });
    assert.deepEqual(clipVerdict({ ...ok, durationS: 2.7, trailS: 2.0 }), { ok: true });
  });
  it('rejects a blank take: a low peak, or no speech frame', () => {
    assert.deepEqual(clipVerdict({ ...ok, maxDb: -90 }), { ok: false, reason: 'blank' });
    assert.deepEqual(clipVerdict({ ...ok, speechS: 0 }), { ok: false, reason: 'blank' });
  });
  it('rejects too little and too much speech', () => {
    assert.deepEqual(clipVerdict({ ...ok, speechS: 0.1 }), { ok: false, reason: 'too-short' });
    assert.deepEqual(clipVerdict({ ...ok, speechS: 6.5 }), { ok: false, reason: 'too-long' });
    assert.deepEqual(clipVerdict({ ...ok, speechS: 0.15 }), { ok: true });
    assert.deepEqual(clipVerdict({ ...ok, speechS: 6 }), { ok: true });
  });
});

describe('statsFromSamples', () => {
  it('finds silence + tone + silence within one frame', () => {
    const s = statsFromSamples(clip(0.3, 0.5, 0.4));
    close(s.durationS, 1.2, 1e-9, 'duration');
    close(s.leadS, 0.3, FRAME_S, 'lead');
    close(s.speechS, 0.5, FRAME_S, 'speech');
    close(s.trailS, 0.4, FRAME_S, 'trail');
    close(s.meanDb, -23, 0.1, 'mean');
    close(s.maxDb, -23 + 20 * Math.log10(Math.SQRT2), 0.05, 'peak');
  });

  it('reads 16-bit PCM the same as floats', () => {
    const f = clip(0.25, 0.4, 0.35);
    const i16 = Int16Array.from(f, v => Math.round(v * 32767));
    const a = statsFromSamples(f);
    const b = statsFromSamples(i16);
    assert.equal(b.leadS, a.leadS);
    assert.equal(b.speechS, a.speechS);
    assert.equal(b.trailS, a.trailS);
    close(b.meanDb, a.meanDb, 0.01, 'mean');
  });

  it('calls a tone under the threshold silence, and digital silence −120 dBFS', () => {
    const quiet = statsFromSamples(clip(0.1, 0.5, 0.1, -50));
    assert.equal(quiet.speechS, 0);
    assert.equal(quiet.leadS, quiet.durationS);
    assert.deepEqual(clipVerdict(quiet), { ok: false, reason: 'blank' });
    const zero = statsFromSamples(new Float32Array(SR / 2));
    assert.equal(zero.maxDb, -120);
    assert.equal(zero.meanDb, -120);
    assert.deepEqual(clipVerdict(zero), { ok: false, reason: 'blank' });
    // The same −50 dBFS tone is speech at a threshold moved down by the gain it will get.
    assert.ok(statsFromSamples(clip(0.1, 0.5, 0.1, -50), SR, -55).speechS > 0.45);
  });
});

describe('trimWindow', () => {
  it('keeps 0.06 s before the speech and 0.15 s after it', () => {
    const s = statsFromSamples(clip(0.3, 0.5, 0.4));
    const w = trimWindow(s);
    close(w.start / SR, 0.3 - LEAD_KEEP_S, FRAME_S, 'start');
    close(w.end / SR, 0.8 + TAIL_KEEP_S, FRAME_S, 'end');
    assert.ok(Number.isInteger(w.start) && Number.isInteger(w.end));
  });

  it('never runs past either end of the clip', () => {
    const s = statsFromSamples(clip(0.02, 0.5, 0.05));
    assert.deepEqual(trimWindow(s), { start: 0, end: Math.round(s.durationS * SR) });
  });

  it('keeps a clip with no speech whole', () => {
    const s = statsFromSamples(new Float32Array(SR));
    assert.deepEqual(trimWindow(s), { start: 0, end: SR });
  });

  it('decides the cut at the output level, a margin above the threshold', () => {
    assert.equal(trimDecisionThresholdDb(0), TRIM_THRESHOLD_DB + TRIM_DECISION_MARGIN_DB);
    assert.equal(trimDecisionThresholdDb(8), TRIM_THRESHOLD_DB + TRIM_DECISION_MARGIN_DB - 8);
    assert.equal(trimDecisionThresholdDb(-2), TRIM_THRESHOLD_DB + TRIM_DECISION_MARGIN_DB + 2);
  });
});

describe('levelGain', () => {
  const scaled = (x: Float32Array, g: number) => Float32Array.from(x, v => v * 10 ** (g / 20));

  it('is gainDb for a clip with no soft edges', () => {
    const x = clip(0.2, 0.5, 0.3, -30);
    const g = levelGain(x);
    close(g, 6, 0.05, 'gain');
    close(statsFromSamples(scaled(x, g)).meanDb, TARGET_MEAN_DB, 0.1, 'result');
  });

  it('measures the result the way the result will be measured, soft edges included', () => {
    // A −32 dBFS word with a 0.2 s −50 dBFS tail: raised 8 dB the tail becomes speech.
    const word = clip(0.2, 0.5, 0, -32);
    const tail = clip(0, 0.2, 0.3, -50);
    const x = new Float32Array(word.length + tail.length);
    x.set(word);
    x.set(tail, word.length);
    const raw = statsFromSamples(x);
    const naive = gainDb(raw.meanDb, raw.maxDb);
    const naiveResult = statsFromSamples(scaled(x, naive)).meanDb;
    assert.ok(Math.abs(naiveResult - TARGET_MEAN_DB) > 1, `naive gain lands at ${naiveResult}`);
    const g = levelGain(x);
    close(statsFromSamples(scaled(x, g)).meanDb, TARGET_MEAN_DB, 0.2, 'result');
  });

  it('still respects the clamp and the ceiling', () => {
    assert.equal(levelGain(clip(0.1, 0.5, 0.1, -44)), MAX_GAIN_DB);
    const hot = clip(0.1, 0.5, 0.1, -30);
    hot[3000] = 0.9; // a −0.9 dBFS click
    assert.ok(statsFromSamples(scaled(hot, levelGain(hot))).maxDb <= PEAK_CEILING_DB + 0.01);
  });
});

describe('ffmpeg arguments', () => {
  it('cuts sample-exact with atrim', () => {
    assert.equal(ffmpegTrimFilter({ start: 1440, end: 22800 }), 'atrim=start_sample=1440:end_sample=22800,asetpts=PTS-STARTPTS');
  });

  it('decodes to 24 kHz mono 16-bit PCM through pipes', () => {
    const a = ffmpegDecodeArgs();
    assert.deepEqual(a.slice(a.indexOf('-i'), a.indexOf('-i') + 2), ['-i', 'pipe:0']);
    for (const pair of [['-f', 's16le'], ['-ac', '1'], ['-ar', '24000']]) {
      assert.ok(a.join(' ').includes(pair.join(' ')), pair.join(' '));
    }
    assert.equal(a.at(-1), 'pipe:1');
  });

  it('cuts, then levels, then encodes 40 kbps mono MP3 to the given file', () => {
    const a = ffmpegEncodeArgs(3.456, { start: 100, end: 2000 }, '/tmp/x/clip.mp3');
    const af = a[a.indexOf('-af') + 1];
    assert.equal(af, 'atrim=start_sample=100:end_sample=2000,asetpts=PTS-STARTPTS,volume=3.46dB');
    const s = a.join(' ');
    for (const part of ['-c:a libmp3lame', '-b:a 40k', '-ar 24000', '-ac 1', '-f mp3', '-i pipe:0', '-y']) assert.ok(s.includes(part), part);
    assert.equal(a.at(-1), '/tmp/x/clip.mp3');
    assert.match(ffmpegEncodeArgs(-2, { start: 0, end: 10 }, 'o.mp3').join(' '), /volume=-2\.00dB/);
  });
});
