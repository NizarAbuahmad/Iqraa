#!/usr/bin/env python3
"""Original light background bed for the Iqraa reels (no third-party licence involved).

~100 BPM, C major, I-vi-IV-V. Soft pad + plucked arpeggio + sine bass + very light pulse,
with a short synthetic room. Deterministic (fixed seed) so rebuilds are identical.

    python make_music.py out/bed.wav 24.5
"""
import sys
import wave
import numpy as np

SR = 44100
BPM = 100
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a, d, s, r_start=None):
    t = np.arange(n) / SR
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-t / d)
    return e * s


def pluck(freq, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    w = (np.sin(2 * np.pi * freq * t) + .35 * np.sin(4 * np.pi * freq * t) * np.exp(-t * 9)
         + .12 * np.sin(6 * np.pi * freq * t) * np.exp(-t * 14))
    return w * env(n, .004, .22, 1.0)


def pad(freqs, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-.0035, 0, .0035):
            out += np.sin(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6.28))
    a = np.minimum(t / .6, 1) * np.minimum((dur - t) / .8, 1)
    return out * a / (len(freqs) * 3)


def add(buf, x, at):
    i = int(at * SR)
    j = min(len(buf), i + len(x))
    if i < len(buf):
        buf[i:j] += x[:j - i]


def build(total):
    n = int(SR * (total + 2))
    L = np.zeros(n); R = np.zeros(n)
    chords = [(48, [60, 64, 67]), (45, [57, 60, 64]), (53, [60, 65, 69]), (55, [59, 62, 67])]
    arp_idx = [0, 1, 2, 1, 2, 1, 0, 1]
    bar = 4 * BEAT
    for k in range(int((total + 2) / bar) + 1):
        root, tri = chords[k % 4]
        at = k * bar
        p = pad([midi(x) for x in tri] + [midi(root + 12)], bar + .4) * .55
        add(L, p, at); add(R, p, at)
        b = np.sin(2 * np.pi * midi(root) * np.arange(int(SR * bar)) / SR) * env(int(SR * bar), .02, 1.3, .5)
        add(L, b, at); add(R, b, at)
        for s in range(8):
            note = tri[arp_idx[s] % 3] + (12 if s in (3, 5) else 0)
            x = pluck(midi(note), .9) * .30
            pan = .35 if s % 2 else -.35
            add(L, x * (1 - pan) * .6, at + s * BEAT / 2)
            add(R, x * (1 + pan) * .6, at + s * BEAT / 2)
        for beat in range(4):  # soft pulse, kick on 1 and 3
            if beat % 2 == 0:
                m = int(SR * .18); t = np.arange(m) / SR
                kick = np.sin(2 * np.pi * (55 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 16) * .35
                add(L, kick, at + beat * BEAT); add(R, kick, at + beat * BEAT)
            m = int(SR * .05)
            hat = rng.standard_normal(m) * np.exp(-np.arange(m) / SR * 90) * .035
            add(L, hat, at + beat * BEAT + BEAT / 2); add(R, hat, at + beat * BEAT + BEAT / 2)
    # room: exponentially decaying noise impulse response, different per channel
    def reverb(x, seed):
        g = np.random.default_rng(seed)
        m = int(SR * 1.4)
        ir = g.standard_normal(m) * np.exp(-np.arange(m) / SR * 3.2)
        ir[0] = 0
        wet = np.fft.irfft(np.fft.rfft(x, len(x) + m) * np.fft.rfft(ir, len(x) + m))[:len(x)]
        return x + .22 * wet / np.abs(wet).max() * np.abs(x).max()
    L, R = reverb(L, 1), reverb(R, 2)
    N = int(SR * total)
    L, R = L[:N], R[:N]
    t = np.arange(N) / SR
    fade = np.minimum(t / .25, 1) * np.minimum((total - t) / 1.6, 1)
    L, R = L * fade, R * fade
    peak = max(np.abs(L).max(), np.abs(R).max())
    g = 0.5 / peak  # about -6 dBFS peak; mixed down further in the final build
    return np.stack([L * g, R * g], 1)


if __name__ == '__main__':
    out, total = sys.argv[1], float(sys.argv[2])
    x = build(total)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('wrote', out, x.shape[0] / SR, 's')
