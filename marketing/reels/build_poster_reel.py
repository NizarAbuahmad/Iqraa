#!/usr/bin/env python3
"""Reel 13 (sample) — "poster" style, a deliberate break from Reels 1-12.

Reels 1-12 share one layout: headline in the top safe zone, the app in a rounded card on a soft gradient. This one
changes the whole language so you can judge a different direction:

  design   sand ground, one big teal disc, GIANT ink type with a yellow highlighter swipe, outlined step numerals,
           the app in a tilted phone mock-up (bezel, notch, shadow) that floats, sticker chips that pop in, teal
           swipe-wipe between scenes, a bold poster end card (hard offset shadows, no soft glows).
  text     a short story instead of labels: «حصتك بعد ساعة… والتحضير لسّا؟» -> four verbs -> a punchline.
  footage  the existing «الحصة التفاعلية» take (capture/takes/r11_interactive.mp4) — nothing re-recorded.
  music    music_upbeat.py, with a ding on every sticker and a whoosh/pop on every swipe.

The yellow (#FFC93C) is an accent borrowed from the app's own book-cover art; it is not in constants/colors.ts, so
adopting this style means deciding whether to add it to the brand palette. Everything else is brand: the lockup,
ink #0B1B33, teal #00A99D / #006D65, paper #F6F5F1.

    node render_overlays.js ; python3 build_poster_reel.py
"""
import subprocess

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

import music_upbeat
from reel_lib import (FPS, H, OUT, OV, VIEW_H, VIEW_W, W, FrameReader, Take, cursor_sprite, ease, ripple)

SAND, INK, TEAL, YELLOW = (246, 245, 241), (11, 27, 51), (0, 169, 157), (255, 201, 60)
SW, SH = 440, 733                  # phone screen, px (aspect 0.6)
BZ = 14                            # bezel
PCX, PCY = 520, 1104               # phone centre
ANGLE = -5.0
TAKE = "r11_interactive"


def back_out(x, s=1.9):
    x = min(max(x, 0.0), 1.0)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def background():
    img = Image.new("RGB", (W, H), SAND)
    d = ImageDraw.Draw(img)
    # dot grid, top-left
    for gx in range(70, 420, 46):
        for gy in range(300, 640, 46):
            d.ellipse((gx - 3, gy - 3, gx + 3, gy + 3), fill=(214, 211, 202))
    # the one big disc behind the phone
    s = 3
    big = Image.new("RGBA", (1100, 1100), (0, 0, 0, 0))
    ImageDraw.Draw(big).ellipse((0, 0, 1099, 1099), fill=TEAL + (255,))
    big = big.resize((1100, 1100), Image.LANCZOS)
    img.paste(big, (700 - 550 + 90, 1120 - 550 + 40), big)
    return img.convert("RGBA")


def phone_sprite():
    """Bezel + notch as an RGBA frame with a transparent screen hole is awkward; draw bezel under, footage over."""
    w, h = SW + 2 * BZ, SH + 2 * BZ
    s = 3
    m = Image.new("L", (w * s, h * s), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * s - 1, h * s - 1), 62 * s, fill=255)
    body = Image.new("RGBA", (w * s, h * s), INK + (255,))
    body.putalpha(m)
    sm = Image.new("L", (SW * s, SH * s), 0)
    ImageDraw.Draw(sm).rounded_rectangle((0, 0, SW * s - 1, SH * s - 1), 50 * s, fill=255)
    return body.resize((w, h), Image.LANCZOS), sm.resize((SW, SH), Image.LANCZOS)


def footage(take, reader, sc, tt, t_rel):
    t_src = sc["src"] + sc["rate"] * t_rel
    src = reader.get(t_src)
    x, y, w, h = sc["cam"]
    y = min(max(y, 0), VIEW_H - h)
    k = take.k
    scale = SW / w
    foot = src.resize((SW, SH), Image.LANCZOS, box=(x * k, y * k, (x + w) * k, (y + h) * k)).convert("RGBA")
    to_card = lambda px, py: ((px - x) * scale, (py - y) * scale)
    for tt_, tx, ty in take.taps:
        cx, cy = to_card(tx, ty)
        ripple(foot, cx, cy, (t_src - tt_) / 0.8, scale)
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


def shadowed(sprite, off=(0, 22), blur=26, alpha=95):
    pad = blur * 3
    sh = Image.new("RGBA", (sprite.width + 2 * pad, sprite.height + 2 * pad), (0, 0, 0, 0))
    a = sprite.getchannel("A").point(lambda v: int(v * alpha / 255))
    sh.paste((11, 27, 51, 255), (pad + off[0], pad + off[1]), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    sh.alpha_composite(sprite, (pad, pad))
    return sh, pad


def paste_center(frame, sprite, cx, cy):
    frame.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))


def fade(img, a):
    if a >= 0.999:
        return img
    img = img.copy(); img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return img


def main():
    take = Take(TAKE)
    sc = [
        dict(src=0.4, rate=0.0, dur=3.0, cam=(0, 150, 390, 650), head="p1", num=None),
        dict(src=1.6, rate=1.0, dur=3.2, cam=(0, 194, 390, 650), head="p2", num="bn1"),
        dict(src=8.2, rate=0.9, dur=3.6, cam=(0, 100, 390, 650), head="p3", num="bn2"),
        dict(src=27.0, rate=1.7, dur=4.4, cam=(0, 90, 390, 650), head="p4", num="bn3"),
        dict(src=44.0, rate=0.0, dur=3.2, cam=(0, 190, 390, 650), head="p5", num="bn4"),
    ]
    t = 0.0
    for s in sc:
        s["t0"] = t
        t += s["dur"]
    t_end, END = t, 3.6
    total = t_end + END
    cuts = [s["t0"] for s in sc[1:]]

    # stickers: (png, scene index, appear offset in the scene, centre x, centre y, angle)
    stickers = [
        ("sk_a", 2, 0.7, 755, 790, 6), ("sk_b", 2, 1.5, 270, 1440, -7), ("sk_c", 2, 2.3, 690, 1425, 5),
        ("sk_d", 3, 2.6, 690, 790, -5),
    ]
    dings = [sc[i]["t0"] + off for _, i, off, *_ in stickers]

    imgs = {n: Image.open(OV / f"{n}.png").convert("RGBA") for n in
            ["p1", "p2", "p3", "p4", "p5", "bn1", "bn2", "bn3", "bn4", "sk_a", "sk_b", "sk_c", "sk_d", "dmo"]}
    end_img = Image.open(OV / "end_q1.png").convert("RGB")
    bg = background()
    body, screen_mask = phone_sprite()

    silent = OUT / "_poster_silent.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", str(silent)],
        stdin=subprocess.PIPE)
    reader, cur, last = None, -1, None
    n = int(round(total * FPS))
    for f in range(n):
        tt = f / FPS
        if tt >= t_end:
            te = tt - t_end
            base = last.convert("RGB")
            z = 1.0                              # no zoom: the poster's type already sits on the margin line
            sz = (int(W * z), int(H * z))
            e = end_img.resize(sz, Image.BICUBIC)
            e = e.crop(((sz[0] - W) // 2, (sz[1] - H) // 2, (sz[0] - W) // 2 + W, (sz[1] - H) // 2 + H))
            out = Image.blend(base, e, ease(te / 0.35))
            enc.stdin.write(out.tobytes())
            continue
        idx = max(i for i, s in enumerate(sc) if s["t0"] <= tt + 1e-9)
        s = sc[idx]
        if idx != cur:
            if reader:
                reader.close()
            reader = FrameReader(take, s["src"]); cur = idx
        tr = tt - s["t0"]
        frame = bg.copy()

        # phone: float + wobble, pops in on the first scene
        foot = footage(take, reader, s, tt, tr)
        foot.putalpha(screen_mask)
        ph = body.copy(); ph.alpha_composite(foot, (BZ, BZ))
        notch = Image.new("RGBA", ph.size, (0, 0, 0, 0))
        ImageDraw.Draw(notch).rounded_rectangle((ph.width // 2 - 56, BZ + 12, ph.width // 2 + 56, BZ + 38), 13, fill=INK + (255,))
        ph.alpha_composite(notch)
        enter = back_out(min(tt / 0.55, 1)) if idx == 0 else 1.0
        ph = ph.resize((max(1, int(ph.width * (0.82 + 0.18 * enter))), max(1, int(ph.height * (0.82 + 0.18 * enter)))), Image.LANCZOS)
        ang = ANGLE + 1.2 * np.sin(tt * 1.7)
        ph = ph.rotate(-ang, resample=Image.BICUBIC, expand=True)
        sprite, pad = shadowed(ph)
        yoff = 10 * np.sin(tt * 2.1) + (1 - min(tt / 0.55, 1)) * 40 * (idx == 0)
        paste_center(frame, sprite, PCX, PCY + yoff)

        # headline: wipe in from the right edge (the reading direction) with a small rise
        head = imgs[s["head"]]
        p = ease(tr / 0.5)
        vis = max(1, int(head.width * p))
        crop = head.crop((head.width - vis, 0, head.width, head.height))
        frame.alpha_composite(crop, (960 - vis, 290 + int((1 - p) * 34)))

        # step badge on the phone's top-left corner
        if s["num"]:
            q = (tr - 0.25) / 0.4
            if q > 0:
                bd = imgs[s["num"]]
                k_ = max(0.01, back_out(q, 2.4))
                bd = bd.resize((max(1, int(bd.width * k_)), max(1, int(bd.height * k_))), Image.LANCZOS)
                paste_center(frame, bd, PCX - 205, PCY - 372)

        # stickers
        for name, si, off, cx, cy, an in stickers:
            if si != idx:
                continue
            q = (tr - off) / 0.45
            if q <= 0:
                continue
            sp = imgs[name]
            sc_ = max(0.01, back_out(q, 2.4))
            sp = sp.resize((max(1, int(sp.width * sc_)), max(1, int(sp.height * sc_))), Image.LANCZOS).rotate(an, expand=True, resample=Image.BICUBIC)
            paste_center(frame, sp, cx, cy + 6 * np.sin(tt * 2.6 + off))

        # demo label on the generated screens
        if idx >= 3:
            a = ease((tt - sc[3]["t0"]) / 0.3)
            paste_center(frame, fade(imgs["dmo"], a), 960 - imgs["dmo"].width // 2, 1470)

        # teal swipe between scenes (the cut happens at full cover)
        for c in cuts:
            q = (tt - (c - 0.17)) / 0.34
            if 0 <= q <= 1:
                left = int(q * 2 * W - W)
                wipe = Image.new("RGBA", (W, H), TEAL + (255,))
                edge = Image.new("RGBA", (36, H), INK + (255,))
                frame.alpha_composite(wipe, (left, 0))
                frame.alpha_composite(edge, (left + W if left + W < W else W, 0))

        last = frame
        enc.stdin.write(frame.convert("RGB").tobytes())
    enc.stdin.close(); enc.wait()
    reader.close()

    bed = OUT / "_poster_music.wav"
    music_upbeat.render(bed, total, hits=cuts, end=t_end, dings=dings)
    final = OUT / "Iqrra_13_Poster_Sample.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed),
                    "-filter_complex", f"[1:a]volume=-1.5dB,afade=t=out:st={total - 1.4:.2f}:d=1.4[a]",
                    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}",
                    "-movflags", "+faststart", str(final)], check=True)
    silent.unlink(); bed.unlink()
    print("wrote", final, f"{total:.2f}s", "cuts", [round(c, 2) for c in cuts])


if __name__ == "__main__":
    main()
