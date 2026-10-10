"""Compositor for the phone-footage reels (2-4).

Footage is a screen take recorded by capture/rec.cjs from the real app in a 390x844 phone viewport,
plus a log of every pointer move / tap. Cameras are expressed in CSS pixels of that viewport, so a crop
reads the same whatever the capture scale. The layout matches Reel 1: headline in the top safe zone,
the app in a rounded card, optional chip / demo pill, branded end card, music bed.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
TAKES = HERE / "capture" / "takes"
OV = HERE / "overlays"
OUT = HERE / "out"
W, H, FPS = 1080, 1920, 30
VIEW_W, VIEW_H = 390, 844                   # the recorded viewport, CSS px
BOX_W, BOX_H = 900, 840                     # the card is fitted inside this box
BOX_CX, BOX_CY = 510, 1062                  # x 60..960 (clear of the Reels action rail), y 642..1482
RADIUS = 38
NAVY = (8, 27, 58)
AQUA = (52, 214, 198)
XFADE = 0.1
HEAD_X, HEAD_Y = 60, 290


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ffprobe_size(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(path)])
    w, h = out.decode().strip().split(",")
    return int(w), int(h)


class Take:
    def __init__(self, name):
        self.name = name
        self.mp4 = TAKES / f"{name}.mp4"
        self.events = json.loads((TAKES / f"{name}.events.json").read_text())
        self.w, self.h = ffprobe_size(self.mp4)
        self.k = self.w / VIEW_W                 # frame px per CSS px
        self.moves = [(e["t"], e["x"], e["y"]) for e in self.events if e["type"] == "move"]
        self.taps = [(e["t"], e["x"], e["y"]) for e in self.events if e["type"] == "tap"]
        self.marks = {e["label"]: e["t"] for e in self.events if e["type"] == "mark"}

    def pointer(self, t):
        """(x, y, idle_seconds) of the pointer at take time t, or None before its first move."""
        last = None
        for mt, x, y in self.moves:
            if mt <= t:
                last = (mt, x, y)
            else:
                break
        return None if last is None else (last[1], last[2], t - last[0])


class FrameReader:
    def __init__(self, take, t0):
        self.take, self.t0, self.idx, self.frame = take, t0, -1, None
        self.size = take.w * take.h * 3
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", str(take.mp4), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE)

    def get(self, t):
        want = max(0, round((t - self.t0) * FPS))
        while self.idx < want:
            buf = self.proc.stdout.read(self.size)
            if len(buf) < self.size:
                break
            self.frame = Image.frombuffer("RGB", (self.take.w, self.take.h), buf, "raw", "RGB", 0, 1)
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
        base += (np.clip(1 - d, 0, 1) ** 2 * a)[..., None] * (np.array(col, np.float32) - base)
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB")


_mask, _shadow = {}, {}


def card_mask(w, h):
    if (w, h) not in _mask:
        s = 3
        m = Image.new("L", (w * s, h * s), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, w * s - 1, h * s - 1), RADIUS * s, fill=255)
        _mask[(w, h)] = m.resize((w, h), Image.LANCZOS)
    return _mask[(w, h)]


def card_shadow(w, h):
    if (w, h) not in _shadow:
        pad = 70
        m = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
        ImageDraw.Draw(m).rounded_rectangle((pad, pad + 18, pad + w, pad + 18 + h), RADIUS, fill=150)
        _shadow[(w, h)] = (m.filter(ImageFilter.GaussianBlur(26)), pad)
    return _shadow[(w, h)]


def ripple(card, cx, cy, p, scale):
    if not 0 <= p <= 1:
        return
    s, R = 3, int(115 * scale / 2)
    R = max(R, 70)
    patch = Image.new("RGBA", (2 * R * s, 2 * R * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(patch)
    c = R * s
    for delay, width in ((0.0, 7), (0.22, 4)):
        q = (p - delay) / (1 - delay)
        if q <= 0:
            continue
        r = (14 + (R - 22) * ease(q)) * s
        d.ellipse((c - r, c - r, c + r, c + r), outline=AQUA + (int(235 * (1 - q) ** 1.4),), width=int(width * s))
    r0 = 12 * s * (1 - 0.4 * p)
    d.ellipse((c - r0, c - r0, c + r0, c + r0), fill=AQUA + (int(150 * (1 - p)),))
    card.alpha_composite(patch.resize((2 * R, 2 * R), Image.LANCZOS), (int(cx - R), int(cy - R)))


_cursor = {}


def cursor_sprite(size):
    """Arrow pointer, black with a white edge; tip at (0, 0) of the returned image."""
    if size not in _cursor:
        s = 4
        pts = [(0, 0), (0, 17), (4.2, 13.2), (7, 19.5), (9.6, 18.3), (6.8, 12.2), (12, 12)]
        k = size / 20 * s
        img = Image.new("RGBA", (int(16 * k) + 8, int(22 * k) + 8), (0, 0, 0, 0))
        poly = [(4 + x * k, 4 + y * k) for x, y in pts]
        d = ImageDraw.Draw(img)
        d.polygon(poly, fill=(255, 255, 255, 255), outline=(255, 255, 255, 255), width=int(3.2 * s))
        d.polygon(poly, fill=(14, 22, 38, 255))
        _cursor[size] = img.resize((img.width // s, img.height // s), Image.LANCZOS)
    return _cursor[size]


def camera(cam, t):
    if t <= cam[0][0]:
        return cam[0][1]
    for (ta, a), (tb, b) in zip(cam, cam[1:]):
        if t <= tb:
            k = ease((t - ta) / (tb - ta)) if tb > ta else 1
            return tuple(x + (y - x) * k for x, y in zip(a, b))
    return cam[-1][1]


def render_scene(sc, take, reader, bg, t_rel):
    t_src = sc["src"] + sc["rate"] * t_rel
    if "src_end" in sc:
        t_src = min(t_src, sc["src_end"])
    src = reader.get(t_src)
    x, y, w, h = camera(sc["cam"], t_rel)
    x = min(max(x, 0), VIEW_W - w); y = min(max(y, 0), VIEW_H - h)
    k = take.k
    scale = min(BOX_W / w, BOX_H / h)
    cw, ch = int(round(w * scale)), int(round(h * scale))
    foot = src.resize((cw, ch), Image.LANCZOS, box=(x * k, y * k, (x + w) * k, (y + h) * k)).convert("RGBA")

    def to_card(px, py):
        return (px - x) * scale, (py - y) * scale

    for tt, tx, ty in take.taps:
        cx, cy = to_card(tx, ty)
        ripple(foot, cx, cy, (t_src - tt) / 0.8, scale)
    ptr = take.pointer(t_src) if sc.get("pointer", True) else None
    if ptr is not None:
        px, py, idle = ptr
        a = 1 - ease((idle - 1.1) / 0.5)
        if a > 0.02:
            spr = cursor_sprite(max(18, int(22 * scale / 2.0)))
            if a < 0.999:
                spr = spr.copy(); spr.putalpha(spr.getchannel("A").point(lambda v: int(v * a)))
            cx, cy = to_card(px, py)
            foot.alpha_composite(spr, (int(cx - 4), int(cy - 4)))

    pop = 0.955 + 0.045 * ease(t_rel / 0.18)
    pw, ph = int(cw * pop), int(ch * pop)
    if pop < 0.9999:
        foot = foot.resize((pw, ph), Image.LANCZOS)
    left, top = BOX_CX - pw // 2, BOX_CY - ph // 2
    frame = bg.copy().convert("RGBA")
    sh, pad = card_shadow(pw, ph)
    shadow = Image.new("RGBA", sh.size, (2, 8, 20, 0)); shadow.putalpha(sh)
    frame.alpha_composite(shadow, (left - pad, top - pad))
    frame.paste(foot, (left, top), card_mask(pw, ph))
    edge = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle((0, 0, pw - 1, ph - 1), RADIUS, outline=(255, 255, 255, 46), width=2)
    frame.alpha_composite(edge, (left, top))
    return frame


def build(cfg):
    """cfg: name, take, scenes[], overlays[], end, music, out.

    scene   : dict(src, rate, dur, cam=[(t_rel,(x,y,w,h))], src_end?, pointer?)
    overlay : dict(png, on, off, kind='head'|'chip'|'pill', y?)
    """
    take = Take(cfg["take"])
    t = 0.0
    for s in cfg["scenes"]:
        s["t0"] = t
        t += s["dur"]
    t_end = t
    total = t_end + cfg.get("end_dur", 3.7)
    imgs = {o["png"]: Image.open(OV / f"{o['png']}.png").convert("RGBA") for o in cfg["overlays"]}
    end_img = Image.open(OV / f"{cfg['end']}.png").convert("RGB")
    bg = background()
    OUT.mkdir(exist_ok=True)
    silent = OUT / f"_{cfg['name']}_silent.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", str(silent)],
        stdin=subprocess.PIPE)
    readers, last, prev_last, cur = {}, {}, None, -1
    n = int(round(total * FPS))
    for f in range(n):
        tt = f / FPS
        if tt < t_end:
            idx = max(i for i, s in enumerate(cfg["scenes"]) if s["t0"] <= tt + 1e-9)
            sc = cfg["scenes"][idx]
            if idx != cur:
                if cur >= 0:
                    prev_last = last[cur]
                    readers.pop(cur).close()
                cur = idx
                readers[idx] = FrameReader(take, sc["src"])
            t_rel = tt - sc["t0"]
            frame = render_scene(sc, take, readers[idx], bg, t_rel)
            last[idx] = frame
            if prev_last is not None and t_rel < XFADE:
                frame = Image.blend(prev_last, frame, ease(t_rel / XFADE))
            for o in cfg["overlays"]:
                first = o.get("first", False)
                a_in = 1.0 if first else ease((tt - o["on"]) / 0.16)
                a = min(a_in, ease((o["off"] - tt) / 0.08))
                if a <= 0.003:
                    continue
                dy = 0 if first else (1 - ease((tt - o["on"]) / 0.26)) * 22
                img = imgs[o["png"]]
                if a < 0.999:
                    img = img.copy(); img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
                if o["kind"] == "head":
                    pos = (HEAD_X, HEAD_Y)
                elif o["kind"] == "chip":
                    pos = (960 - img.width, o["y"])
                else:
                    pos = (960 - img.width, 1484)
                frame.alpha_composite(img, (int(pos[0]), int(pos[1] - dy)))
            out = frame.convert("RGB")
        else:
            te = tt - t_end
            base = last[cur].convert("RGB")
            z = 1.0 + 0.035 * min(te / cfg.get("end_dur", 3.7), 1)
            sz = (int(W * z), int(H * z))
            e = end_img.resize(sz, Image.BICUBIC)
            e = e.crop(((sz[0] - W) // 2, (sz[1] - H) // 2, (sz[0] - W) // 2 + W, (sz[1] - H) // 2 + H))
            out = Image.blend(base, e, ease(te / 0.4))
        enc.stdin.write(out.tobytes())
    enc.stdin.close(); enc.wait()
    for r in readers.values():
        r.close()
    final = OUT / cfg["out"]
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(OUT / "bed.wav"),
         "-filter_complex", f"[1:a]volume=-1.5dB,afade=t=out:st={total - 1.4:.2f}:d=1.4[a]",
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}",
         "-movflags", "+faststart", str(final)], check=True)
    silent.unlink()
    print("wrote", final, f"{total:.2f}s", "scene starts:", [round(s["t0"], 2) for s in cfg["scenes"]], "end at", round(t_end, 2))
