#!/usr/bin/env python3
"""Reel 5 — «سؤال الحصة» (quiz and reveal), 1080x1920, ~22.7s.

A different rhythm from Reels 1-4 (a question, a countdown, a reveal) for the same product moment:
a library worksheet comes with its answer key. Footage: capture/takes/r5_quiz.mp4 (the worksheet
«تركيب الاقترانات»: a multiple-choice question, then its key) and r2_library.mp4 (the library result
card, for the closing «where it lives» beat).

The question is item 2 of the sheet: f(x) = x² − 1, find f(3), options 8 / 9 / 2 / −1, key 8 (3² − 1 = 8;
9 is the classic slip of forgetting the −1). It is item 2 on purpose: the sheet numbers questions per
section but its key globally, and only in the first section do the two agree.

The library's keys are `bank` keys (computed together with the question), not proved by the verifier —
so nothing in this reel says or implies «verified».

    node capture/r5_record.cjs ; node render_overlays.js ; python3 build_reel5.py
"""
from reel_lib import build

Q = (15, 255, 360, 220)           # the question card
cfg = dict(
    name="reel5", take="r5_quiz", end="end5", out="Iqrra_05_Quiz.mp4", end_dur=3.6,
    scenes=[
        # hook: the question, a slow push
        dict(src=5.0, rate=0.0, dur=3.2, cam=[(0, Q), (3.2, (15, 262, 360, 204))]),
        # think: same frame, the countdown runs
        dict(src=5.0, rate=0.0, dur=3.5, cam=[(0, (15, 262, 360, 204)), (3.5, (15, 262, 360, 204))]),
        # reveal: option 8 lights up
        dict(src=5.0, rate=0.0, dur=4.0, cam=[(0, (15, 262, 360, 204)), (4.0, (15, 262, 360, 204))],
             boxes=[dict(rect=(22, 326, 346, 25), on=0.25, off=4.0)]),
        # the key: scroll down to «مفتاح الإجابات», row 2 lights up
        dict(src=11.4, rate=1.2, dur=5.8, cam=[(0, (0, 150, 390, 330)), (5.8, (0, 150, 390, 330))],
             boxes=[dict(rect=(22, 269, 346, 26), on=3.6, off=5.8)]),
        # where it lives: the library result card (from the Reel 2 take)
        dict(take="r2_library", src=10.0, rate=0.0, dur=3.0, cam=[(0, (0, 560, 390, 175)), (3.0, (0, 566, 390, 165))]),
    ],
    overlays=[
        dict(png="r5_hook", on=0.0, off=3.2, kind="head", first=True),
        dict(png="chip_r2", on=0.0, off=3.2, kind="chip", y=290 + 224 + 16, first=True),
        dict(png="r5_think", on=3.2, off=6.7, kind="head"),
        dict(png="cd3", on=3.4, off=4.5, kind="at", cx=510, cy=650),
        dict(png="cd2", on=4.5, off=5.6, kind="at", cx=510, cy=650),
        dict(png="cd1", on=5.6, off=6.7, kind="at", cx=510, cy=650),
        dict(png="r5_reveal", on=6.7, off=10.7, kind="head"),
        dict(png="formula", on=7.05, off=10.7, kind="chip", y=290 + 124 + 18),
        dict(png="r5_key", on=10.7, off=16.5, kind="head"),
        dict(png="chip_r2", on=10.7, off=16.5, kind="chip", y=290 + 224 + 16),
        dict(png="r5_lib", on=16.5, off=19.5, kind="head"),
        dict(png="chip_r2", on=16.5, off=19.5, kind="chip", y=290 + 224 + 16),
    ],
    rings=[dict(on=3.4, off=6.8, cx=510, cy=650, r=82)],
)

if __name__ == "__main__":
    build(cfg)
