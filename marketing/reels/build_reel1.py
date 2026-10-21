#!/usr/bin/env python3
"""Reel 1 — «A tour in three steps» (1080x1920, ~23s) for Instagram / Facebook Reels.

Footage: marketing/tutorial/segments/*.mp4 (the 2026-09-15 teacher walkthrough, already
trimmed, padded to 1920x1080 and with the desktop notification masked). Every cut below
is a real stretch of one workflow: tools list -> شرائح الدرس -> الغلاف الجوي -> deck.

    node render_overlays.js          # Arabic text + end card (Chromium, never ffmpeg)
    python3 make_music.py out/bed.wav 23.5
    python3 build_reel1.py           # -> out/Iqrra_01_Three_Steps.mp4

Source windows deliberately avoid: the Claude toast (seg07 8-12s), the delete-slide
confirm and Chrome print dialog (seg09 0-5s), and the downloads bubble naming an
unrelated .pptx (seg09 13-16s).
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
SEG = HERE.parent / "tutorial" / "segments"
OV = HERE / "overlays"
OUT = HERE / "out"
W, H, FPS = 1080, 1920, 30
SRC_W, SRC_H, SRC_FPS = 1920, 1080, 30
CONTENT_Y0, CONTENT_Y1 = 46, 1032          # the rest of the source is brand-navy padding

# Reels safe zones: nothing essential in the top 14% / bottom 20% / right 12%.
CARD_W = 900                                # x 60..960
CARD_X = 60
CARD_CY = 1040
RADIUS = 38
NAVY = (8, 27, 58)
AQUA = (52, 214, 198)


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ---------------------------------------------------------------- timeline
# cam: [(t_rel, (x, y, w, h))] in source pixels. ripples: [(t_rel, src_x, src_y)].
SCENES = [
    dict(name="hook", seg="05", src=0.0, rate=0.633, dur=3.0,
         cam=[(0, (0, 46, 1920, 986)), (1.0, (0, 46, 1920, 986)), (3.0, (830, 60, 1080, 960))]),
    dict(name="tools", seg="05", src=1.9, src_end=3.2, rate=0.5, dur=4.0,
         cam=[(0, (830, 60, 1080, 960)), (1.4, (1260, 300, 660, 587)), (4.0, (1260, 300, 660, 587))],
         ripples=[(2.9, 1745, 402)]),
    dict(name="form", seg="07", src=2.4, rate=1.0, dur=4.2,
         cam=[(0, (1150, 470, 770, 562)), (4.2, (1190, 500, 730, 532))],
         ripples=[(2.9, 1820, 886)]),
    dict(name="generate", seg="07", src=14.0, rate=1.35, dur=1.33,
         cam=[(0, (760, 640, 1040, 392)), (1.33, (760, 640, 1040, 392))],
         ripples=[(0.59, 950, 903)]),
    dict(name="list", seg="09", src=1.5, src_end=2.1, rate=0.4, dur=2.33,
         cam=[(0, (1240, 225, 680, 604)), (2.33, (1220, 225, 700, 622))]),
    dict(name="present", seg="09", src=5.8, rate=1.0, dur=1.1,
         cam=[(0, (860, 420, 1060, 500)), (1.1, (860, 420, 1060, 500))],
         ripples=[(0.7, 940, 757)]),
    dict(name="slide1", seg="09", src=7.4, rate=1.0, dur=1.3,
         cam=[(0, (900, 230, 1020, 600)), (1.3, (930, 240, 990, 582))]),
    dict(name="figure", seg="09", src=18.7, rate=1.0, dur=1.9,
         cam=[(0, (440, 330, 1040, 590)), (1.9, (480, 340, 960, 545))]),
]
XFADE = 0.1
END_DUR = 3.7

# overlays: (png, t_on, t_off)  — filled in below from scene boundaries
starts, t = {}, 0.0
for s in SCENES:
    s["t0"] = t
    starts[s["name"]] = t
    t += s["dur"]
T_STEP1 = starts["tools"]
T_STEP2 = starts["form"]
T_STEP3 = starts["list"]
T_END = t
TOTAL = T_END + END_DUR
OVERLAYS = [
    ("hook", 0.0, T_STEP1),
    ("step1", T_STEP1, T_STEP2),
    ("step2", T_STEP2, T_STEP3),
    ("step3", T_STEP3, T_END),
    ("chip", T_STEP2, T_END),
    ("demo", T_STEP1, T_END),
]
OV_POS = {"hook": (60, 290), "step1": (60, 290), "step2": (60, 290), "step3": (60, 290)}


# ---------------------------------------------------------------- helpers
class FrameReader:
    """Sequential raw-frame reader over one segment, seeked to the scene's first frame."""

    def __init__(self, seg, t0):
        self.t0 = t0
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", str(SEG / f"{seg}.mp4"),
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE)
        self.idx = -1
        self.frame = None

    def get(self, t_src):
        want = max(0, round((t_src - self.t0) * SRC_FPS))
        n = SRC_W * SRC_H * 3
        while self.idx < want:
            buf = self.proc.stdout.read(n)
            if len(buf) < n:
                break
            self.frame = Image.frombuffer("RGB", (SRC_W, SRC_H), buf, "raw", "RGB", 0, 1)
            self.idx += 1
        return self.frame

    def close(self):
        self.proc.kill()
        self.proc.stdout.close()


def background():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.zeros((H, W, 3), np.float32) + np.array(NAVY, np.float32)
    for cx, cy, r, col, a in [(540, 560, 760, (52, 214, 198), .16), (80, 1780, 700, (0, 169, 157), .14)]:
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        m = np.clip(1 - d, 0, 1) ** 2 * a
        base += m[..., None] * (np.array(col, np.float32) - base)
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")


_mask_cache, _shadow_cache = {}, {}


def card_mask(w, h):
    if (w, h) not in _mask_cache:
        s = 3
        m = Image.new("L", (w * s, h * s), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, w * s - 1, h * s - 1), RADIUS * s, fill=255)
        _mask_cache[(w, h)] = m.resize((w, h), Image.LANCZOS)
    return _mask_cache[(w, h)]


def card_shadow(w, h):
    if (w, h) not in _shadow_cache:
        pad = 70
        m = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
        ImageDraw.Draw(m).rounded_rectangle((pad, pad + 18, pad + w, pad + 18 + h), RADIUS, fill=150)
        _shadow_cache[(w, h)] = (m.filter(ImageFilter.GaussianBlur(26)), pad)
    return _shadow_cache[(w, h)]


def ripple(card, cx, cy, p):
    """Soft aqua tap-ring around (cx, cy) in card pixels; p in 0..1 over the ripple's life."""
    if not 0 <= p <= 1:
        return
    s = 3
    R = 110
    patch = Image.new("RGBA", (2 * R * s, 2 * R * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(patch)
    for delay, width in ((0.0, 7), (0.22, 4)):
        q = (p - delay) / (1 - delay)
        if q <= 0:
            continue
        r = (14 + 64 * ease(q)) * s
        a = int(235 * (1 - q) ** 1.4)
        c = R * s
        d.ellipse((c - r, c - r, c + r, c + r), outline=AQUA + (a,), width=int(width * s))
    c = R * s
    r0 = 12 * s * (1 - 0.4 * p)
    d.ellipse((c - r0, c - r0, c + r0, c + r0), fill=AQUA + (int(150 * (1 - p)),))
    patch = patch.resize((2 * R, 2 * R), Image.LANCZOS)
    card.alpha_composite(patch, (int(cx - R), int(cy - R)))


def camera(cam, t):
    if t <= cam[0][0]:
        return cam[0][1]
    for (ta, a), (tb, b) in zip(cam, cam[1:]):
        if t <= tb:
            k = ease((t - ta) / (tb - ta)) if tb > ta else 1
            return tuple(x + (y - x) * k for x, y in zip(a, b))
    return cam[-1][1]


def render_scene(sc, reader, bg, t_rel):
    t_src = sc["src"] + sc["rate"] * t_rel
    if "src_end" in sc:
        t_src = min(t_src, sc["src_end"])
    src = reader.get(t_src)
    x, y, w, h = camera(sc["cam"], t_rel)
    y = min(max(y, CONTENT_Y0), CONTENT_Y1 - h)
    ch = int(round(CARD_W * h / w))
    foot = src.resize((CARD_W, ch), Image.LANCZOS, box=(x, y, x + w, y + h)).convert("RGBA")
    for tr, sx, sy in sc.get("ripples", []):
        ripple(foot, (sx - x) / w * CARD_W, (sy - y) / h * ch, (t_rel - tr) / 0.8)
    pop = 0.955 + 0.045 * ease(t_rel / 0.18)          # card settles in on every cut
    cw, chh = int(CARD_W * pop), int(ch * pop)
    if pop < 0.9999:
        foot = foot.resize((cw, chh), Image.LANCZOS)
    cx = CARD_X + (CARD_W - cw) // 2
    top = CARD_CY - chh // 2
    frame = bg.copy().convert("RGBA")
    sh, pad = card_shadow(cw, chh)
    shadow = Image.new("RGBA", sh.size, (2, 8, 20, 0))
    shadow.putalpha(sh)
    frame.alpha_composite(shadow, (cx - pad, top - pad))
    frame.paste(foot, (cx, top), card_mask(cw, chh))
    # hairline edge so the white UI separates from the navy ground
    edge = Image.new("RGBA", (cw, chh), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle((0, 0, cw - 1, chh - 1), RADIUS, outline=(255, 255, 255, 46), width=2)
    frame.alpha_composite(edge, (cx, top))
    return frame


def overlay_alpha(t, on, off, first=False):
    a_in = 1.0 if first else ease((t - on) / 0.16)
    a_out = ease((off - t) / 0.08)
    return min(a_in, a_out), 0 if first else (1 - ease((t - on) / 0.26)) * 22


def paste_overlay(frame, name, t, on, off, first=False):
    a, dy = overlay_alpha(t, on, off, first)
    if a <= 0.003:
        return
    img = OVERLAYS_IMG[name]
    if a < 0.999:
        img = img.copy()
        img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    if name in OV_POS:
        x, y = OV_POS[name]
    elif name == "chip":
        x, y = 960 - img.width, 462
    else:  # demo pill, sits under the card, inside the bottom safe margin
        x, y = 960 - img.width, 1466
    frame.alpha_composite(img, (int(x), int(y - dy)))


def main():
    global OVERLAYS_IMG
    OUT.mkdir(exist_ok=True)
    OVERLAYS_IMG = {n: Image.open(OV / f"{n}.png").convert("RGBA") for n, _, _ in OVERLAYS}
    end_img = Image.open(OV / "end.png").convert("RGB")
    bg = background()
    n_frames = int(round(TOTAL * FPS))
    silent = OUT / "_reel1_silent.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart",
         str(silent)], stdin=subprocess.PIPE)
    readers = {}
    prev_last = None
    last_by_scene = {}
    cur_idx = -1
    for f in range(n_frames):
        t = f / FPS
        if t < T_END:
            idx = max(i for i, s in enumerate(SCENES) if s["t0"] <= t + 1e-9)
            sc = SCENES[idx]
            if idx != cur_idx:
                if cur_idx >= 0:
                    prev_last = last_by_scene[cur_idx]
                    readers.pop(cur_idx).close()
                cur_idx = idx
                readers[idx] = FrameReader(sc["seg"], sc["src"])
            t_rel = t - sc["t0"]
            frame = render_scene(sc, readers[idx], bg, t_rel)
            last_by_scene[idx] = frame
            if prev_last is not None and t_rel < XFADE:
                frame = Image.blend(prev_last, frame, ease(t_rel / XFADE))
            for name, on, off in OVERLAYS:
                paste_overlay(frame, name, t, on, off, first=(name == "hook"))
            out = frame.convert("RGB")
        else:
            te = t - T_END
            base = last_by_scene[cur_idx].convert("RGB")
            zoom = 1.0 + 0.035 * min(te / END_DUR, 1)
            sz = (int(W * zoom), int(H * zoom))
            e = end_img.resize(sz, Image.BICUBIC).crop(((sz[0] - W) // 2, (sz[1] - H) // 2,
                                                       (sz[0] - W) // 2 + W, (sz[1] - H) // 2 + H))
            out = Image.blend(base, e, ease(te / 0.4))
        enc.stdin.write(out.tobytes())
    enc.stdin.close()
    enc.wait()
    for r in readers.values():
        r.close()
    print("silent master:", silent, f"{TOTAL:.2f}s", f"{n_frames} frames")

    final = OUT / "Iqrra_01_Three_Steps.mp4"
    bed = OUT / "bed.wav"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed),
         "-filter_complex", f"[1:a]volume=-1.5dB,afade=t=out:st={TOTAL - 1.4:.2f}:d=1.4[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{TOTAL:.3f}",
         "-movflags", "+faststart", str(final)], check=True)
    print("wrote", final)
    print("timeline:", {k: round(v, 2) for k, v in starts.items()}, "end", round(T_END, 2), "total", round(TOTAL, 2))


if __name__ == "__main__":
    main()
