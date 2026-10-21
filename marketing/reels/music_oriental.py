#!/usr/bin/env python3
"""Levantine groove for the Iqraa reels — original, synthesised, no third-party licence.

A second music direction next to `music_upbeat.py` (118 BPM electronic pop). Same interface, so a reel picks it with
`music="oriental"`.

  * 98 BPM, tonic D, **Hijaz** (D Eb F# G A Bb C D) — the colour most people hear as "Levantine";
  * **maqsum** on a synthesised darbuka (dum . tek . dum . tek, with ghost "ka"s) and a riq playing 16ths;
  * an oud-style plucked melody: a two-bar question and answer that repeat, with grace-note ornaments, joined by a
    qanun-style octave from the fifth bar;
  * a soft string drone on D + A, moving to G for one bar of four;
  * accents on the picture: a riq roll into every scene cut and a hard "tak" on it; `dings` are qanun notes climbing the
    Hijaz scale; the end card gets a riq crescendo, dum + tek, and a final D strum.

Deterministic (fixed seed). numpy only.

    python3 music_oriental.py out/bed_oriental.wav 21.0 --hits 3.0,6.2 --end 17.4
"""
import sys
import wave

import numpy as np

from music_upbeat import SR, add, fft_filter, midi

BPM = 98
E = 60 / BPM / 2                 # one eighth note
BAR = 8 * E
rng = np.random.default_rng(23)

HIJAZ = [62, 63, 66, 67, 69, 70, 72, 74]     # D4 .. D5
# (eighth, midi, length in eighths, grace-note semitone offset or 0)
PHRASE_Q = [(0, 69, 2, 0), (2, 70, 1, 0), (3, 69, 1, 0), (4, 67, 2, 2), (6, 66, 1, 0), (7, 67, 1, 0),
            (8, 69, 3, 0), (11, 67, 1, 0), (12, 66, 2, 1), (14, 63, 1, 0), (15, 62, 1, 0)]
PHRASE_A = [(0, 74, 2, 0), (2, 72, 1, 0), (3, 70, 1, 0), (4, 69, 2, 1), (6, 70, 1, 0), (7, 69, 1, 0),
            (8, 67, 3, 2), (11, 66, 1, 0), (12, 67, 2, 0), (14, 66, 1, 0), (15, 62, 1, 0)]


def dum():
    n = int(SR * .3); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(70 + 75 * np.exp(-t * 32)) / SR
    return (np.sin(ph) * np.exp(-t * 9) + .12 * np.sin(2 * ph) * np.exp(-t * 25)) * 1.0


def tek(gain=1.0):
    n = int(SR * .09); t = np.arange(n) / SR
    noise = fft_filter(rng.standard_normal(n), lo=2200, hi=9000) * np.exp(-t * 70)
    ring = np.sin(2 * np.pi * 820 * t) * np.exp(-t * 55) * .5
    return (noise * .9 + ring) * gain


def ka():
    return tek(.45)[: int(SR * .06)]


def riq(accent=False):
    n = int(SR * .09); t = np.arange(n) / SR
    x = np.diff(rng.standard_normal(n + 1)) * np.exp(-t * 55)
    for f, a in ((5200, .5), (6900, .4), (8300, .3)):
        x += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t * 38)
    return x * (1.0 if accent else .55)


def oud(freq, dur, bright=1.0):
    n = int(SR * (dur + .35)); t = np.arange(n) / SR
    amps = (1.0, .62, .42, .26, .16, .1)
    w = np.zeros(n)
    for k, a in enumerate(amps, 1):
        w += a * np.sin(2 * np.pi * freq * k * t * (1 - .003 * np.exp(-t * 20))) * np.exp(-t * (3.2 + k * 2.8 / bright))
    pick = fft_filter(rng.standard_normal(n), lo=1200, hi=6000) * np.exp(-t * 180) * .35
    return (w + pick) * np.minimum(t / .002, 1)


def qanun(freq):
    n = int(SR * .9); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * freq * t) + .55 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 3)
         + .3 * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t * 6) + .12 * np.sin(2 * np.pi * freq * 5.02 * t) * np.exp(-t * 14))
    return w * np.minimum(t / .001, 1) * np.exp(-t * 3.4)


def drone(freqs, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-.004, 0, .004):
            ff = f * (1 + det)
            out += sum(np.sin(2 * np.pi * ff * k * t + rng.uniform(0, 6.28)) / k for k in (1, 2, 3, 4))
    out = fft_filter(out, hi=1500) / (len(freqs) * 3)
    env = np.minimum(t / .5, 1) * np.minimum((dur - t) / .7, 1)
    vib = 1 + .04 * np.sin(2 * np.pi * 5.2 * t)
    return out * env * vib


def roll(dur):
    """Riq roll: 32nd-note jingles with a crescendo."""
    n = int(SR * dur); out = np.zeros(n)
    steps = max(4, int(dur / (E / 4)))
    for i in range(steps):
        x = riq(i % 4 == 0)
        a = int(i * (E / 4) * SR)
        g = (i / steps) ** 1.4 * 1.1
        out[a:a + len(x)] += x[: max(0, min(len(x), n - a))] * g if a < n else 0
    return out


def render(path, total, hits=(), end=None, dings=()):
    n = int(SR * (total + 1))
    buf = np.zeros((2, n))
    side = np.ones(n)
    bars = int((total + 1) / BAR) + 1
    for b in range(bars):
        at = b * BAR
        full = b >= 1
        # drone: D + A, G + A in the third bar of each four
        base = (55, 57) if b % 4 == 2 else (50, 57)
        add(buf, drone([midi(x) for x in base], BAR + .4), at, .5 if full else .65)
        # riq on 16ths
        for s in range(16):
            add(buf, riq(s % 4 == 0), at + s * E / 2, .20 if full else .12, pan=.35 if s % 2 else -.1)
        # maqsum: D T . T D . T . ; ghost ka before the second dum and at the end
        pat = {0: "D", 1: "T", 3: "T", 4: "D", 6: "T"}
        if full:
            for e8, k in pat.items():
                tb = at + e8 * E
                if k == "D":
                    add(buf, dum(), tb, .95)
                    i = int(tb * SR); m = int(SR * .35)
                    if i < n:
                        side[i:i + m] = np.minimum(side[i:i + m], 1 - .45 * np.exp(-np.arange(min(m, n - i)) / SR * 7))
                else:
                    add(buf, tek(), tb, .55, pan=.1)
            add(buf, ka(), at + 3.5 * E, .38, pan=-.15)
            add(buf, ka(), at + 7.5 * E, .38, pan=-.15)
            add(buf, ka(), at + 5.5 * E, .30, pan=.15)
    # melody: bar 0 is the intro; question/answer from bar 2
    for ph in range(bars // 2 + 1):
        base_t = ph * 2 * BAR
        if base_t < BAR * 2:
            continue
        phrase = PHRASE_Q if ((ph - 1) % 2 == 0) else PHRASE_A
        for e8, note, ln, gr in phrase:
            tt = base_t + e8 * E
            if gr:
                add(buf, oud(midi(note + gr), .1), tt - .075, .30, pan=-.25)
            add(buf, oud(midi(note), ln * E * .9), tt, .62, pan=-.25)
            if ph >= 3:                                   # qanun octave from the fifth bar on
                add(buf, qanun(midi(note + 12)), tt + .012, .17, pan=.35)
    buf *= (0.8 + 0.2 * side)
    # picture accents
    for h in hits:
        add(buf, roll(.30), h - .30, .55, pan=.1)
        add(buf, tek(1.0), h, .9, pan=-.1)
        add(buf, dum(), h, .55)
    for k, d in enumerate(dings):
        add(buf, qanun(midi(HIJAZ[k % 8] + 12)), d, .5, pan=.2)
    if end:
        add(buf, roll(min(1.6, end)), end - 1.6, .5)
        add(buf, dum(), end, 1.0); add(buf, tek(1.0), end, .8)
        for j, nn in enumerate((50, 57, 62, 66)):                 # final D strum
            add(buf, oud(midi(nn), 1.2), end + j * .035, .45, pan=-.1)
    buf = np.tanh(buf * 1.15)
    rms = np.sqrt(np.mean(buf[:, : int(SR * total)] ** 2))
    buf *= (10 ** (-17.0 / 20)) / max(rms, 1e-6)
    buf = np.clip(buf, -.97, .97)
    pk = float(np.abs(buf).max())
    if pk > .5:                                            # keep peaks at -6 dBFS so the AAC encode never clips
        buf *= .5 / pk
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((buf.T * 32767).astype("<i2").tobytes())


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
