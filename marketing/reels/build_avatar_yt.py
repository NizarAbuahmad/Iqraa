#!/usr/bin/env python3
"""Reel 17 — «معلّمة اقرأ» presents the full tour, 16:9 for YouTube, voice-over by a recording you supply.

    python3 make_avatar.py && node render_html.js avatar.html overlays_avatar 720 800          # once (shared with Reel 16)
    python3 make_avatar_yt_overlays.py && node render_html.js avatar_yt_ov.html overlays_avatar_yt 1920 1080
    python3 build_avatar_yt.py --audio voice.m4a        # the real thing
    python3 build_avatar_yt.py                          # PREVIEW: placeholder mouth timing, music only, no voice

The same host, voice analysis, beat splitting and honesty rules as Reel 16 (build_avatar_video.py); a different layout and script:
the host on the left (the blazer runs off the bottom edge), the phone large in the middle on its teal disc, the beat's title and
caption phrases in the right column, a Jordanian-app chip and the virtual-presenter tag on every frame, a progress rail. The footage
is the YouTube tour's reviewed windows (youtube_chapters.py), several per beat when the beat is long enough to show them. The last
beat clears the phone and puts the offer in the right column.
Also writes out/avatar_yt_chapters.txt (YouTube chapters, merged so each is at least 10 s).
"""
import argparse
import multiprocessing as mp
import subprocess

import numpy as np
from PIL import Image, ImageDraw

import build_avatar_video as bav
import build_poster_reel as bp
import build_youtube as yt
import music_inspire
from avatar_yt_script import BEATS, beat_subs
from reel_lib import FPS, HERE, OUT, FrameReader, Take, ease

W, H = 1920, 1080
bp.SW, bp.SH = yt.SW, yt.SH                           # 442 x 957: the whole screen, big
SAND, INK, TEAL, YELLOW = bp.SAND, bp.INK, bp.TEAL, bp.YELLOW
OVD = HERE / "overlays_avatar_yt"
SCALE = 0.98
HOST_XY = (10, H - int(800 * SCALE))                   # the canvas bottom is the frame bottom
PH_C = (930, 548)
COL_R = 1860
MIN_SUB = 2.2                                          # no screen is shown for less than this
G = {}


def setup():
    if G:
        return
    G["takes"] = {n: Take(n) for n in {s[0] for b in BEATS for s in beat_subs(b)}}
    G["readers"] = {}
    G["body"], G["mask"] = bp.phone_sprite()
    G["layers"] = bav.load_layers()
    G["ov"] = {p.stem: Image.open(p).convert("RGBA") for p in OVD.glob("*.png")}


def pick_subs(beat, dur):
    subs = beat_subs(beat)
    n = min(len(subs), max(1, int(dur / MIN_SUB)))
    if n == len(subs):
        return subs
    idx = [round(k * (len(subs) - 1) / (n - 1)) for k in range(n)] if n > 1 else [0]
    return [subs[i] for i in idx]


def wipe_in(frame, img, x_right, y, tr, dur=0.35, rise=18):
    p = ease(tr / dur)
    if p <= 0:
        return
    vis = max(1, int(img.width * p))
    frame.alpha_composite(img.crop((img.width - vis, 0, img.width, img.height)), (x_right - vis, y + int((1 - p) * rise)))


def background(grow):
    img = Image.new("RGBA", (W, H), SAND + (255,))
    d = ImageDraw.Draw(img)
    cx = int(PH_C[0] + (1390 - PH_C[0]) * grow); cy = 540; r = int(480 + 70 * grow)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=TEAL + (255,))
    return img


def render_frame(f):
    setup()
    t = f / FPS
    ctx = G["ctx"]
    spans, shapes, rms, blinks = ctx["spans"], ctx["shapes"], ctx["rms"], ctx["blinks"]
    bi = max(i for i, sp in enumerate(spans) if sp[0] <= t + 1e-9)
    bs, be, s, e = spans[bi]
    beat = BEATS[bi]
    last = bi == len(BEATS) - 1
    grow = ease((t - bs) / 0.6) if last else 0.0
    frame = background(grow)
    ov = G["ov"]

    # the phone: pops on every new screen, leaves for the offer
    subs = pick_subs(beat, be - bs)
    d = (be - bs) / len(subs)
    si = min(len(subs) - 1, int((t - bs) / d))
    sub_t0 = bs + si * d
    take_n, src, rate, demo, crop = subs[si]
    sc = dict(src=src, rate=rate, crop=crop)
    key = (bi, si)
    if key not in G["readers"]:
        for r in G["readers"].values():
            r.close()
        G["readers"] = {key: FrameReader(G["takes"][take_n], src)}
    foot = yt.footage(G["takes"][take_n], G["readers"][key], sc, t - sub_t0)
    foot.putalpha(G["mask"])
    ph = G["body"].copy(); ph.alpha_composite(foot, (bp.BZ, bp.BZ))
    notch = Image.new("RGBA", ph.size, (0, 0, 0, 0))
    ImageDraw.Draw(notch).rounded_rectangle((ph.width // 2 - 56, bp.BZ + 12, ph.width // 2 + 56, bp.BZ + 38), 13, fill=INK + (255,))
    ph.alpha_composite(notch)
    pop = bp.back_out(min((t - sub_t0) / 0.3, 1), 1.5)
    k = 0.95 + 0.05 * pop
    if k < 0.9995:
        ph = ph.resize((int(ph.width * k), int(ph.height * k)), Image.LANCZOS)
    ph = ph.rotate(-2.0 + 0.5 * np.sin(t * 1.5), resample=Image.BICUBIC, expand=True)
    ph_a = 1 - grow
    if ph_a > 0.01:
        sprite, _ = bp.shadowed(ph)
        bp.paste_center(frame, bp.fade(sprite, ph_a), PH_C[0], PH_C[1] + 7 * np.sin(t * 2.0))

    # the host: the yellow disc behind her head, the blazer off the bottom edge
    gi = min(int(t * FPS), len(shapes) - 1)
    w_a, p_a = bav.gesture_arms(bi, t, spans[bi], BEATS)
    en = float(rms[min(gi, len(rms) - 1)])
    brows = max(0.0, np.sin(t * 3.3)) * min(1.0, en * 1.5) if s - 0.1 <= t <= e else 0.0
    hs = bav.host_sprite(t, shapes[gi], en, bav.blink_closed(t, blinks), w_a, p_a, brows, scale=SCALE, layers=G["layers"])
    hx, hy = HOST_XY[0], HOST_XY[1] + int(3 * np.sin(t * 1.9))
    ya = 1 - grow
    if ya > 0.01:
        r = 235
        disc = Image.new("RGBA", (2 * r, 2 * r), (0, 0, 0, 0))
        ImageDraw.Draw(disc).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=YELLOW + (255,))
        frame.alpha_composite(bp.fade(disc, ya), (int(hx + 300 * SCALE - r), int(hy + 300 * SCALE - r)))
    ImageDraw.Draw(frame).rectangle((hx + int(70 * SCALE), hy + hs.height - 2, hx + int(530 * SCALE), H), fill=(11, 27, 51, 255))
    frame.alpha_composite(hs, (hx, hy))

    # text: lockup, Jordanian chip, presenter tag on every frame; title + captions in the right column
    frame.alpha_composite(ov["lk"], (COL_R - ov["lk"].width, 36))
    frame.alpha_composite(ov["chip"], (60, 52))
    frame.alpha_composite(ov["tag"], (60, 124))
    if not last:
        wipe_in(frame, ov[f"t{bi}"], COL_R, 190, t - bs)
        n_ch = len(beat["chunks"])
        lens = np.array([len(c) for c in beat["chunks"]], float)
        edge = s + (e - s) * np.concatenate([[0], np.cumsum(lens)]) / lens.sum()
        ci = next((j for j in range(n_ch) if t < edge[j + 1]), n_ch - 1)
        t_c = max(bs + 0.2, edge[ci] - 0.12) if ci else bs + 0.2
        wipe_in(frame, ov[f"c{bi}_{ci}"], COL_R, 372, t - t_c)
        if demo:
            pill = ov["pill_" + demo]
            frame.alpha_composite(bp.fade(pill, ease((t - sub_t0) / 0.2)), (COL_R - pill.width, 900))
        # progress rail: one segment per beat (the last, the offer, is not counted)
        nseg, gap = len(BEATS) - 1, 8
        segw = (640 - gap * (nseg - 1)) // nseg
        rail = Image.new("RGBA", (640, 14), (0, 0, 0, 0)); rd = ImageDraw.Draw(rail)
        for i in range(nseg):
            x0 = 640 - (i + 1) * segw - i * gap
            rd.rounded_rectangle((x0, 0, x0 + segw, 14), 7, fill=(INK + (255,)) if i <= bi else (11, 27, 51, 50))
        frame.alpha_composite(rail, (COL_R - 640, 1010))
    else:
        yy = 210
        for j in range(len(beat["chunks"])):
            img = ov[f"e{bi}_{j}"]
            t_c = s + (e - s) * j / len(beat["chunks"])
            wipe_in(frame, img, COL_R, yy, t - t_c)
            yy += img.height + 6
        q = ease((t - (bs + 0.9)) / 0.4)
        if q > 0:
            cta = ov["cta"]
            frame.alpha_composite(bp.fade(cta, q), (COL_R - cta.width, int(yy + 30 + (1 - q) * 24)))
    return frame.convert("RGB")


def render_chunk(args):
    n, f0, f1, ctx = args
    G.clear(); setup(); G["ctx"] = ctx
    path = OUT / f"_ay_{n}.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "60",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", str(path)], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        enc.stdin.write(render_frame(f).tobytes())
    enc.stdin.close(); enc.wait()
    return str(path)


def chapters(spans):
    """YouTube chapters from the beats' groups, merging any group shorter than 10 s into the next one."""
    out = []
    for i, b in enumerate(BEATS):
        g = b["group"]
        if out and out[-1][0] == g:
            continue
        out.append([g, spans[i][0]])
    ends = [c[1] for c in out[1:]] + [spans[-1][1]]
    merged = []
    for (g, t0), t1 in zip(out, ends):
        if merged and (t0 - merged[-1][1]) < 10:
            continue
        merged.append([g, t0])
    # drop a short tail: the last chapter must also be at least 10 s
    if len(merged) > 1 and spans[-1][1] - merged[-1][1] < 10:
        merged.pop()
    return [f"{int(t // 60)}:{int(t % 60):02d} {g}" for g, t in merged]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", help="the voice recording; without it a placeholder-timed PREVIEW is made")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    lead = bav.LEAD
    if a.audio:
        rms, cen = bav.analyse(a.audio)
        rms = np.concatenate([np.zeros(int(lead * FPS)), rms]); cen = np.concatenate([np.zeros(int(lead * FPS)), cen])
        segs, exact = bav.speech_segments(rms, len(BEATS), BEATS)
        if not exact:
            print("WARNING: the pauses in the recording did not give exactly", len(BEATS), "beats; beats were placed by word count")
    else:
        rms, cen = bav.placeholder(BEATS)
        segs = bav.placeholder_segments(BEATS)
    spans = bav.build_timeline(segs)
    total = spans[-1][1]
    n = int(round(total * FPS))
    shapes, rn = bav.mouth_track(rms, cen, n)
    rng = np.random.default_rng(9)
    blinks, t = [], 1.2
    while t < total:
        blinks.append(t); t += rng.uniform(2.6, 4.6)
    ctx = dict(spans=spans, shapes=shapes, rms=rn, blinks=blinks)
    print("beats:", [(BEATS[i]["key"], round(sp[0], 1)) for i, sp in enumerate(spans)], f"total {total:.1f}s")

    parts = 4
    bounds = [(i, n * i // parts, n * (i + 1) // parts, ctx) for i in range(parts)]
    with mp.get_context("fork").Pool(parts) as pool:
        files = pool.map(render_chunk, bounds)
    lst = OUT / "_ay_list.txt"
    lst.write_text("\n".join(f"file '{p}'" for p in files))
    silent = OUT / "_ay_silent.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)], check=True)

    bed = OUT / "_ay_music.wav"
    music_inspire.render(bed, total, hits=[sp[0] for sp in spans[1:]], end=spans[-1][0])
    name = a.out or ("Iqrra_17_Avatar_Host_YouTube.mp4" if a.audio else "Iqrra_17_Avatar_Host_YouTube_PREVIEW.mp4")
    final = OUT / name
    if a.audio:
        flt = (f"[1:a]volume=-21dB,afade=t=out:st={total - 1.4:.2f}:d=1.4[m];"
               f"[2:a]loudnorm=I=-16:TP=-1.5:LRA=9,adelay={int(lead * 1000)}|{int(lead * 1000)},apad[v];"
               f"[m][v]amix=inputs=2:normalize=0:duration=first[a]")
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed), "-i", a.audio, "-filter_complex", flt]
    else:
        flt = f"[1:a]volume=-8dB,afade=t=out:st={total - 1.4:.2f}:d=1.4[a]"
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed), "-filter_complex", flt]
    subprocess.run(cmd + ["-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}",
                          "-movflags", "+faststart", str(final)], check=True)
    for p in files + [str(lst), str(silent), str(bed)]:
        __import__("os").unlink(p)
    (OUT / "avatar_yt_chapters.txt").write_text("\n".join(chapters(spans)) + "\n")
    print("wrote", final)
    print("\n".join(chapters(spans)))


if __name__ == "__main__":
    main()
