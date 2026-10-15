#!/usr/bin/env python3
"""Upbeat, rhythmic music for the Iqraa reels — original, synthesised, no third-party licence.

Why this exists: `make_music.py` (the first bed) is a slow ambient loop — soft pad, gentle plucks, 100 BPM.
Fine as wallpaper, but it does not push a short reel forward. This one has a groove:

  * 118 BPM, C major, I-V-vi-IV; four-on-the-floor kick, claps on 2 and 4, off-beat open hats;
  * a bouncing octave bass that ducks under every kick (side-chain), so the beat breathes;
  * bright plucked chord stabs on the off-beats and a marimba-style hook that repeats every two bars;
  * a 16th-note sparkle arp that joins from the second four bars, a filter-free riser into the end card;
  * "interactive" accents on the picture: a short rising whoosh into every scene cut and a soft pop on it
    (`hits=[...]`, seconds), so the sound follows what the viewer sees instead of running underneath it;
  `dings=[...]` adds a rising-scale "ding" per event (a correct answer, a tap) — one note higher each time.

Deterministic (fixed seed) so rebuilds are identical. numpy only.

    python3 music_upbeat.py out/bed_upbeat.wav 21.0 --hits 3.0,8.8,14.7 --end 17.5
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 118
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(11)

CHORDS = [  # (bass root, triad as midi)
    (48, [60, 64, 67]),   # C
    (43, [59, 62, 67]),   # G (b5 inversion keeps the stabs in one register)
    (45, [57, 60, 64]),   # Am
    (41, [57, 60, 65]),   # F
]
HOOK = [  # (step in 16ths within a 2-bar phrase, midi note, length in 16ths) — C major pentatonic, bouncy
    (0, 79, 2), (3, 76, 1), (4, 79, 2), (7, 84, 1), (8, 83, 2), (11, 79, 1), (12, 76, 3),
    (16, 74, 2), (19, 76, 1), (20, 79, 2), (23, 76, 1), (24, 74, 2), (27, 72, 1), (28, 72, 4),
]


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(buf, x, at, gain=1.0, pan=0.0):
    """Mix mono x into stereo buf (2, n) at `at` seconds. pan -1 (left) .. 1 (right)."""
    i = int(at * SR)
    if i >= buf.shape[1] or i + len(x) <= 0:
        return
    j = min(buf.shape[1], i + len(x))
    seg = x[: j - i] * gain
    buf[0, i:j] += seg * (1 - max(pan, 0))
    buf[1, i:j] += seg * (1 + min(pan, 0))


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def kick():
    n = int(SR * .26); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(46 + 110 * np.exp(-t * 28)) / SR
    return (np.sin(ph) * np.exp(-t * 11) + .25 * np.sin(2 * ph) * np.exp(-t * 30)) * 1.0


def clap():
    n = int(SR * .22)
    noise = fft_filter(rng.standard_normal(n), lo=900, hi=7000)
    t = np.arange(n) / SR
    burst = sum(np.exp(-np.maximum(t - d, 0) * 40) * (t >= d) for d in (0, .011, .022))
    return noise * (burst * .35 + np.exp(-t * 16) * .55)


def hat(open_=False):
    n = int(SR * (.22 if open_ else .05))
    x = np.diff(rng.standard_normal(n + 1))
    return x * np.exp(-np.arange(n) / SR * (14 if open_ else 80))


def bass(freq, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    w = sum(np.sin(2 * np.pi * freq * k * t) / k for k in (1, 2, 3, 4))
    w = fft_filter(w, hi=900)
    return w * np.minimum(t / .004, 1) * np.exp(-t * 5.5)


def stab(freqs, dur=.17):
    n = int(SR * dur); t = np.arange(n) / SR
    w = np.zeros(n)
    for f in freqs:
        w += np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(2 * np.pi * f * 2 * t) * .3
    w = fft_filter(w, hi=4200) / len(freqs)
    return w * np.minimum(t / .003, 1) * np.exp(-t * 20)


def marimba(freq, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * freq * t) + .5 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 28)
         + .2 * np.sin(2 * np.pi * freq * 10 * t) * np.exp(-t * 60))
    return w * np.minimum(t / .002, 1) * np.exp(-t * 9)


def spark(freq):
    n = int(SR * .12); t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.minimum(t / .002, 1) * np.exp(-t * 26)


def whoosh(dur=.32):
    n = int(SR * dur); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    # band-pass sweep: rising centre frequency
    out = np.zeros(n); k = 8
    for s in range(k):
        a, b = int(n * s / k), int(n * (s + 1) / k)
        c = 500 * (2 ** (s * 5.5 / k))
        out[a:b] = fft_filter(x[a:b], lo=c * .6, hi=c * 1.6) if b - a > 64 else 0
    return out * (t / dur) ** 2 * np.minimum((dur - t) / .02, 1) * 1.6


def pop():
    n = int(SR * .12); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(520 - 380 * t / .12) / SR
    return np.sin(ph) * np.exp(-t * 34)


def riser(dur):
    n = int(SR * dur); t = np.arange(n) / SR
    x = fft_filter(rng.standard_normal(n), lo=1800)
    return x * (t / dur) ** 2.2 * .5


def ding(freq):
    n = int(SR * .5); t = np.arange(n) / SR
    w = np.sin(2 * np.pi * freq * t) + .35 * np.sin(2 * np.pi * freq * 2.01 * t) * np.exp(-t * 12) + .15 * np.sin(2 * np.pi * freq * 3.99 * t) * np.exp(-t * 20)
    return w * np.minimum(t / .002, 1) * np.exp(-t * 7)


def render(path, total, hits=(), end=None, dings=()):
    """total: file length in seconds. hits: seconds of scene cuts. end: when the end card starts (riser lands there)."""
    n = int(SR * (total + 1))
    buf = np.zeros((2, n))
    side = np.ones(n)                                    # side-chain gain for bass / stabs / hook
    bars = int((total + 1) / BAR) + 1
    for b in range(bars):
        at = b * BAR
        root, tri = CHORDS[b % 4]
        full = b >= 1                                    # bar 0 is the intro: hats + hook, no kick
        for beat in range(4):
            tb = at + beat * BEAT
            if full:
                add(buf, kick(), tb, .95)
                i = int(tb * SR); m = int(SR * .22)
                if i < n:
                    side[i:i + m] = np.minimum(side[i:i + m], 1 - .62 * np.exp(-np.arange(min(m, n - i)) / SR * 11))
            if beat in (1, 3) and full:
                add(buf, clap(), tb, .55, pan=.1)
            add(buf, hat(), tb, .20 if full else .10, pan=-.2)
            add(buf, hat(), tb + BEAT / 2, .16 if full else .08, pan=.25)
            if full and beat == 3:
                add(buf, hat(True), tb + BEAT / 2, .17, pan=.3)
        # bouncing bass: root, octave, root, octave on the off-beats
        if full:
            for s, o in enumerate((0, 12, 0, 12, 0, 12, 7, 12)):
                add(buf, bass(midi(root + o), BEAT / 2 * .95), at + s * BEAT / 2, .50 * (1 if s % 2 == 0 else .8))
            # chord stabs on the off-beat of 2 and the "a" of 4 (syncopated)
            for off in (1.5, 3.5, 2.75):
                add(buf, stab([midi(x) for x in tri]), at + off * BEAT, .28, pan=-.15)
        # sparkle arp from the second 4-bar phrase
        if b >= 5:
            for s in range(16):
                note = tri[(0, 1, 2, 1)[s % 4]] + 24
                add(buf, spark(midi(note)), at + s * BEAT / 4, .10 * (1 if s % 2 == 0 else .6), pan=.45 if s % 2 else -.45)
    # hook: every two bars from bar 0
    for ph in range((bars // 2) + 1):
        base = ph * 2 * BAR
        for step, note, ln in HOOK:
            add(buf, marimba(midi(note), ln * BEAT / 4 * 1.6 + .1), base + step * BEAT / 4, .30, pan=.2)
    # apply side-chain to everything except kick/clap/hat? approximate: duck the sum lightly, kick stays loud
    # (kick is mixed before ducking, so duck only the tonal bed by recomputing it separately would be cleaner;
    #  a gentle global duck of 25% keeps the groove pumping without losing the kick)
    buf *= (0.75 + 0.25 * side)
    # picture accents: whoosh into every cut, pop on it
    for h in hits:
        add(buf, whoosh(), h - .30, .55, pan=-.2)
        add(buf, pop(), h, .42, pan=.15)
    for k, d in enumerate(dings):                        # a rising scale: one note per correct answer / event
        add(buf, ding(midi(72 + (0, 2, 4, 5, 7, 9, 11, 12)[k % 8])), d, .5, pan=.1)
    if end:
        add(buf, riser(min(1.6, end)), end - 1.6, .6)
        add(buf, kick(), end, 1.0); add(buf, clap(), end, .6)
    # master: soft clip, normalise to a lively but not loud mean
    buf = np.tanh(buf * 1.2)
    rms = np.sqrt(np.mean(buf[:, : int(SR * total)] ** 2))
    buf *= (10 ** (-17.0 / 20)) / max(rms, 1e-6)
    buf = np.clip(buf, -.97, .97)
    pcm = (buf.T * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    args = sys.argv[1:]
    out, total = args[0], float(args[1])
    hits, end = [], None
    for i, a in enumerate(args):
        if a == "--hits":
            hits = [float(x) for x in args[i + 1].split(",") if x]
        if a == "--end":
            end = float(args[i + 1])
    render(out, total, hits, end)
    print("wrote", out)
