#!/usr/bin/env python3
"""Reels 10-12 — features that exist in the app today, in the current Iqrra brand.

  10  «ألعاب إقرأ»        deep-teal "progress race": the public games hub, then the element-symbols game answered
                          correctly, sped up, with a segment ticker that fills as the questions go by.
  11  «الحصة التفاعلية»    paper "numbered list": the activity catalogue lit one activity at a time, the set-up
                          form, and «النشاط جاهز للعرض». Demo-mode content, so it carries the demo pill.
  12  «المنهاج»           ink "explainer": library card -> subject -> semester -> unit -> lesson, then the lesson
                          page (actions, book figures with page numbers, objectives).

Footage: capture/takes/r10_games, r11_interactive, r12_curriculum (r*_record.cjs). Left off screen on purpose:
  * Reel 12: the lesson page's «مكتبة الدرس» card names a real teacher who uploaded a file — blurred in the take
    and cropped out of every scene; the «نتاجات التعلّم» section (English «Understand» chips in an Arabic page).
  * Reel 11: the generated slides themselves (maths text) — the reel stops at «النشاط جاهز للعرض».
  * Reel 10: nothing hidden; the element game is symbols and names only. Flags / capitals need internet.

    node make_brand.mjs ; node render_overlays.js ; python3 build_new_feature_reels.py 10 11 12
"""
import sys

from reel_lib import build

Y1 = 290 + 124 + 16          # chip under a one-line headline
Y2 = 290 + 224 + 16          # chip under a two-line headline


def starts(scenes):
    t, out = 0.0, []
    for s in scenes:
        out.append(t)
        t += s["dur"]
    return out + [t]


def reel10():
    T = "r10_games"
    A = [6.287, 8.841, 11.383, 13.974, 16.525, 19.068, 21.643, 24.218]       # take time of each answer tap
    S2_SRC, S3_SRC, RATE = 3.5, 14.0, 1.8
    d2, d3 = (13.99 - S2_SRC) / RATE, (24.5 - S3_SRC) / RATE
    sc = [
        dict(src=0.4, rate=1.0, dur=3.0, cam=[(0, (0, 0, 390, 430))]),                       # the hub, tap «رموز العناصر»
        dict(src=S2_SRC, rate=RATE, dur=d2, cam=[(0, (0, 0, 390, 430))]),                    # questions 1-4
        dict(src=S3_SRC, rate=RATE, dur=d3, cam=[(0, (0, 0, 390, 430))]),                    # questions 5-8
        dict(src=25.9, rate=0.0, dur=2.8, cam=[(0, (0, 330, 390, 260))]),                    # أحسنت! 8 من 8
    ]
    t = starts(sc)
    fills = [t[1] + (a - S2_SRC) / RATE if a < 14.0 else t[2] + (a - S3_SRC) / RATE for a in A]
    ov = [
        dict(png="r10_hook", on=t[0], off=t[1], kind="head", first=True),
        dict(png="r10_play", on=t[1], off=t[2], kind="head"),
        dict(png="chip_r10", on=t[1], off=t[2], kind="chip", y=Y2),
        dict(png="r10_race", on=t[2], off=t[3], kind="head"),
        dict(png="r10_free", on=t[3], off=t[4], kind="head"),
    ]
    return dict(name="reel10", take=T, theme="teal", end="end_t10", out="Iqrra_10_Games.mp4",
                music="upbeat", dings=fills, end_dur=3.6,
                scenes=sc, overlays=ov, tickers=[dict(n=8, y=1496, fills=fills, on=t[1], off=t[4])])


def reel11():
    T = "r11_interactive"
    sc = [
        dict(src=1.6, rate=1.0, dur=3.4, cam=[(0, (0, 240, 390, 480))]),                     # tools tab, tap «الحصة التفاعلية»
        dict(src=8.3, rate=0.0, dur=1.5, cam=[(0, (0, 230, 390, 290))],                      # ① the featured escape challenge
             boxes=[dict(rect=(16, 278, 358, 140), on=0.15, off=1.5)]),
        dict(src=11.8, rate=0.0, dur=4.0, cam=[(0, (0, 140, 390, 420))],                     # ② ③ ④
             boxes=[dict(rect=(8, 160, 374, 105), on=0.1, off=1.4),
                    dict(rect=(8, 295, 374, 105), on=1.4, off=2.7),
                    dict(rect=(8, 430, 374, 115), on=2.7, off=4.0)]),
        dict(src=23.4, rate=2.0, dur=6.2, cam=[(0, (0, 90, 390, 580))]),                     # set-up: lesson, group, goal
        dict(src=44.0, rate=0.0, dur=3.6, cam=[(0, (0, 195, 390, 520))]),                    # النشاط جاهز للعرض
    ]
    t = starts(sc)
    ov = [
        dict(png="r11_hook", on=t[0], off=t[1], kind="head", first=True),
        dict(png="r11_list", on=t[1], off=t[3], kind="head"),
        dict(png="s11_1", on=t[1], off=t[2], kind="chip", y=Y1),
        dict(png="s11_2", on=t[2], off=t[2] + 1.4, kind="chip", y=Y1),
        dict(png="s11_3", on=t[2] + 1.4, off=t[2] + 2.7, kind="chip", y=Y1),
        dict(png="s11_4", on=t[2] + 2.7, off=t[3], kind="chip", y=Y1),
        dict(png="r11_form", on=t[3], off=t[4], kind="head"),
        dict(png="r11_ready", on=t[4], off=t[5], kind="head"),
        dict(png="pill_p11", on=t[3], off=t[5], kind="pill"),
    ]
    dings = [t[1] + 0.15, t[2] + 0.1, t[2] + 1.4, t[2] + 2.7]            # one per activity as it lights up
    return dict(name="reel11", take=T, theme="paper", end="end_p11", out="Iqrra_11_Interactive_Class.mp4", end_dur=3.6,
                music="upbeat", dings=dings, scenes=sc, overlays=ov)


def reel12():
    T = "r12_curriculum"
    sc = [
        dict(src=3.4, rate=1.0, dur=2.6, cam=[(0, (0, 440, 390, 205))]),                     # library -> «المنهاج»
        dict(src=6.9, rate=1.0, dur=2.6, cam=[(0, (0, 40, 390, 600))]),                      # grade + subjects
        dict(src=10.2, rate=1.0, dur=2.2, cam=[(0, (0, 40, 390, 330))]),                     # semesters
        dict(src=13.2, rate=1.0, dur=2.0, cam=[(0, (0, 40, 390, 560))]),                     # units
        dict(src=16.2, rate=1.0, dur=2.0, cam=[(0, (0, 40, 390, 520))]),                     # lessons
        dict(src=20.6, rate=0.0, dur=3.0, cam=[(0, (0, 30, 390, 230))],                      # the lesson page
             boxes=[dict(rect=(268, 150, 104, 84), on=0.4, off=3.0)]),
        dict(src=26.5, rate=0.0, dur=3.0, cam=[(0, (0, 100, 390, 470))]),                    # book figures + page numbers
        dict(src=32.5, rate=0.0, dur=3.0, cam=[(0, (0, 100, 390, 340))]),                    # objectives
    ]
    t = starts(sc)
    ov = [
        dict(png="r12_hook", on=t[0], off=t[2], kind="head", first=True),
        dict(png="r12_drill", on=t[2], off=t[5], kind="head"),
        dict(png="r12_all", on=t[5], off=t[6], kind="head"),
        dict(png="chip_n5", on=t[5], off=t[8], kind="chip", y=Y2),
        dict(png="r12_book", on=t[6], off=t[7], kind="head"),
        dict(png="r12_goals", on=t[7], off=t[8], kind="head"),
    ]
    # chip under a 1-line headline on the last scene would sit at Y1; keep Y2 for the 2-line scenes and move it
    ov[3] = dict(png="chip_n5", on=t[5], off=t[7], kind="chip", y=Y2)
    ov.append(dict(png="chip_n5", on=t[7], off=t[8], kind="chip", y=Y1))
    return dict(name="reel12", take=T, theme="ink", end="end_k12", out="Iqrra_12_Curriculum.mp4", end_dur=3.6,
                music="upbeat", dings=[t[5] + 0.4], scenes=sc, overlays=ov)


REELS = {"10": reel10, "11": reel11, "12": reel12}

if __name__ == "__main__":
    for n in (sys.argv[1:] or REELS):
        build(REELS[n]())
