#!/usr/bin/env python3
"""Reel 3 — «Your classes in one place» (1080x1920, ~24s).

Footage: capture/takes/r3_classes.mp4 — one take in a fictional teacher's demo account that already has two
classes. On camera: the overview, «شعبة جديدة», the name typed, الكيمياء switched off so only الرياضيات is
chosen, «أنشئ الشعبة», the add-students sheet (first names only), back to the overview — now three classes —
and the new class opened. The take's dead time is sped up; every screen shown is a real one.

    node capture/r3_record.cjs ; node render_overlays.js ; python3 build_reel3.py
"""
from reel_lib import build

cfg = dict(
    name="reel3", take="r3_classes", end="end3", out="Iqrra_03_Classes.mp4", end_dur=3.6,
    scenes=[
        # hook: the classes overview, a slow push
        dict(src=0.3, src_end=1.6, rate=0.4, dur=3.2, cam=[(0, (0, 0, 390, 420)), (3.2, (0, 10, 390, 400))]),
        # value: in on the class cards, pointer passing over them
        dict(src=1.6, rate=0.8, dur=2.6, cam=[(0, (0, 90, 390, 260)), (2.6, (0, 100, 390, 240))]),
        # action: «شعبة جديدة» -> name -> الكيمياء off -> «أنشئ الشعبة»
        dict(src=3.7, src_end=11.35, rate=1.3, dur=5.85,
             cam=[(0, (0, 0, 390, 844)), (1.0, (0, 0, 390, 844)), (1.8, (0, 250, 390, 330)), (5.85, (0, 250, 390, 330))]),
        # result 1: the new class opens, empty
        dict(src=11.35, rate=2.0, dur=0.95, cam=[(0, (0, 0, 390, 520)), (0.95, (0, 0, 390, 520))]),
        # result 2: add its students — just names
        dict(src=13.2, rate=2.0, dur=2.35, cam=[(0, (0, 160, 390, 500)), (2.35, (0, 160, 390, 500))]),
        # result 3: students in, back to the overview — three classes now
        dict(src=18.0, rate=1.5, dur=2.6,
             cam=[(0, (0, 0, 390, 520)), (1.3, (0, 0, 390, 520)), (1.9, (0, 60, 390, 380)), (2.6, (0, 60, 390, 380))]),
        # result 4: open the new class — its details
        dict(src=22.4, rate=1.0, dur=3.2,
             cam=[(0, (0, 60, 390, 380)), (0.55, (0, 60, 390, 380)), (1.3, (0, 0, 390, 430)), (3.2, (0, 0, 390, 430))]),
    ],
    overlays=[
        dict(png="r3_hook", on=0.0, off=3.2, kind="head", first=True),
        dict(png="r3_value", on=3.2, off=5.8, kind="head"),
        dict(png="r3_add", on=5.8, off=11.6, kind="head"),
        dict(png="r3_result", on=11.6, off=20.75, kind="head"),
        dict(png="pill_r3", on=0.0, off=20.75, kind="pill", first=True),
    ],
)

if __name__ == "__main__":
    build(cfg)
