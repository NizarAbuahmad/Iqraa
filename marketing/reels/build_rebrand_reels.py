#!/usr/bin/env python3
"""Reels 2 and 5, re-recorded against the regenerated «تركيب الاقترانات» sheet and re-branded.

Brand: the app's own palette and the official vector lockup (make_brand.mjs, from
artifacts/mobile/constants/brandMark.ts) in place of the old raster logo on a navy glow.
  Reel 2  "paper" ground (Paper #F6F5F1, ink headlines, primary teal), teal-tile lockup end card.
  Reel 5  "teal" ground (deep teal to midnight), white lockup end card.

Styles differ from the first cut: Reel 2 is a section-by-section tour of one sheet (a light, editorial walk),
Reel 5 is a quiz show — question, 3-2-1, then the key's own three lines of working lit one at a time.

Footage: capture/takes/r2n_library.mp4 and r5n_quiz.mp4 (the new sheet: 4 items, a worked example, a half-solved
example, a key with working). What is deliberately kept off screen, all on the same sheet:
  * item 2 (a multiple-choice stem where Arabic «و» reads as a "9" beside Latin maths — and 9 is the answer),
  * key row 3, whose «(f∘g)(2) = f(g(2))» draws mirrored in the app,
  * item 4 («a_n = 3n − 1»: an arithmetic sequence on a function-composition sheet — off topic for the lesson).
The key is a `bank` key; nothing here says or implies «verified».

    node make_brand.mjs ; node render_overlays.js ; python3 build_rebrand_reels.py 2 5
"""
import sys

from reel_lib import build


def drift(c, dur, z=0.04):
    x, y, w, h = c
    return [(0, c), (dur, (x + w * z / 2, y + h * z / 2, w * (1 - z), h * (1 - z)))]


def starts(scenes):
    t, out = 0.0, []
    for s in scenes:
        out.append(t)
        t += s["dur"]
    return out + [t]


def reel2():
    T = "r2n_library"
    sc = [
        dict(src=1.4, rate=1.0, dur=2.8, cam=[(0, (0, 640, 390, 204)), (1.5, (0, 640, 390, 204)), (2.8, (0, 70, 390, 330))]),   # tap «المكتبة», page opens
        dict(src=5.0, rate=1.0, dur=3.0, cam=[(0, (0, 230, 390, 500))]),                     # search the lesson
        dict(src=8.9, rate=1.0, dur=2.8, cam=[(0, (0, 578, 390, 212))]),                     # result row, tap «افتح»
        dict(src=13.3, rate=1.0, dur=3.4, cam=[(0, (0, 100, 390, 205))]),                    # scroll to «مثال محلول»
        dict(src=20.2, rate=1.0, dur=2.9, cam=[(0, (0, 100, 390, 290))]),                    # «مثال نكمله»
        dict(src=24.9, rate=1.0, dur=2.9, cam=[(0, (0, 100, 390, 215))]),                    # «أ) تمارين تمهيدية (سهل)», item 1 only
        dict(src=30.0, rate=1.0, dur=3.0, cam=[(0, (0, 110, 390, 278))]),                    # key rows 1-2 (row 3 stays off)
    ]
    t = starts(sc)
    names = ["n2_hook", "n2_find", "n2_open", "n2_worked", "n2_half", "n2_levels", "n2_key"]
    ov = [dict(png=n, on=t[i], off=t[i + 1], kind="head", first=(i == 0)) for i, n in enumerate(names)]
    ov.append(dict(png="chip_n2", on=t[3], off=t[6], kind="chip", y=290 + 124 + 16))
    return dict(name="reel2n", take=T, theme="paper", end="end_n2", out="Iqrra_02_Library.mp4", end_dur=3.6,
                music="upbeat", scenes=sc, overlays=ov)


def reel5():
    Q = (0, 280, 390, 198)                    # «أ) تمارين تمهيدية (سهل)» + item 1: f(x) = x² − 1, find f(3)
    K = (15, 361, 360, 97)                   # key row 2: «8» and its three lines
    sc = [
        dict(src=4.0, rate=0.0, dur=3.2, cam=drift(Q, 3.2)),                                 # the question
        dict(src=4.0, rate=0.0, dur=3.5, cam=drift(Q, 3.5, 0.0)),                            # think: 3-2-1
        dict(src=14.6, rate=0.0, dur=8.4, cam=[(0, K)], take="r5n_quiz", pointer=False,      # the key, line by line
             boxes=[dict(rect=(35, 365.5, 290, 24), on=0.4, off=3.9),
                    dict(rect=(35, 389.5, 290, 21), on=3.9, off=5.4),
                    dict(rect=(35, 410.5, 290, 21), on=5.4, off=6.9),
                    dict(rect=(35, 431.5, 290, 21), on=6.9, off=8.4)]),
        dict(take="r2n_library", src=10.0, rate=0.0, dur=3.0, cam=drift((0, 585, 390, 135), 3.0), pointer=False),   # where it lives
    ]
    for s in sc[:2]:
        s["pointer"] = False
    t = starts(sc)
    ov = [
        dict(png="n5_hook", on=0.0, off=t[1], kind="head", first=True),
        dict(png="chip_n5", on=0.0, off=t[1], kind="chip", y=290 + 224 + 16, first=True),
        dict(png="n5_think", on=t[1], off=t[2], kind="head"),
        dict(png="cd3", on=t[1] + 0.2, off=t[1] + 1.3, kind="at", cx=510, cy=650),
        dict(png="cd2", on=t[1] + 1.3, off=t[1] + 2.4, kind="at", cx=510, cy=650),
        dict(png="cd1", on=t[1] + 2.4, off=t[1] + 3.5, kind="at", cx=510, cy=650),
        dict(png="n5_reveal", on=t[2], off=t[2] + 3.9, kind="head"),
        dict(png="n5_steps", on=t[2] + 3.9, off=t[3], kind="head"),
        dict(png="n5_lib", on=t[3], off=t[4], kind="head"),
    ]
    # a rising ding on each countdown number and a bright one on the reveal, then one per key line
    dings = [t[1] + 0.2, t[1] + 1.3, t[1] + 2.4, t[2] + 0.4, t[2] + 3.9, t[2] + 5.4, t[2] + 6.9]
    return dict(name="reel5n", take="r5n_quiz", theme="teal", end="end_n5", out="Iqrra_05_Quiz.mp4", end_dur=3.6,
                music="upbeat", dings=dings, scenes=sc, overlays=ov, rings=[dict(on=t[1] + 0.2, off=t[2] - 0.05, cx=510, cy=650, r=82)])


REELS = {"2": reel2, "5": reel5}

if __name__ == "__main__":
    for n in (sys.argv[1:] or REELS):
        build(REELS[n]())
