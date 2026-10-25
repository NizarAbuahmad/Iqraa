#!/usr/bin/env python3
"""Reel 18 — the worksheet reel with a photoreal presenter, 9:16. The presenter is a D-ID Studio clip (her voice and lip-sync come from D-ID:
voice «Sana», Arabic (Jordan)); everything else — the keying, the pause trimming, the layout, the app footage, the captions, the music — is built here.

    python3 make_avatar_real_overlays.py && node render_html.js avatar_real_ov.html overlays_avatar_real 1080 1920
    python3 build_avatar_real.py --clip capture/avatar/sana_test.mp4              # a watermarked trial clip -> ..._DRAFT.mp4
    python3 build_avatar_real.py --clip capture/avatar/sana_final.mp4 --final     # the subscribed, watermark-free clip

The clip: a flat-coloured background (the colour is sampled from its corner and keyed out), a bust that fills the frame's width. The script has ten sentences;
D-ID's voice leaves about a second of silence at every sentence end and 0.3-0.4 s between phrases, which is how the clip is split into sentences (if the
split does not give the script's ten, the sentences are placed by their length and a warning says so). Silences over 0.7 s are cut down to 0.45 s (a jump cut
on a neutral face), which turns a 61 s clip into about 55 s.
Layout (Meta Reels safe zone y 270-1250): chip + lockup on top, the presenter in the upper half on a teal disc and bleeding off both sides, an ink bottom sheet
with the captions, the app phone on the sheet's right edge, the «شخصية افتراضية» tag, the demo pill on generated screens. The sheet hides the bust's straight cut.
"""
import argparse
import multiprocessing as mp
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import build_poster_reel as bp
import music_inspire
from avatar_real_script import SENTENCES
from build_avatar_video import analyse
from reel_lib import FPS, H, HERE, OUT, W, FrameReader, Take, ease

bp.SW, bp.SH = 380, 822
SAND, INK, TEAL, YELLOW = bp.SAND, bp.INK, bp.TEAL, bp.YELLOW
OVD = HERE / "overlays_avatar_real"
CROP = (270, 500, 1620, 1000)                     # x, y, w, h in the 1920x1920 clip: head and shoulders, 0.667x -> 1080x667
BLOCK = (1080, 667)
BLOCK_Y = 330
SHEET_Y = 1000
LONG_GAP, KEEP_GAP = 0.7, 0.22                    # silences above LONG_GAP are cut to 2 x KEEP_GAP
PHONE_C = (850, 1110)
BUB = 360                                         # the presenter's bubble, hero style
BUB_CROP = (700, 540, 760, 760)                   # head and shoulders, square
HERO_PHONE = (560, 1212)                          # the whole 390x844 screen
HERO_C = (650, 1185)
G = {}


# -------------------------------------------------------------------------------------------- the clip
def probe_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         stdout=subprocess.PIPE, check=True).stdout
    return float(out)


def speech_runs(rms):
    thr = max(np.percentile(rms, 97) * 0.05, 1e-4)
    on = np.convolve(rms, np.ones(3) / 3, mode="same") > thr
    runs, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            runs.append([s / FPS, i / FPS]); s = None
    if s is not None:
        runs.append([s / FPS, len(on) / FPS])
    return [r for r in runs if r[1] - r[0] > 0.1]


def sentence_spans(runs, n):
    """Group the speech runs into n sentences at the long silences (>= 0.8 s)."""
    groups = [[runs[0][:]]]
    for r in runs[1:]:
        if r[0] - groups[-1][-1][1] >= 0.8:
            groups.append([r[:]])
        else:
            groups[-1].append(r[:])
    spans = [(g[0][0], g[-1][1]) for g in groups]
    if len(spans) == n:
        return spans, True
    a, b = runs[0][0], runs[-1][1]                          # fall back: by the sentences' lengths
    ln = np.array([len(s["text"]) for s in SENTENCES], float)
    edge = a + (b - a) * np.concatenate([[0], np.cumsum(ln)]) / ln.sum()
    return [(edge[i] + (0.4 if i else 0), edge[i + 1] - 0.4) for i in range(n)], False


def edit_list(runs, total):
    """The kept stretches of the source (seconds): silences longer than LONG_GAP shrink to 2 x KEEP_GAP."""
    keep, a = [], max(0.0, runs[0][0] - 0.25)
    for prev, nxt in zip(runs, runs[1:]):
        if nxt[0] - prev[1] > LONG_GAP:
            keep.append([a, prev[1] + KEEP_GAP]); a = nxt[0] - KEEP_GAP
    keep.append([a, min(total, runs[-1][1] + 0.7)])
    return keep


def remap(t_src, keep):
    """source seconds -> output seconds (None if cut)."""
    o = 0.0
    for a, b in keep:
        if a <= t_src <= b:
            return o + (t_src - a)
        o += b - a
    return None


class ClipReader:
    """The presenter's frames at 30 fps, cropped and scaled, one ffmpeg per kept stretch."""

    def __init__(self, clip, keep, crop=None, size=None):
        self.clip, self.keep = clip, keep
        self.crop, self.size = crop or CROP, size or BLOCK
        self.starts = np.cumsum([0.0] + [b - a for a, b in keep])
        self.proc = self.cur = self.pos = None

    def _open(self, k, frame_in_stretch):
        self.close()
        a, b = self.keep[k]
        x, y, w, h = self.crop
        t0 = a + frame_in_stretch / FPS
        self.proc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", str(self.clip), "-t", f"{b - t0 + 0.2:.3f}",
             "-vf", f"fps={FPS},crop={w}:{h}:{x}:{y},scale={self.size[0]}:{self.size[1]}:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE)
        self.cur, self.pos = k, frame_in_stretch - 1

    def get(self, t_out):
        k = max(0, min(len(self.keep) - 1, int(np.searchsorted(self.starts, t_out, side="right") - 1)))
        want = int(round((t_out - self.starts[k]) * FPS))
        if self.cur != k or self.pos is None or want < self.pos:
            self._open(k, want)
        size = self.size[0] * self.size[1] * 3
        while self.pos < want:
            buf = self.proc.stdout.read(size)
            if len(buf) < size:
                break
            self.frame = np.frombuffer(buf, np.uint8).reshape(self.size[1], self.size[0], 3)
            self.pos += 1
        return self.frame

    def close(self):
        if self.proc:
            self.proc.kill(); self.proc.stdout.close(); self.proc = None


def key(frame, bg):
    """Green-dominance key (G minus the larger of R and B): the sage background is +15..+26 (the watermark's tiles only darken it to +15), skin is -4..-39, the pink
    sweater -7..-13, dark hair mostly negative. Alpha runs from 1 at gdom <= 0 to 0 at gdom >= 14; a green fringe on hair edges is despilled."""
    f = frame.astype(np.float32)
    gd = f[..., 1] - np.maximum(f[..., 0], f[..., 2])
    a = np.clip((14.0 - gd) / 14.0, 0, 1)
    a = a * a * (3 - 2 * a)
    f[..., 1] = np.minimum(f[..., 1], np.maximum(f[..., 0], f[..., 2]))
    out = np.dstack([np.clip(f, 0, 255), a * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def bg_colour(clip):
    x, y, w, h = CROP
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "0.5", "-i", str(clip), "-frames:v", "1", "-vf", f"crop=60:60:{x + 10}:{y + 10}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE, check=True).stdout
    return np.median(np.frombuffer(raw, np.uint8).reshape(-1, 3), axis=0).astype(np.float32)


# -------------------------------------------------------------------------------------------- frames
def setup():
    if G:
        return
    G["takes"] = {n: Take(n) for n in {s[0] for st in SENTENCES for s in st["subs"]}}
    G["readers"] = {}
    G["body"], G["mask"] = bp.phone_sprite()
    G["ov"] = {p.stem: Image.open(p).convert("RGBA") for p in OVD.glob("*.png")}


def background():
    img = Image.new("RGBA", (W, H), SAND + (255,))
    d = ImageDraw.Draw(img)
    cx, cy, r = 540, 640, 470
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=TEAL + (255,))
    d.ellipse((940 - 62, 450 - 62, 940 + 62, 450 + 62), fill=YELLOW + (255,))
    return img


def sheet():
    """A light bottom sheet (paper), with a soft shadow above it, running off the bottom edge."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((0, SHEET_Y - 10, W, H + 80), 56, fill=(11, 27, 51, 70))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
    ImageDraw.Draw(img).rounded_rectangle((0, SHEET_Y, W, H + 80), 56, fill=SAND + (255,))
    return img


def wipe_in(frame, img, x_right, y, tr, dur=0.3, rise=14):
    p = ease(tr / dur)
    if p <= 0:
        return
    vis = max(1, int(img.width * p))
    frame.alpha_composite(img.crop((img.width - vis, 0, img.width, img.height)), (x_right - vis, y + int((1 - p) * rise)))


def render_frame(f):
    setup()
    t = f / FPS
    ctx = G["ctx"]
    if "clip" not in G:
        G["clip"] = ClipReader(ctx["clip"], ctx["keep"])
    spans, keep = ctx["spans"], ctx["spans_out"]
    si = max(i for i, sp in enumerate(spans) if sp[0] <= t + 1e-9)
    s0, s1, sp0, sp1 = spans[si]
    sent = SENTENCES[si]
    frame = G.setdefault("bg", background()).copy()

    # presenter
    block = key(G["clip"].get(t), ctx["bg"])
    frame.alpha_composite(block, (0, BLOCK_Y))
    G.setdefault("sheet", sheet())
    frame.alpha_composite(G["sheet"])

    # the phone, on the sheet's right edge
    n_sub = len(sent["subs"])
    d = (s1 - s0) / n_sub
    k = min(n_sub - 1, int((t - s0) / d))
    sub_t0 = s0 + k * d
    take_n, src, rate, demo = sent["subs"][k]
    key_ = (si, k)
    if key_ not in G["readers"]:
        for r in G["readers"].values():
            r.close()
        G["readers"] = {key_: FrameReader(G["takes"][take_n], src)}
    sc = dict(src=src, rate=rate, cam=(0, 0, 390, 844))
    foot = bp.footage(G["takes"][take_n], G["readers"][key_], sc, t, t - sub_t0)
    if take_n == "r2n_library":
        fade_h = int(foot.height * 0.28)
        grad = Image.new("RGBA", (foot.width, fade_h))
        gp = np.zeros((fade_h, foot.width, 4), np.uint8); gp[..., :3] = (246, 245, 241)
        gp[..., 3] = (np.linspace(0, 1, fade_h) ** 1.4 * 255).astype(np.uint8)[:, None]
        foot.alpha_composite(Image.fromarray(gp, "RGBA"), (0, foot.height - fade_h))
    foot.putalpha(G["mask"])
    ph = G["body"].copy(); ph.alpha_composite(foot, (bp.BZ, bp.BZ))
    pop = bp.back_out(min((t - sub_t0) / 0.3, 1), 1.5)
    kk = 0.92 + 0.08 * pop
    ph = ph.resize((int(ph.width * kk), int(ph.height * kk)), Image.LANCZOS)
    ph = ph.rotate(-3.0 + 0.6 * np.sin(t * 1.6), resample=Image.BICUBIC, expand=True)
    sprite, _ = bp.shadowed(ph)
    bp.paste_center(frame, sprite, PHONE_C[0], PHONE_C[1] + 6 * np.sin(t * 2.0))

    # text
    ov = G["ov"]
    frame.alpha_composite(ov["lk"], (1015 - ov["lk"].width, 276))
    frame.alpha_composite(ov["chip"], (65, 298))
    lk = G.setdefault("lk_big", ov["lk"].resize((int(ov["lk"].width * 1.25), int(ov["lk"].height * 1.25)), Image.LANCZOS))
    frame.alpha_composite(lk, (540 - lk.width // 2, 1560))
    frame.alpha_composite(ov["url"], (540 - ov["url"].width // 2, 1560 + lk.height + 20))
    if demo:
        pill = ov["pill_" + demo]
        frame.alpha_composite(bp.fade(pill, ease((t - sub_t0) / 0.2)), (65, 930))
    lens = np.array([len(c) for c in sent["chunks"]], float)
    edge = sp0 + (sp1 - sp0) * np.concatenate([[0], np.cumsum(lens)]) / lens.sum()
    ci = next((j for j in range(len(lens)) if t < edge[j + 1]), len(lens) - 1)
    t_c = max(s0, edge[ci] - 0.1) if ci else s0
    img = ov[f"c{si}_{ci}"]
    wipe_in(frame, img, 600, 1038, t - t_c)
    if si == len(SENTENCES) - 1:
        q = ease((t - (sp0 + 0.5)) / 0.4)
        if q > 0:
            cta = ov["cta"]
            frame.alpha_composite(bp.fade(cta, q), (65, int(1190 + (1 - q) * 24)))
    return frame.convert("RGB")


def background_hero():
    img = Image.new("RGBA", (W, H), SAND + (255,))
    d = ImageDraw.Draw(img)
    d.ellipse((650 - 540, 1160 - 540, 650 + 540, 1160 + 540), fill=TEAL + (255,))
    d.ellipse((1000 - 54, 700 - 54, 1000 + 54, 700 + 54), fill=YELLOW + (255,))
    return img


def bubble(face):
    """The presenter in a round bubble: her keyed cut-out on teal, a white ring, a soft shadow."""
    circ = Image.new("L", (BUB * 4, BUB * 4), 0)
    ImageDraw.Draw(circ).ellipse((0, 0, BUB * 4 - 1, BUB * 4 - 1), fill=255)
    circ = circ.resize((BUB, BUB), Image.LANCZOS)
    base = Image.new("RGBA", (BUB, BUB), TEAL + (255,))
    base.alpha_composite(face)
    base.putalpha(circ)
    pad = 40
    out = Image.new("RGBA", (BUB + 2 * pad, BUB + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((pad, pad + 14, pad + BUB, pad + BUB + 14), fill=(11, 27, 51, 90))
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    ring = Image.new("RGBA", (BUB + 20, BUB + 20), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((0, 0, BUB + 19, BUB + 19), fill=(255, 255, 255, 255))
    out.alpha_composite(ring, (pad - 10, pad - 10))
    out.alpha_composite(base, (pad, pad))
    return out


def render_frame_hero(f):
    setup()
    t = f / FPS
    ctx = G["ctx"]
    spans = ctx["spans"]
    si = max(i for i, sp in enumerate(spans) if sp[0] <= t + 1e-9)
    s0, s1, sp0, sp1 = spans[si]
    sent = SENTENCES[si]
    frame = G.setdefault("bg_h", background_hero()).copy()

    # the app, big
    n_sub = len(sent["subs"])
    d = (s1 - s0) / n_sub
    k = min(n_sub - 1, int((t - s0) / d))
    sub_t0 = s0 + k * d
    take_n, src, rate, demo = sent["subs"][k]
    key_ = (si, k)
    if key_ not in G["readers"]:
        for r in G["readers"].values():
            r.close()
        G["readers"] = {key_: FrameReader(G["takes"][take_n], src)}
    foot = bp.footage(G["takes"][take_n], G["readers"][key_], dict(src=src, rate=rate, cam=(0, 0, 390, 844)), t, t - sub_t0)
    if take_n == "r2n_library":
        fade_h = int(foot.height * 0.28)
        gp = np.zeros((fade_h, foot.width, 4), np.uint8); gp[..., :3] = (246, 245, 241)
        gp[..., 3] = (np.linspace(0, 1, fade_h) ** 1.4 * 255).astype(np.uint8)[:, None]
        foot.alpha_composite(Image.fromarray(gp, "RGBA"), (0, foot.height - fade_h))
    foot.putalpha(G["mask"])
    ph = G["body"].copy(); ph.alpha_composite(foot, (bp.BZ, bp.BZ))
    notch = Image.new("RGBA", ph.size, (0, 0, 0, 0))
    ImageDraw.Draw(notch).rounded_rectangle((ph.width // 2 - 70, bp.BZ + 14, ph.width // 2 + 70, bp.BZ + 46), 16, fill=INK + (255,))
    ph.alpha_composite(notch)
    pop = bp.back_out(min((t - sub_t0) / 0.3, 1), 1.5)
    kk = 0.95 + 0.05 * pop
    ph = ph.resize((int(ph.width * kk), int(ph.height * kk)), Image.LANCZOS)
    ph = ph.rotate(-1.5 + 0.5 * np.sin(t * 1.5), resample=Image.BICUBIC, expand=True)
    sprite, _ = bp.shadowed(ph)
    bp.paste_center(frame, sprite, HERO_C[0], HERO_C[1] + 6 * np.sin(t * 2.0))

    # the presenter, small, in the lower-left corner
    if "bub" not in G:
        G["bub"] = ClipReader(ctx["clip"], ctx["keep"], crop=BUB_CROP, size=(BUB, BUB))
    pop_b = bp.back_out(min(t / 0.5, 1), 1.6)
    bb = bubble(key(G["bub"].get(t), ctx["bg"]))
    sc_ = 0.6 + 0.4 * pop_b
    if sc_ < 0.999:
        bb = bb.resize((int(bb.width * sc_), int(bb.height * sc_)), Image.LANCZOS)
    bp.paste_center(frame, bb, 40 + bb.width // 2 - 20, 1010 + 6 * np.sin(t * 1.8))

    # text
    ov = G["ov"]
    frame.alpha_composite(ov["lk"], (1015 - ov["lk"].width, 276))
    frame.alpha_composite(ov["chip"], (65, 298))
    if demo:
        pill = G.setdefault("pill_h_" + demo, ov["pill_" + demo].resize((int(ov["pill_" + demo].width * 0.8), int(ov["pill_" + demo].height * 0.8)), Image.LANCZOS))
        frame.alpha_composite(bp.fade(pill, ease((t - sub_t0) / 0.2)), (40, 770))        # above the bubble, left of the phone
    lens = np.array([len(c) for c in sent["chunks"]], float)
    edge = sp0 + (sp1 - sp0) * np.concatenate([[0], np.cumsum(lens)]) / lens.sum()
    ci = next((j for j in range(len(lens)) if t < edge[j + 1]), len(lens) - 1)
    t_c = max(s0, edge[ci] - 0.1) if ci else s0
    wipe_in(frame, ov[f"h{si}_{ci}"], 1015, 410, t - t_c)
    if si == len(SENTENCES) - 1:
        q = ease((t - (sp0 + 0.5)) / 0.4)
        if q > 0:
            cta = ov["cta"]
            frame.alpha_composite(bp.fade(cta, q), (1015 - cta.width, int(1235 + (1 - q) * 24)))
    return frame.convert("RGB")


def render_chunk(args):
    n, f0, f1, ctx = args
    G.clear(); setup(); G["ctx"] = ctx
    render = render_frame_hero if ctx.get("style") == "hero" else render_frame
    path = OUT / f"_ar_{n}.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "60",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", str(path)], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        enc.stdin.write(render(f).tobytes())
    enc.stdin.close(); enc.wait()
    return str(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clip", required=True, help="the D-ID clip (flat background, bust filling the width)")
    ap.add_argument("--final", action="store_true", help="a watermark-free clip: names the file Iqrra_18_Worksheet_Presenter.mp4 instead of ..._DRAFT")
    ap.add_argument("--style", choices=["sheet", "hero"], default="sheet", help="sheet: the presenter on top, captions below; hero: the app recording is the hero, the presenter a small bubble")
    ap.add_argument("--sample", type=float, default=0, help="seconds of video to render (a smoke test)")
    a = ap.parse_args()

    rms, _ = analyse(a.clip)
    runs = speech_runs(rms)
    spans_src, exact = sentence_spans(runs, len(SENTENCES))
    if not exact:
        print("WARNING: the pauses did not give", len(SENTENCES), "sentences; sentences were placed by their lengths")
    total_src = probe_dur(a.clip)
    keep = edit_list(runs, total_src)
    total = sum(b - a_ for a_, b in keep)
    # sentence spans on the output timeline
    out_spans = []
    for i, (a_, b_) in enumerate(spans_src):
        o0 = remap(a_, keep); o1 = remap(b_, keep)
        out_spans.append((o0 if o0 is not None else 0.0, o1 if o1 is not None else total))
    spans = []
    for i, (o0, o1) in enumerate(out_spans):
        s0 = 0.0 if i == 0 else (out_spans[i - 1][1] + o0) / 2
        e0 = total if i == len(out_spans) - 1 else (o1 + out_spans[i + 1][0]) / 2
        spans.append((s0, e0, o0, o1))
    ctx = dict(clip=str(a.clip), keep=keep, spans=spans, spans_out=out_spans, bg=bg_colour(a.clip), style=a.style)
    if a.style == "hero":
        bp.SW, bp.SH = HERO_PHONE
    print(f"source {total_src:.1f}s -> {total:.1f}s; keep {[(round(x, 1), round(y, 1)) for x, y in keep]}")
    print("sentences:", [(round(s[0], 1), round(s[1], 1)) for s in spans], "bg", ctx["bg"])

    n = int(round(total * FPS))
    if a.sample:
        n = min(n, int(a.sample * FPS))
    parts = 1 if a.sample else 4
    bounds = [(i, n * i // parts, n * (i + 1) // parts, ctx) for i in range(parts)]
    with mp.get_context("fork").Pool(parts) as pool:
        files = pool.map(render_chunk, bounds)
    if a.sample:
        print("sample:", files[0]); return
    lst = OUT / "_ar_list.txt"
    lst.write_text("\n".join(f"file '{p}'" for p in files))
    silent = OUT / "_ar_silent.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)], check=True)

    # the voice: the kept stretches joined with 25 ms fades, loudness-normalised; the music bed under it
    parts_f = []
    for i, (x, y) in enumerate(keep):
        parts_f.append(f"[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.025,afade=t=out:st={max(0, y - x - 0.025):.3f}:d=0.025[v{i}]")
    cat = "".join(f"[v{i}]" for i in range(len(keep))) + f"concat=n={len(keep)}:v=0:a=1[voice]"
    voice = OUT / "_ar_voice.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(a.clip), "-filter_complex", ";".join(parts_f + [cat]), "-map", "[voice]", "-ac", "2", "-ar", "44100", str(voice)], check=True)
    bed = OUT / "_ar_music.wav"
    music_inspire.render(bed, total, hits=[sp[0] for sp in spans[1:]], end=spans[-1][2])
    base = "Iqrra_18_Worksheet_Presenter" if a.style == "sheet" else "Iqrra_18b_Worksheet_App_Hero"
    name = f"{base}.mp4" if a.final else f"{base}_DRAFT.mp4"
    final = OUT / name
    flt = (f"[1:a]volume=-21dB,afade=t=out:st={total - 1.2:.2f}:d=1.2[m];[2:a]loudnorm=I=-16:TP=-1.5:LRA=9[v];[m][v]amix=inputs=2:normalize=0:duration=first[a]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed), "-i", str(voice), "-filter_complex", flt, "-map", "0:v", "-map", "[a]",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}", "-movflags", "+faststart", str(final)], check=True)
    for p in files + [str(lst), str(silent), str(voice), str(bed)]:
        __import__("os").unlink(p)
    print("wrote", final)


if __name__ == "__main__":
    main()
