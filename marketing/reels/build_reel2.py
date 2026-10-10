#!/usr/bin/env python3
"""Reel 2 — «Find a resource for your next lesson» (1080x1920, ~22.7s).

Footage: capture/takes/r2_library.mp4 — one continuous take in a fictional teacher's demo account:
home -> المكتبة tab -> search «تركيب الاقترانات» (the lesson shown in the app's own lesson bar) -> one
worksheet -> open it -> scroll to the answer key and the textbook figures. Nothing is staged: the search
returns what the library really holds for that lesson.

    node capture/r2_record.cjs        # records the take (needs the local app running; see capture/README)
    node render_overlays.js && python3 build_reel2.py
"""
from reel_lib import build

FULL = (0, 0, 390, 844)
cfg = dict(
    name="reel2", take="r2_library", end="end2", out="Iqrra_02_Library.mp4",
    scenes=[
        # hook: the finished resource — the answer key scrolls into the textbook figures, then holds
        dict(src=30.2, src_end=34.0, rate=0.62, dur=3.0, cam=[(0, (0, 255, 390, 430)), (3.0, (0, 262, 390, 420))]),
        # open the library: whole phone for the tap, then in on the المكتبة header
        dict(src=1.6, rate=1.0, dur=3.0,
             cam=[(0, FULL), (1.35, FULL), (2.25, (0, 0, 390, 520)), (3.0, (0, 0, 390, 520))]),
        # discovery: the search field while typing, then down to the one result
        dict(src=5.0, rate=1.0, dur=5.2,
             cam=[(0, (0, 215, 390, 270)), (3.1, (0, 215, 390, 270)), (3.9, (0, 470, 390, 270)), (5.2, (0, 470, 390, 270))]),
        # preview: tap «افتح», the worksheet opens, scroll into the questions
        dict(src=10.2, rate=1.0, dur=7.8,
             cam=[(0, (0, 470, 390, 270)), (0.9, (0, 470, 390, 270)), (1.8, (0, 0, 390, 380)), (7.8, (0, 0, 390, 380))]),
    ],
    overlays=[
        dict(png="r2_hook", on=0.0, off=3.0, kind="head", first=True),
        dict(png="r2_intro", on=3.0, off=6.0, kind="head"),
        dict(png="r2_find", on=6.0, off=11.2, kind="head"),
        dict(png="r2_open", on=11.2, off=19.0, kind="head"),
        dict(png="chip_r2", on=11.2, off=19.0, kind="chip", y=290 + 224 + 14),
    ],
)

if __name__ == "__main__":
    build(cfg)
