#!/usr/bin/env python3
"""Reels 6-9 — cut from the full-app tour recording (capture/takes/tour.mp4).

The tour is one 8m14s, silent, 780x1688 (= 2x the 390x844 viewport) screen recording of the app with 26
numbered chapter cards («03 / 26 اسأل إقرأ»). Reels 1-5 each covered one flow; these four take chapters
the earlier reels did not:

    6  Ask Iqra         chapter 03   chat: a request, a clarifying question, a plan + what is left to do
    7  Class games      chapters 12 + 08   «ألعاب إقرأ» element game, then the «تحدي الصف» set-up
    8  Lesson slides    chapter 10   «شرائح الدرس»: the lesson as a deck
    9  Full lesson flow chapter 16   «مسار الدرس الكامل»: six steps, built one after another

What was left out on purpose: any frame where the app shows maths with its words and symbols in reversed
bidi order (chapter 03's worksheet reply, chapter 10's «مفردات الدرس» slide, chapter 16's «تحقّق سريع» and
worksheet cards) — those are real defects in the build the tour was recorded from, and a promo should not
be where a teacher first sees them. Also the timetable and calendar chapters (an empty calendar), the
sign-in chapter (a typed e-mail address) and the whiteboard (a blank grid).

Everything the AI chapters show is demo-mode content (the app says so in its own header), so Reels 6, 8
and 9 carry the same «وضع العرض · محتوى تجريبي» pill as Reel 1. Reel 7's games are static content.

    node render_overlays.js ; python3 build_tour_reels.py 6 7 8 9
"""
import sys

from reel_lib import build

HEAD1, HEAD2 = 124, 224                       # one-line / two-line headline PNG heights
Y1 = 290 + HEAD1 + 16                         # chip under a one-line headline
Y2 = 290 + HEAD2 + 16                         # chip under a two-line headline


def drift(c, dur, z=0.05):
    """A slow push-in on a still: the crop shrinks z about its centre over the scene."""
    x, y, w, h = c
    return [(0, c), (dur, (x + w * z / 2, y + h * z / 2, w * (1 - z), h * (1 - z)))]


def timeline(scenes):
    t, out = 0.0, []
    for s in scenes:
        out.append((t, t + s["dur"]))
        t += s["dur"]
    return out, t


def reel6():
    sc = [
        dict(src=50.0, rate=0.0, dur=2.6, cam=[(0, (0, 122, 390, 250))]),                    # the empty chat
        dict(src=51.0, rate=1.0, dur=4.0, cam=[(0, (0, 560, 390, 250))]),                    # the request is typed
        dict(src=56.0, rate=1.0, dur=2.5, cam=[(0, (0, 215, 390, 285))]),                    # «أيّ واحد يعني؟» + options
        dict(src=65.0, rate=0.0, dur=3.0, cam=drift((0, 232, 390, 168), 3.0)),                    # «المادة جاهزة لدرس…»
        dict(src=66.0, rate=0.0, dur=3.2, cam=[(0, (0, 400, 390, 290))]),                    # ما أنجزته / ما تبقّى
        dict(src=66.0, rate=0.0, dur=2.6, cam=[(0, (0, 400, 390, 290)), (2.6, (0, 585, 390, 115))]),   # next-step chips
    ]
    t = [x for x, _ in timeline(sc)[0]] + [timeline(sc)[1]]
    ov = [
        dict(png="r6_hook", on=t[0], off=t[1], kind="head", first=True),
        dict(png="chip_r2", on=t[0], off=t[1], kind="chip", y=Y2, first=True),
        dict(png="r6_type", on=t[1], off=t[2], kind="head"),
        dict(png="r6_ask", on=t[2], off=t[3], kind="head"),
        dict(png="r6_plan", on=t[3], off=t[4], kind="head"),
        dict(png="chip_r2", on=t[3], off=t[4], kind="chip", y=Y1),
        dict(png="r6_left", on=t[4], off=t[5], kind="head"),
        dict(png="r6_next", on=t[5], off=t[6], kind="head"),
        dict(png="demo", on=0.0, off=t[6], kind="pill", first=True),
    ]
    return dict(name="reel6", take="tour", end="end6", out="Iqrra_06_Ask_Iqra.mp4", end_dur=3.6,
                scenes=[dict(s, pointer=False) for s in sc], overlays=ov)


def reel7():
    sc = [
        dict(src=288.6, rate=0.0, dur=3.2, cam=[(0, (0, 0, 390, 430))]),                     # «ألعاب إقرأ» hub
        dict(src=290.4, rate=1.0, dur=4.0, cam=[(0, (0, 0, 390, 380))]),                     # element game, answer ✓
        dict(src=316.6, rate=0.0, dur=2.2, cam=[(0, (0, 330, 390, 260))]),                   # أحسنت! 8 من 8
        dict(src=197.0, rate=0.0, dur=3.4, cam=drift((0, 25, 390, 345), 3.4)),               # «تحدي الصف»: teams + questions
        dict(src=197.0, rate=0.0, dur=3.6, cam=drift((0, 385, 390, 380), 3.6)),              # ready: 5 questions, 4 teams, 10 min
    ]
    t = [x for x, _ in timeline(sc)[0]] + [timeline(sc)[1]]
    ov = [
        dict(png="r7_hook", on=t[0], off=t[1], kind="head", first=True),
        dict(png="r7_play", on=t[1], off=t[2], kind="head"),
        dict(png="r7_score", on=t[2], off=t[3], kind="head"),
        dict(png="r7_team", on=t[3], off=t[4], kind="head"),
        dict(png="chip_r2", on=t[3], off=t[4], kind="chip", y=Y1),
        dict(png="r7_ready", on=t[4], off=t[5], kind="head"),
        dict(png="chip_r2", on=t[4], off=t[5], kind="chip", y=Y2),
    ]
    return dict(name="reel7", take="tour", end="end7", out="Iqrra_07_Class_Games.mp4", end_dur=3.6,
                scenes=[dict(s, pointer=False) for s in sc], overlays=ov)


def reel8():
    sc = [
        dict(src=240.0, rate=0.0, dur=2.8, cam=drift((0, 0, 390, 260), 2.8)),                # «شرائح الدرس»
        dict(src=240.0, rate=0.0, dur=2.6, cam=drift((0, 372, 390, 430), 2.6)),              # the lesson picker
        dict(src=245.5, rate=0.0, dur=3.2, cam=[(0, (0, 190, 390, 330)), (3.2, (0, 340, 390, 330))]),   # the slide list
        dict(src=252.5, rate=0.0, dur=2.4, cam=drift((0, 300, 390, 250), 2.4)),              # title slide
        dict(src=255.5, rate=0.0, dur=2.8, cam=drift((0, 70, 390, 540), 2.8)),               # نتاجات التعلم
        dict(src=258.5, rate=0.0, dur=2.6, cam=drift((0, 70, 390, 420), 2.6)),               # أفكار الدرس
        dict(src=262.5, rate=0.0, dur=2.6, cam=drift((0, 60, 390, 620), 2.6)),               # من كتاب الطالب
    ]
    t = [x for x, _ in timeline(sc)[0]] + [timeline(sc)[1]]
    names = ["r8_hook", "r8_pick", "r8_list", "r8_title", "r8_out", "r8_ideas", "r8_book"]
    ov = [dict(png=n, on=t[i], off=t[i + 1], kind="head", first=(i == 0)) for i, n in enumerate(names)]
    ov.append(dict(png="demo", on=0.0, off=t[7], kind="pill", first=True))
    return dict(name="reel8", take="tour", end="end8", out="Iqrra_08_Lesson_Slides.mp4", end_dur=3.6,
                scenes=[dict(s, pointer=False) for s in sc], overlays=ov)


def reel9():
    sc = [
        dict(src=360.5, rate=0.0, dur=2.8, cam=drift((0, 0, 390, 260), 2.8)),                # «مسار الدرس الكامل»
        dict(src=364.5, rate=0.0, dur=3.2, cam=drift((0, 110, 390, 520), 3.2)),              # the form
        dict(src=367.8, rate=0.25, dur=3.4, cam=[(0, (0, 40, 390, 470))]),                   # step 2 of 6 building
        dict(src=370.5, rate=0.0, dur=3.8, cam=drift((0, 385, 390, 380), 3.8)),              # the interactive activity
        dict(src=372.0, rate=0.0, dur=3.6, cam=drift((0, 270, 390, 290), 3.6)),              # guided practice
    ]
    t = [x for x, _ in timeline(sc)[0]] + [timeline(sc)[1]]
    names = ["r9_hook", "r9_form", "r9_steps", "r9_act", "r9_guide"]
    ov = [dict(png=n, on=t[i], off=t[i + 1], kind="head", first=(i == 0)) for i, n in enumerate(names)]
    ov.append(dict(png="demo", on=0.0, off=t[5], kind="pill", first=True))
    return dict(name="reel9", take="tour", end="end9", out="Iqrra_09_Full_Lesson.mp4", end_dur=3.6,
                scenes=[dict(s, pointer=False) for s in sc], overlays=ov)


REELS = {"6": reel6, "7": reel7, "8": reel8, "9": reel9}

if __name__ == "__main__":
    for n in (sys.argv[1:] or REELS):
        build(REELS[n]())
