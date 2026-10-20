#!/usr/bin/env python3
"""Bright, building "learning" music for the Iqraa videos — original, synthesised, no third-party licence.

The third direction next to `music_upbeat.py` (118 BPM electronic pop) and `music_oriental.py` (Hijaz groove). Same
interface, so a reel picks it with `music="inspire"`. Made for long educational pieces: it has a *form*, so a four-minute
video does not sit on one loop —

  * 124 BPM, G major, I–V–vi–IV (G D Em C); piano, pizzicato, bell and a warm pad instead of club synths;
  * sections that raise and drop the energy:  intro (piano arp + pad)  ->  verse (soft kick, shaker, bass, pizzicato)
    ->  build (claps, 16th hats, snare roll, riser)  ->  CHORUS (four-on-the-floor, octave bass, piano chords, bell
    melody, crash)  ->  breakdown (pad + piano only)  ->  build  ->  chorus ... ;
  * pieces whose end card comes before ~30 s (ads, reels) use a short form: two bars of verse, chorus, a two-bar build;
  * the last four bars before the end card are always a build and the end card always lands on a chorus, with a crash;
  * accents on the picture: a short whoosh into every scene cut and a soft pop on it (`hits=[...]`, seconds).

Deterministic (fixed seed). numpy only.

    python3 music_inspire.py out/bed_inspire.wav 60 --hits 6,12,20 --end 52
"""
import sys
import wave

import numpy as np

import music_upbeat as mu
from music_upbeat import SR, add, fft_filter, midi

BPM = 124
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
rng = np.random.default_rng(31)

CHORDS = [  # (bass root, triad, upper voicing for the piano)
    (43, [55, 59, 62], [67, 71, 74]),   # G
    (50, [54, 57, 62], [66, 69, 74]),   # D
    (52, [55, 59, 64], [67, 71, 76]),   # Em
    (48, [55, 60, 64], [67, 72, 76]),   # C
]
# G major pentatonic hook, two bars (step in 16ths, midi, length in 16ths); answered an octave-step higher on the next two
HOOK_Q = [(0, 79, 3), (4, 83, 2), (6, 86, 2), (8, 83, 4), (14, 81, 2)]
HOOK_A = [(0, 79, 3), (4, 81, 2), (6, 83, 2), (8, 86, 4), (14, 88, 2)]
HOOK_LOW = [(0, 67, 2), (3, 71, 1), (4, 74, 2), (7, 71, 1), (8, 69, 2), (11, 71, 1), (12, 74, 3)]

# section name, length in bars. After the first pass the form loops from "verse".
FORM_FIRST = [("intro", 4), ("verse", 12), ("build", 4), ("chorus", 16), ("break", 8), ("build", 4), ("chorus", 16)]
FORM_LOOP = [("verse", 8), ("build", 4), ("chorus", 16), ("break", 8), ("build", 4), ("chorus", 16)]


def piano(freq, dur=.7, soft=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    w = np.zeros(n)
    for k, a in enumerate((1.0, .55, .32, .2, .12, .07), 1):
        w += a * np.sin(2 * np.pi * freq * k * t * (1 + .00012 * k * k)) * np.exp(-t * (2.4 + k * 2.2) / soft)
    hammer = fft_filter(rng.standard_normal(n), lo=900, hi=5000) * np.exp(-t * 90) * .18
    return (w + hammer) * np.minimum(t / .002, 1)


def pizz(freq, dur=.28):
    n = int(SR * dur); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * freq * t) + .45 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 20)
         + .25 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 34))
    return w * np.minimum(t / .001, 1) * np.exp(-t * 15)


def bell(freq, dur=.9):
    n = int(SR * dur); t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * freq * t) + .5 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 9)
         + .3 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t * 16))
    return w * np.minimum(t / .0015, 1) * np.exp(-t * 4.2)


def pad(freqs, dur, level=1.0):
    n = int(SR * dur); t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-.006, -.002, .002, .006):
            ff = f * (1 + det)
            out += sum(np.sin(2 * np.pi * ff * k * t + rng.uniform(0, 6.28)) / k for k in (1, 2, 3))
    out = fft_filter(out, hi=2600) / (len(freqs) * 4)
    env = np.minimum(t / .45, 1) * np.minimum((dur - t) / .6, 1)
    return out * env * level


def sub(freq, dur):
    n = int(SR * dur); t = np.arange(n) / SR
    w = np.sin(2 * np.pi * freq * t) + .35 * np.sin(2 * np.pi * freq * 2 * t) + .12 * np.sin(2 * np.pi * freq * 3 * t)
    return w * np.minimum(t / .005, 1) * np.minimum((dur - t) / .02, 1) * np.exp(-t * 2.2)


def snare():
    n = int(SR * .2); t = np.arange(n) / SR
    noise = fft_filter(rng.standard_normal(n), lo=1500, hi=9000) * np.exp(-t * 22)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28) * .5
    return noise * .8 + tone


def shaker():
    n = int(SR * .06); t = np.arange(n) / SR
    return fft_filter(rng.standard_normal(n), lo=5500) * np.exp(-t * 60) * np.minimum(t / .006, 1)


def crash(dur=1.8):
    n = int(SR * dur); t = np.arange(n) / SR
    return fft_filter(rng.standard_normal(n), lo=3500) * np.exp(-t * 2.6)


def section_map(bars, end_bar):
    """One section name per bar. The last four bars before the end card are a build; the end card lands on a chorus."""
    if end_bar is not None and end_bar < 30:             # short form (ads, reels): on the beat at once, chorus early
        seq = ["verse"] * 2 + ["chorus"] * max(0, end_bar - 4) + ["build"] * 2
        return (seq + ["chorus"] * (bars + 1))[: bars + 1]
    seq = []
    for name, ln in FORM_FIRST:
        seq += [name] * ln
    while len(seq) < bars + 40:
        for name, ln in FORM_LOOP:
            seq += [name] * ln
    seq = seq[: bars + 1]
    if end_bar is not None:
        for b in range(max(0, end_bar - 4), min(len(seq), end_bar)):
            seq[b] = "build"
        for b in range(end_bar, len(seq)):
            seq[b] = "chorus"
        if end_bar >= 8:                                 # a breather before the closing build, so it reads as a lift
            for b in range(end_bar - 8, end_bar - 4):
                seq[b] = "break"
    return seq


def render(path, total, hits=(), end=None, dings=()):
    n = int(SR * (total + 2))
    buf = np.zeros((2, n))
    side = np.ones(n)
    bars = int((total + 2) / BAR) + 1
    end_bar = int(round(end / BAR)) if end else None
    secs = section_map(bars, end_bar)
    for b in range(bars):
        at = b * BAR
        sec = secs[b]
        prev = secs[b - 1] if b else None
        root, tri, up = CHORDS[b % 4]
        chorus, build, brk, verse, intro = sec == "chorus", sec == "build", sec == "break", sec == "verse", sec == "intro"
        # warm pad under everything, loudest in the breakdown and chorus
        add(buf, pad([midi(x) for x in tri], BAR + .5, 1.0), at, {"intro": .55, "verse": .40, "build": .45, "chorus": .50, "break": .75}[sec])
        # piano: arpeggio in the intro / breakdown, off-beat chords in the verse, driving chords in the chorus
        if intro or brk:
            for s in range(8):
                add(buf, piano(midi(up[(0, 1, 2, 1)[s % 4]] - (12 if s % 8 >= 4 else 0)), .8, 1.2), at + s * BEAT / 2, .36, pan=-.15)
        elif verse:
            for off in (1.5, 3.5):
                add(buf, piano(midi(up[0] - 12), .35), at + off * BEAT, .24, pan=-.2)
                add(buf, piano(midi(up[1] - 12), .35), at + off * BEAT, .20, pan=-.2)
                add(buf, piano(midi(up[2] - 12), .35), at + off * BEAT, .20, pan=-.2)
        elif chorus or build:
            for s, off in enumerate((0, 1.5, 2, 3.5)):
                for v in up:
                    add(buf, piano(midi(v - 12), .5), at + off * BEAT, .22 if chorus else .17, pan=-.2)
        # drums
        kick_on = {"intro": [], "verse": [0, 2], "build": [0, 1, 2, 3], "chorus": [0, 1, 2, 3], "break": []}[sec]
        for beat in range(4):
            tb = at + beat * BEAT
            if beat in kick_on:
                mu.add(buf, mu.kick(), tb, .85 if chorus or build else .6)
                i = int(tb * SR); m = int(SR * .2)
                if i < n:
                    side[i:i + m] = np.minimum(side[i:i + m], 1 - (.5 if chorus else .3) * np.exp(-np.arange(min(m, n - i)) / SR * 11))
            if (chorus or build) and beat in (1, 3):
                add(buf, mu.clap(), tb, .55 if chorus else .40, pan=.1)
            # shaker / hats
            if not intro and not brk:
                add(buf, shaker(), tb, .12, pan=-.25)
                add(buf, shaker(), tb + BEAT / 2, .16, pan=.25)
                if chorus or build:
                    add(buf, shaker(), tb + BEAT / 4, .08, pan=-.3)
                    add(buf, shaker(), tb + 3 * BEAT / 4, .08, pan=.3)
            if chorus and beat in (0, 2):
                add(buf, mu.hat(True), tb + BEAT / 2, .12, pan=.3)
        # bass: long root notes in the verse, off-beat octave pumping in the chorus
        if verse:
            for off in (0, 2):
                add(buf, sub(midi(root - 12 + 12), BEAT * 1.9), at + off * BEAT, .42)
        elif chorus or build:
            for s, o in enumerate((0, 12, 0, 12, 0, 12, 7, 12)):
                add(buf, mu.bass(midi(root + o), BEAT / 2 * .9), at + s * BEAT / 2, .42 * (1 if s % 2 == 0 else .8))
        # pizzicato strings answer in the verse and build
        if verse or build:
            for s, st in enumerate((2, 6, 10, 14)):
                add(buf, pizz(midi(tri[(s + b) % 3] + 12)), at + st * S16, .24 if verse else .26, pan=.4 if s % 2 else -.4)
        # build: snare roll in the last bar of the build, tightening to 16ths
        if build:
            if secs[min(b + 1, len(secs) - 1)] != "build":
                for k in range(16):
                    add(buf, snare(), at + k * S16, .12 + .35 * (k / 15), pan=0)
        # crash on the first bar of a chorus, and a soft one on a breakdown
        if (chorus and prev != "chorus") or (brk and prev != "break"):
            add(buf, crash(), at, .45 if chorus else .22, pan=.2)
        # sparkle arp in the chorus
        if chorus:
            for s in range(16):
                add(buf, mu.spark(midi(tri[(0, 1, 2, 1)[s % 4]] + 24)), at + s * S16, .06 * (1 if s % 2 == 0 else .6), pan=.5 if s % 2 else -.5)
    # melody: marimba / pizz motif in the verse, bell hook in the chorus (question / answer), a held bell in the build
    for b in range(0, bars, 2):
        sec = secs[b]
        base = b * BAR
        if sec == "verse":
            for step, note, ln in HOOK_LOW:
                add(buf, mu.marimba(midi(note), ln * S16 * 1.6 + .1), base + step * S16, .22, pan=.2)
        elif sec == "chorus":
            hook = HOOK_Q if (b // 2) % 2 == 0 else HOOK_A
            for step, note, ln in hook:
                add(buf, bell(midi(note), ln * S16 * 1.5 + .3), base + step * S16, .27, pan=.2)
                add(buf, mu.marimba(midi(note - 12), ln * S16 * 1.5 + .1), base + step * S16, .13, pan=-.15)
        elif sec == "build":
            add(buf, bell(midi(86), 1.6), base, .18, pan=.2)
    buf *= (0.8 + 0.2 * side)
    # energy per section, so the form is heard as loud and quiet and not only as more instruments: smoothed bar gains,
    # a build ramps up into the chorus
    level = {"intro": .50, "verse": .62, "build": .80, "chorus": 1.0, "break": .50}
    g = np.zeros(n)
    for b in range(bars):
        a, z = int(b * BAR * SR), min(n, int((b + 1) * BAR * SR))
        if a >= n:
            break
        v = level[secs[b]]
        if secs[b] == "build":                                      # ramp across the build
            run = 0
            while b - run - 1 >= 0 and secs[b - run - 1] == "build":
                run += 1
            v = .72 + .26 * (run + 1) / 4
        g[a:z] = v
    k = int(SR * .25)
    g = np.convolve(np.pad(g, (k, k), mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="valid")[:n]
    buf *= g
    # picture accents
    for h in hits:
        add(buf, mu.whoosh(), h - .30, .50, pan=-.2)
        add(buf, mu.pop(), h, .38, pan=.15)
    for k, d in enumerate(dings):
        add(buf, mu.ding(midi(79 + (0, 2, 4, 7, 9, 12)[k % 6])), d, .45, pan=.1)
    if end:
        add(buf, mu.riser(min(1.6, end)), end - 1.6, .55)
        add(buf, mu.kick(), end, 1.0); add(buf, mu.clap(), end, .6); add(buf, crash(2.2), end, .5, pan=.1)
        for j, nn in enumerate((55, 59, 62, 67)):        # a held G chord under the end card
            add(buf, piano(midi(nn), 1.8, 1.4), end + j * .03, .35, pan=-.1)
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
