#!/usr/bin/env python3
"""Reel 4 — «Stay connected with your class» (1080x1920, ~24s).

Footage: capture/takes/r4_messages.mp4 — one take in a fictional teacher's demo account (class «الثامن علوم أ»,
three student accounts, two parent accounts, all created on a throwaway local database). On camera: the
الرسائل inbox, the «راسل» sheet (parents and students), the class-group thread and the reminder sent to it, the
direct thread with a parent and the message sent there. Both messages are the demo texts from the brief and
exist only in that local database — nothing was sent to a real person. The on-screen pill says so.

    node capture/relogin.cjs demo.messages@example.com r4 ; node capture/r4_record.cjs
    node render_overlays.js ; python3 build_reel4.py
"""
from reel_lib import build

INBOX = (0, 70, 390, 260)
PICKER = (0, 330, 390, 514)
COMPOSER = (0, 590, 390, 254)
BUBBLE = (0, 0, 390, 300)
THREAD_TOP = (0, 0, 390, 330)

cfg = dict(
    name="reel4", take="r4_messages", end="end4", out="Iqrra_04_Communication.mp4", end_dur=3.7,
    scenes=[
        # hook: the inbox — the class group is already a thread here
        dict(src=0.3, rate=1.0, dur=3.4, cam=[(0, INBOX), (3.4, (0, 75, 390, 250))]),
        # value: both ways to write — «رسالة جديدة» opens parents and students
        dict(src=3.9, rate=1.0, dur=3.2,
             cam=[(0, INBOX), (0.7, INBOX), (1.3, PICKER), (3.2, PICKER)]),
        # class: open the group, write the reminder, send — the bubble gets its own beat
        dict(src=8.4, rate=1.5, dur=1.8, cam=[(0, INBOX), (0.5, INBOX), (0.95, THREAD_TOP), (1.8, THREAD_TOP)]),
        dict(src=11.4, src_end=18.45, rate=1.5, dur=4.7,
             cam=[(0, COMPOSER), (2.9, COMPOSER), (3.4, BUBBLE), (4.7, BUBBLE)]),
        # parent: «رسالة جديدة» -> «راسل» beside the parent -> the thread -> write, send
        dict(src=21.3, rate=1.4, dur=2.0, cam=[(0, PICKER), (1.6, PICKER), (1.95, THREAD_TOP), (2.0, THREAD_TOP)]),
        dict(src=24.4, rate=1.8, dur=5.45,
             cam=[(0, COMPOSER), (3.6, COMPOSER), (4.05, BUBBLE), (5.45, BUBBLE)]),
    ],
    overlays=[
        dict(png="r4_hook", on=0.0, off=3.4, kind="head", first=True),
        dict(png="r4_value", on=3.4, off=6.6, kind="head"),
        dict(png="r4_class", on=6.6, off=13.1, kind="head"),
        dict(png="r4_parent", on=13.1, off=20.55, kind="head"),
        dict(png="pill_r4", on=0.0, off=20.55, kind="pill", first=True),
    ],
)

if __name__ == "__main__":
    build(cfg)
