#!/usr/bin/env python3
"""Reel 15 — YouTube explainer: every feature of the app, one chapter each (1920x1080, 16:9, ~4 minutes).

Layout   RTL: the text column (chapter number + group, title with highlighter, two ticks) on the right, the app in a large
         tilted phone on the left showing the WHOLE screen, a progress rail along the bottom, the lockup top-right.
         Same brand as Reels 2 / 5 / 10-14: paper, ink #0B1B33, teal #00A99D / #006D65, the yellow highlighter of the poster look.
Footage  capture/takes/tour.mp4 (the owner's full-app tour) plus the committed takes r4_messages, r10_games, r11_interactive.
         Nothing re-recorded. Windows are listed per chapter in youtube_chapters.py, with what was kept off screen and why.
Sound    music_upbeat.py, mixed ~7 dB lower than the reels so it sits under the captions; a whoosh on each chapter change.
         No voice-over: the video works muted (every point is a burned-in caption). A narrated version is a re-mux.
Speed    frames are rendered in 4 parallel chunks and concatenated.

    python3 make_youtube_overlays.py && node render_html.js yt_overlays.html overlays_yt 1920 1080
    python3 build_youtube.py            # writes out/Iqrra_15_YouTube_Full_Tour.mp4 and out/youtube_chapters.txt
"""
import multiprocessing as mp
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import build_poster_reel as bp    # the poster helpers: phone sprite (bezel + mask), back_out
import music_upbeat
from reel_lib import FPS, HERE, OUT, FrameReader, Take, cursor_sprite, ease, ripple
from youtube_chapters import BLUR_Y, CHAPTERS, END_DUR, INTRO_DUR

W, H = 1920, 1080
OV = HERE / "overlays_yt"
SW, SH = 442, 957                      # the phone screen: the whole 390x844 viewport at 1.13x
bp.SW, bp.SH = SW, SH
PCX, PCY, ANGLE = 575, 545, -2.0
TEAL, INK, YELLOW, PAPER = (0, 169, 157), (11, 27, 51), (255, 201, 60), (246, 245, 241)
COL_R = 1860                           # right edge of the text column
INTRO = [("tour", 51.5, 0.6, 3.0), ("r11_interactive", 8.3, 0.0, 3.0), ("r10_games", 3.5, 1.0, 3.0)]
WIPE = 0.17


def timeline():
    scenes, t = [], 0.0
    def add(ch, subs):
        nonlocal t
        for k, s in enumerate(subs):
            take, src, rate, dur = s[:4]
            scenes.append(dict(ch=ch, k=k, take=take, src=src, rate=rate, dur=dur, crop=s[4] if len(s) > 4 else None, t0=t))
            t += dur
    add(-1, INTRO)
    for i, c in enumerate(CHAPTERS):
        add(i, c["subs"])
    return scenes, t


SCENES, T_END = timeline()
TOTAL = T_END + END_DUR
CH_START = {}
for s in SCENES:
    CH_START.setdefault(s["ch"], s["t0"])
CUTS = [CH_START[i] for i in range(len(CHAPTERS))] + [CH_START[0]]      # chapter starts (+ intro->ch1 is CH_START[0])
CUTS = sorted(set(CH_START.values()) - {0.0})

G = {}


def setup():
    G["takes"] = {n: Take(n) for n in {s["take"] for s in SCENES}}
    G["imgs"] = {p.stem: Image.open(p).convert("RGBA") for p in OV.glob("*.png") if p.stem != "end"}
    G["end"] = Image.open(OV / "end.png").convert("RGB")
    G["bg"] = background()
    G["body"], G["mask"] = bp.phone_sprite()
    G["readers"] = {}
    G["shadow"] = {}


def background():
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    for gx in range(990, 1830, 46):                      # dot grid under the lockup
        for gy in range(120, 220, 46):
            d.ellipse((gx - 3, gy - 3, gx + 3, gy + 3), fill=(214, 211, 202))
    s = 2
    disc = Image.new("RGBA", (1100 * s, 1100 * s), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse((0, 0, 1100 * s - 1, 1100 * s - 1), fill=TEAL + (255,))
    disc = disc.resize((1100, 1100), Image.LANCZOS)
    img = img.convert("RGBA")
    img.alpha_composite(disc, (PCX - 550 + 40, PCY - 550 + 120))
    y = Image.new("RGBA", (120, 120), (0, 0, 0, 0))
    ImageDraw.Draw(y).ellipse((0, 0, 119, 119), fill=YELLOW + (255,))
    img.alpha_composite(y, (1000 - 120, 60))
    return img


def footage(take, reader, sc, t_rel):
    """The app screen at phone size. A crop narrower than the screen is bottom-aligned on its own background colour."""
    t_src = sc["src"] + sc["rate"] * t_rel
    src = reader.get(t_src)
    k = take.k
    blur = sc["crop"] == "blur"
    x, y, w, h = (0, 0, 390, 844) if blur or not sc["crop"] else sc["crop"]
    scale = SW / w
    ch = h * scale
    if ch >= SH - 1:
        foot = src.resize((SW, SH), Image.LANCZOS, box=(x * k, y * k, (x + w) * k, (y + h) * k)).convert("RGBA")
        oy = 0
        to_card = lambda px, py: ((px - x) * scale, (py - y) * scale)
        if blur:      # generated text can show mirrored maths: blur that band, keep header and the «ready» card sharp
            b0, b1 = int(BLUR_Y[0] * scale), int(BLUR_Y[1] * scale)
            band = foot.crop((0, b0, SW, b1)).filter(ImageFilter.GaussianBlur(9))
            band = Image.blend(band, Image.new("RGBA", band.size, (255, 255, 255, 255)), 0.35)
            foot.paste(band, (0, b0))
    else:
        part = src.resize((SW, int(round(ch))), Image.LANCZOS, box=(x * k, y * k, (x + w) * k, (y + h) * k)).convert("RGBA")
        bgc = part.getpixel((4, 4))
        foot = Image.new("RGBA", (SW, SH), bgc)
        oy = SH - part.height
        foot.paste(part, (0, oy))
        to_card = lambda px, py: ((px - x) * scale, (py - y) * scale + oy)
    for tt, tx, ty in take.taps:
        cx, cy = to_card(tx, ty)
        ripple(foot, cx, cy, (t_src - tt) / 0.8, scale)
    ptr = take.pointer(t_src)
    if ptr is not None:
        px, py, idle = ptr
        a = 1 - ease((idle - 1.1) / 0.5)
        if a > 0.02:
            spr = cursor_sprite(max(18, int(22 * scale / 2.0)))
            if a < 0.999:
                spr = spr.copy(); spr.putalpha(spr.getchannel("A").point(lambda v: int(v * a)))
            cx, cy = to_card(px, py)
            foot.alpha_composite(spr, (int(cx - 4), int(cy - 4)))
    return foot


def shadow_for(sprite):
    key = sprite.size
    if key not in G["shadow"]:
        blur = 26; pad = blur * 3
        sh = Image.new("RGBA", (sprite.width + 2 * pad, sprite.height + 2 * pad), (0, 0, 0, 0))
        a = sprite.getchannel("A").point(lambda v: int(v * 95 / 255))
        sh.paste((11, 27, 51, 255), (pad, pad + 22), a)
        G["shadow"][key] = (sh.filter(ImageFilter.GaussianBlur(blur)), pad)
    return G["shadow"][key]


def fade(img, a):
    if a >= 0.999:
        return img
    img = img.copy(); img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return img


def wipe_in(frame, img, x_right, y, tr, dur=0.4, rise=22):
    """Reveal img from its right edge (the reading direction), with a small rise."""
    p = ease(tr / dur)
    if p <= 0:
        return
    vis = max(1, int(img.width * p))
    frame.alpha_composite(img.crop((img.width - vis, 0, img.width, img.height)), (x_right - vis, y + int((1 - p) * rise)))


def render_frame(f):
    t = f / FPS
    imgs = G["imgs"]
    if t >= T_END:
        out = G["end"].copy()
        te = t - T_END
        frame = out.convert("RGBA")
    else:
        idx = max(i for i, s in enumerate(SCENES) if s["t0"] <= t + 1e-9)
        sc = SCENES[idx]
        tr = t - sc["t0"]
        key = idx
        if key not in G["readers"]:
            for r in G["readers"].values():
                r.close()
            G["readers"] = {key: FrameReader(G["takes"][sc["take"]], sc["src"])}
        reader = G["readers"][key]
        frame = G["bg"].copy()
        ch = sc["ch"]
        ch_t = t - CH_START[ch]

        foot = footage(G["takes"][sc["take"]], reader, sc, tr)
        foot.putalpha(G["mask"])
        ph = G["body"].copy(); ph.alpha_composite(foot, (bp.BZ, bp.BZ))
        notch = Image.new("RGBA", ph.size, (0, 0, 0, 0))
        ImageDraw.Draw(notch).rounded_rectangle((ph.width // 2 - 56, bp.BZ + 12, ph.width // 2 + 56, bp.BZ + 38), 13, fill=INK + (255,))
        ph.alpha_composite(notch)
        pop = bp.back_out(min(tr / 0.3, 1), 1.5) if sc["k"] > 0 else bp.back_out(min(ch_t / 0.5, 1), 1.7)
        k = 0.95 + 0.05 * pop
        if k < 0.9995:
            ph = ph.resize((int(ph.width * k), int(ph.height * k)), Image.LANCZOS)
        ph = ph.rotate(-ANGLE, resample=Image.BICUBIC, expand=True)
        sprite, pad = shadow_for(ph)
        sprite = sprite.copy(); sprite.alpha_composite(ph, (pad, pad))
        frame.alpha_composite(sprite, (int(PCX - sprite.width / 2), int(PCY + 7 * np.sin(t * 2.0) - sprite.height / 2)))

        if ch == -1:                                                       # intro
            blk = imgs["intro"]
            wipe_in(frame, blk, COL_R, 170, ch_t, 0.6)
        else:
            i = ch + 1
            c = CHAPTERS[ch]
            head, b1, b2 = imgs[f"c{i:02d}_h"], imgs[f"c{i:02d}_b1"], imgs[f"c{i:02d}_b2"]
            total_h = head.height + 44 + b1.height + 26 + b2.height
            y0 = int(520 - total_h / 2) - 30
            wipe_in(frame, head, COL_R, y0, ch_t - 0.12, 0.4)
            wipe_in(frame, b1, COL_R, y0 + head.height + 44, ch_t - 0.9, 0.4)
            wipe_in(frame, b2, COL_R, y0 + head.height + 44 + b1.height + 26, ch_t - 1.7, 0.4)
            if c["demo"]:
                pill = imgs["pill_ai" if c["demo"] == "ai" else "pill_acct"]
                a = ease((ch_t - 0.8) / 0.3)
                frame.alpha_composite(fade(pill, a), (COL_R - pill.width, y0 + total_h + 56))
            frame.alpha_composite(imgs["lk"], (COL_R - imgs["lk"].width, 38))
            # progress rail: one segment per chapter, filling right-to-left
            segw, gap = 34, 8
            L = Image.new("RGBA", (len(CHAPTERS) * segw + (len(CHAPTERS) - 1) * gap, 14), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
            for j in range(len(CHAPTERS)):
                x0 = L.width - (j + 1) * segw - j * gap
                col = INK + (255,) if j < ch else (TEAL + (255,) if j == ch else (11, 27, 51, 46))
                d.rounded_rectangle((x0, 0, x0 + segw, 14), 7, fill=col)
            frame.alpha_composite(L, (COL_R - L.width, 990))
    # teal swipe at every chapter change (the content switches while it covers the frame)
    for cut in CUTS + [T_END]:
        q = (t - (cut - WIPE)) / (2 * WIPE)
        if 0 <= q <= 1:
            left = int(q * 2 * W - W)
            frame.alpha_composite(Image.new("RGBA", (W, H), TEAL + (255,)), (left, 0))
            if left + W < W + 40:
                frame.alpha_composite(Image.new("RGBA", (36, H), INK + (255,)), (left + W if left + W >= 0 else 0, 0))
    return frame.convert("RGB")


def render_chunk(args):
    n, f0, f1 = args
    setup()
    path = OUT / f"_yt_{n}.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "60",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", str(path)], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        enc.stdin.write(render_frame(f).tobytes())
    enc.stdin.close(); enc.wait()
    return str(path)


def chapter_list():
    lines = ["0:00 مقدّمة"]
    for i, c in enumerate(CHAPTERS):
        t = CH_START[i]
        lines.append(f"{int(t // 60)}:{int(t % 60):02d} {c['title']}")
    t = T_END
    lines.append(f"{int(t // 60)}:{int(t % 60):02d} جرّبها مجانًا")
    return lines


def main():
    n = int(round(TOTAL * FPS))
    parts = 4
    bounds = [(i, n * i // parts, n * (i + 1) // parts) for i in range(parts)]
    with mp.get_context("fork").Pool(parts) as pool:
        files = pool.map(render_chunk, bounds)
    lst = OUT / "_yt_list.txt"
    lst.write_text("\n".join(f"file '{p}'" for p in files))
    silent = OUT / "_yt_silent.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)], check=True)
    bed = OUT / "_yt_music.wav"
    music_upbeat.render(bed, TOTAL, hits=CUTS, end=T_END)
    final = OUT / "Iqrra_15_YouTube_Full_Tour.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed),
                    "-filter_complex", f"[1:a]volume=-8dB,afade=t=out:st={TOTAL - 2.5:.2f}:d=2.5[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{TOTAL:.3f}",
                    "-movflags", "+faststart", str(final)], check=True)
    for p in files + [str(lst), str(silent), str(bed)]:
        __import__("os").unlink(p)
    (OUT / "youtube_chapters.txt").write_text("\n".join(chapter_list()) + "\n")
    print("wrote", final, f"{TOTAL:.1f}s", len(CHAPTERS), "chapters")
    print("\n".join(chapter_list()))


if __name__ == "__main__":
    main()
