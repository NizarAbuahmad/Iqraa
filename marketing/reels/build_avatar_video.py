#!/usr/bin/env python3
"""Reel 16 — «معلّمة اقرأ»: an illustrated virtual teacher presents the app, 9:16, voice-over by a recording you supply.

    python3 make_avatar.py && node render_html.js avatar.html overlays_avatar 720 800
    python3 make_avatar_overlays.py && node render_html.js avatar_ov.html overlays_avatar_ov 1080 1920
    python3 build_avatar_video.py --audio voice.m4a            # the real thing
    python3 build_avatar_video.py                              # PREVIEW: placeholder mouth timing, music only, no voice

What the voice drives
  * the mouth (6 shapes) from the loudness and brightness of the recording, blinks, a small head bob and nods on loud peaks;
  * the beats: the recording is split into the script's 9 beats at its pauses (>= 0.45 s of quiet). If the pauses do not
    give exactly 9 beats, the beats are placed in proportion to their word counts and a warning says so;
  * the captions, the footage behind each beat and the gestures (a wave, then a point at the phone on every new screen).
Layout (1080x1920, Meta Reels safe zone y 270-1250 / x 65-1015): chip + lockup on top, a caption under them, the host on the
left, the phone on the right. The last beat centres the host over the offer.
Voice and music: the voice is loudness-normalised, the music bed (music_inspire) sits ~21 dB under it.
"""
import argparse
import multiprocessing as mp
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import build_poster_reel as bp
import music_inspire
from avatar_script import BEATS, words
from reel_lib import FPS, H, HERE, OUT, W, FrameReader, Take, ease

bp.SW, bp.SH = 330, 714                                # the whole 390x844 screen
SW, SH = bp.SW, bp.SH
SAND, INK, TEAL, YELLOW = bp.SAND, bp.INK, bp.TEAL, bp.YELLOW
AV = HERE / "overlays_avatar"
OVD = HERE / "overlays_avatar_ov"
LEAD, TAIL = 0.6, 1.5                                  # silence before the first word / after the last
SCALE = 0.9                                            # host sprite scale
HOST_XY = (10, 640)                                    # host canvas top-left, beats 1-8
HOST_XY_END = (216, 585)                               # centred over the offer in the last beat
PH_C = (815, 968)
G = {}


# ----------------------------------------------------------------------------------------------- the voice
def analyse(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         stdout=subprocess.PIPE, check=True).stdout
    x = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    hop = 16000 // FPS
    n = len(x) // hop
    rms = np.zeros(n); cen = np.zeros(n)
    f = np.fft.rfftfreq(512, 1 / 16000)
    for i in range(n):
        seg = x[i * hop:(i + 1) * hop]
        rms[i] = np.sqrt(np.mean(seg ** 2)) if len(seg) else 0
        w = x[i * hop:i * hop + 512]
        if len(w) == 512 and rms[i] > 1e-4:
            m = np.abs(np.fft.rfft(w * np.hanning(512)))
            cen[i] = (m * f).sum() / max(m.sum(), 1e-9)
    return rms, cen


def placeholder(beats=BEATS):
    """A made-up envelope: syllable pulses per beat, a short pause between phrases, 0.9 s between beats."""
    rng = np.random.default_rng(5)
    env = []
    for b in beats:
        for j, c in enumerate(b["chunks"]):
            n = int(len(c.split()) / 2.6 * FPS)
            t = np.arange(n) / FPS
            pulse = 0.5 + 0.5 * np.sin(2 * np.pi * 4.6 * t + rng.uniform(0, 6))
            amp = rng.uniform(0.35, 1.0, size=n // 4 + 1).repeat(4)[:n]
            env += list(pulse * amp * (rng.random(n) > 0.08))
            env += [0.0] * int(0.18 * FPS)
        env += [0.0] * int(0.7 * FPS)
    env = np.array([0.0] * int(LEAD * FPS) + env + [0.0] * int(TAIL * FPS))
    return env * 0.1, None


def speech_segments(rms, nbeats, beats=BEATS):
    """Split the recording into nbeats runs of speech at its pauses. Returns [(start, end)] in seconds, and whether it was exact."""
    thr = max(np.percentile(rms[rms > 1e-5], 35) if (rms > 1e-5).any() else 0, np.percentile(rms, 97) * 0.06)
    k = np.convolve(rms, np.ones(3) / 3, mode="same")
    on = k > thr
    segs, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            segs.append([s, i]); s = None
    if s is not None:
        segs.append([s, len(on)])
    segs = [x for x in segs if x[1] - x[0] > 3]
    gap = int(0.45 * FPS)
    merged = [segs[0][:]]
    for a, b in segs[1:]:
        if a - merged[-1][1] < gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    exact = len(merged) == nbeats
    while len(merged) > nbeats:                      # too many pauses: join across the shortest gap
        gaps = [merged[i + 1][0] - merged[i][1] for i in range(len(merged) - 1)]
        i = int(np.argmin(gaps)); merged[i][1] = merged[i + 1][1]; del merged[i + 1]
    if len(merged) < nbeats:                         # too few: place beats by word count
        a, b = merged[0][0], merged[-1][1]
        wc = np.array([words(x) for x in beats], float)
        edges = a + (b - a) * np.concatenate([[0], np.cumsum(wc)]) / wc.sum()
        merged = [[edges[i] + (0.25 * FPS if i else 0), edges[i + 1] - 0.25 * FPS] for i in range(nbeats)]
        exact = False
    return [(a / FPS, b / FPS) for a, b in merged], exact


def placeholder_segments(beats=BEATS):
    t, out = LEAD, []
    for b in beats:
        d = sum(len(c.split()) / 2.6 + 0.18 for c in b["chunks"])
        out.append((t, t + d)); t += d + 0.7
    return out


def mouth_track(rms, cen, n):
    r = np.zeros(n); r[:min(n, len(rms))] = rms[:n]
    ref = np.percentile(r[r > 1e-5], 95) if (r > 1e-5).any() else 1.0
    r = np.clip(np.convolve(r, np.ones(3) / 3, mode="same") / ref, 0, 1.2)
    c = np.zeros(n)
    if cen is not None:
        c[:min(n, len(cen))] = cen[:n]
    shapes, cur, held = [], "m_closed", 0
    for i in range(n):
        v = r[i]
        want = "m_closed" if v < 0.07 else "m_small" if v < 0.2 else "m_open" if v < 0.45 else "m_wide"
        if cen is not None and v >= 0.15 and 0 < c[i] < 750:
            want = "m_oo"
        if want != cur:
            held += 1
            if held >= 2 or v < 0.04:
                cur, held = want, 0
        else:
            held = 0
        shapes.append(cur)
    # a pause of a quarter second or more: a small smile
    quiet = 0
    for i in range(n):
        quiet = quiet + 1 if r[i] < 0.04 else 0
        if quiet >= 8:
            for j in range(i - 7, i + 1):
                shapes[j] = "m_smile"
    return shapes, r


# ----------------------------------------------------------------------------------------------- timeline
def build_timeline(segs):
    spans = []
    for i, (s, e) in enumerate(segs):
        bs = 0.0 if i == 0 else (segs[i - 1][1] + s) / 2
        spans.append([bs, None, s, e])
    for i in range(len(spans)):
        spans[i][1] = spans[i + 1][0] if i + 1 < len(spans) else segs[-1][1] + TAIL
    return spans                                       # [beat start, beat end, speech start, speech end]


def gesture_arms(beat_idx, t, span, beats=BEATS):
    """-> (wave alpha, point alpha) at time t."""
    bs, be, s, e = span
    g = beats[beat_idx]["gesture"]
    win = lambda a, b: ease((t - a) / 0.22) * (1 - ease((t - b) / 0.22))
    if g == "wave":
        return win(bs + 0.1, bs + 2.2), 0.0
    if g == "wave_end":
        return win(be - 2.2, be + 1), 0.0
    if g == "point":
        n = len(beats[beat_idx]["subs"]) if beats[beat_idx].get("subs") else max(1, int(round((be - bs) / 3.5)))
        d = (be - bs) / n
        a = 0.0
        for k in range(n):
            t0 = bs + k * d + 0.25
            a = max(a, win(t0, t0 + min(1.5, d * 0.6)))
        return 0.0, a
    return 0.0, 0.0


# ----------------------------------------------------------------------------------------------- frames
def L(name, d=AV):
    return Image.open(d / f"{name}.png").convert("RGBA")


def fade(img, a):
    if a >= 0.999:
        return img
    img = img.copy(); img.putalpha(img.getchannel("A").point(lambda v: int(v * max(a, 0))))
    return img


LAYER_NAMES = ("hairback", "body", "head", "hairfront", "glasses", "eyes_open", "eyes_closed", "brows", "arm_wave", "arm_point",
               "m_closed", "m_small", "m_open", "m_wide", "m_oo", "m_smile")


def load_layers():
    return {n: L(n) for n in LAYER_NAMES}


def setup():
    if G:
        return
    G["takes"] = {n: Take(n) for n in {s[0] for b in BEATS for s in b["subs"]}}
    G["readers"] = {}
    G["body"], G["mask"] = bp.phone_sprite()
    G["layers"] = load_layers()
    G["ov"] = {p.stem: Image.open(p).convert("RGBA") for p in OVD.glob("*.png")}
    G["bg"] = {}


def background(grow):
    """Sand ground, one teal disc (behind the phone; centred behind the host in the last beat), a yellow disc behind her head."""
    img = Image.new("RGBA", (W, H), SAND + (255,))
    d = ImageDraw.Draw(img)
    cx = int(835 + (540 - 835) * grow); cy = int(980 + (1330 - 980) * grow); r = int(400 + 130 * grow)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=TEAL + (255,))
    return img


def blink_closed(t, rng_times):
    return any(0 <= t - b < 0.13 for b in rng_times)


def host_sprite(t, shape, energy, closed, wave_a, point_a, brows_up, scale=SCALE, layers=None):
    Lr = layers or G["layers"]
    head = Image.new("RGBA", (720, 800), (0, 0, 0, 0))
    for n in ("head", "eyes_closed" if closed else "eyes_open"):
        head.alpha_composite(Lr[n])
    br = Lr["brows"]
    head.alpha_composite(br, (0, -int(8 * brows_up)))
    head.alpha_composite(Lr[shape])
    head.alpha_composite(Lr["glasses"])
    head.alpha_composite(Lr["hairfront"])
    ang = 1.3 * np.sin(t * 1.3) + 2.2 * energy * np.sin(t * 5.1)
    dy = 2.5 * np.sin(t * 2.2) + 4 * energy
    head = head.rotate(ang, center=(300, 440), resample=Image.BICUBIC, translate=(0, dy))
    can = Image.new("RGBA", (720, 800), (0, 0, 0, 0))
    can.alpha_composite(Lr["hairback"])
    can.alpha_composite(Lr["body"])
    can.alpha_composite(head)
    if wave_a > 0.01:
        a = Lr["arm_wave"].rotate(11 * np.sin(t * 9.0), center=(58, 690), resample=Image.BICUBIC, translate=(0, int((1 - wave_a) * 60)))
        can.alpha_composite(fade(a, wave_a))
    if point_a > 0.01:
        a = Lr["arm_point"].rotate(-3 * np.sin(t * 6.0), center=(470, 566), resample=Image.BICUBIC, translate=(int((1 - point_a) * 70), 0))
        can.alpha_composite(fade(a, point_a))
    return can.resize((int(720 * scale), int(800 * scale)), Image.LANCZOS)


def wipe_in(frame, img, x_right, y, tr, dur=0.35, rise=18):
    p = ease(tr / dur)
    if p <= 0:
        return
    vis = max(1, int(img.width * p))
    frame.alpha_composite(img.crop((img.width - vis, 0, img.width, img.height)), (x_right - vis, y + int((1 - p) * rise)))


def render_frame(f):
    setup()
    t = f / FPS
    ctx = G["ctx"]
    spans, shapes, rms, blinks, total = ctx["spans"], ctx["shapes"], ctx["rms"], ctx["blinks"], ctx["total"]
    bi = max(i for i, sp in enumerate(spans) if sp[0] <= t + 1e-9)
    bs, be, s, e = spans[bi]
    beat = BEATS[bi]
    last = bi == len(BEATS) - 1
    grow = ease((t - bs) / 0.6) if last else 0.0
    frame = background(grow)

    # the phone: pops on every new screen; leaves for the offer
    n_sub = len(beat["subs"])
    d = (be - bs) / n_sub
    si = min(n_sub - 1, int((t - bs) / d))
    sub_t0 = bs + si * d
    take_n, src, rate, demo = beat["subs"][si]
    sc = dict(src=src, rate=rate, cam=(0, 0, 390, 844))
    key = (bi, si)
    if key not in G["readers"]:
        for r in G["readers"].values():
            r.close()
        G["readers"] = {key: FrameReader(G["takes"][take_n], src)}
    foot = bp.footage(G["takes"][take_n], G["readers"][key], sc, t, t - sub_t0)
    foot.putalpha(G["mask"])
    ph = G["body"].copy(); ph.alpha_composite(foot, (bp.BZ, bp.BZ))
    pop = bp.back_out(min((t - sub_t0) / 0.32, 1), 1.6)
    k = 0.9 + 0.1 * pop
    ph = ph.resize((max(1, int(ph.width * k)), max(1, int(ph.height * k))), Image.LANCZOS)
    ph = ph.rotate(3.0 + 0.8 * np.sin(t * 1.7), resample=Image.BICUBIC, expand=True)
    sprite, pad = bp.shadowed(ph)
    ph_a = 1 - grow
    if ph_a > 0.01:
        bp.paste_center(frame, bp.fade(sprite, ph_a), PH_C[0], PH_C[1] + 8 * np.sin(t * 2.1))

    # the host
    gi = min(int(t * FPS), len(shapes) - 1)
    w_a, p_a = gesture_arms(bi, t, spans[bi])
    en = float(rms[min(gi, len(rms) - 1)])
    brows = 0.0
    if s - 0.1 <= t <= e:
        brows = max(0.0, np.sin(t * 3.3)) * min(1.0, en * 1.5)
    hs = host_sprite(t, shapes[gi], en, blink_closed(t, blinks), w_a, p_a, brows)
    hx = int(HOST_XY[0] + (HOST_XY_END[0] - HOST_XY[0]) * grow)
    hy = int(HOST_XY[1] + (HOST_XY_END[1] - HOST_XY[1]) * grow + 3 * np.sin(t * 1.9))
    yc = (hx + 270 * SCALE, hy + 270 * SCALE)
    d_ = ImageDraw.Draw(frame)
    ya = 1 - grow                                       # the yellow disc behind her head, until the offer
    if ya > 0.01:
        r = 215
        layer = Image.new("RGBA", (2 * r, 2 * r), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=YELLOW + (255,))
        frame.alpha_composite(fade(layer, ya), (int(yc[0] - r), int(yc[1] - r)))
    x0, x1 = hx + int(70 * SCALE), hx + int(530 * SCALE)
    d_.rectangle((x0, hy + hs.height - 2, x1, H), fill=(11, 27, 51, 255))             # the blazer runs off the bottom edge
    frame.alpha_composite(hs, (hx, hy))

    # text layers
    ov = G["ov"]
    frame.alpha_composite(bp.fade(ov["lk"], 1.0), (1015 - ov["lk"].width, 276))
    frame.alpha_composite(ov["chip"], (65, 298))
    if not last:
        n_ch = len(beat["chunks"])
        # captions: the beat's phrases share the speech by length
        lens = np.array([len(c) for c in beat["chunks"]], float)
        edge = s + (e - s) * np.concatenate([[0], np.cumsum(lens)]) / lens.sum()
        ci = next((j for j in range(n_ch) if t < edge[j + 1]), n_ch - 1)
        t_c = max(bs, edge[ci] - 0.12) if ci else bs
        img = ov[f"cap_{bi}_{ci}"]
        wipe_in(frame, img, 1015, 382, t - t_c)
        frame.alpha_composite(ov["tag"], (65, 600))
        if demo:
            frame.alpha_composite(ov["pill_" + demo], (65, 668))
    else:
        yy = 392
        for j in range(len(beat["chunks"])):
            img = ov[f"h{bi}_{j}"]
            t_c = s + (e - s) * j / len(beat["chunks"])
            wipe_in(frame, img, 1010, yy, t - t_c, 0.35)
            yy += img.height + 4
        q = ease((t - (bs + 0.8)) / 0.4)
        cta = ov["cta"]
        if q > 0:
            frame.alpha_composite(bp.fade(cta, q), (540 - cta.width // 2, int(1045 + (1 - q) * 30)))
        frame.alpha_composite(ov["tag"], (540 - ov["tag"].width // 2, 1170))
    return frame.convert("RGB")


def render_chunk(args):
    n, f0, f1, ctx = args
    G.clear(); setup(); G["ctx"] = ctx
    path = OUT / f"_av_{n}.mp4"
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "60",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", str(path)], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        enc.stdin.write(render_frame(f).tobytes())
    enc.stdin.close(); enc.wait()
    return str(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", help="the voice recording (wav / m4a / mp3); without it a placeholder-timed PREVIEW is made")
    ap.add_argument("--out", default=None)
    ap.add_argument("--sample", type=int, default=0, help="render only N frames from the middle (a smoke test)")
    a = ap.parse_args()

    if a.audio:
        rms, cen = analyse(a.audio)
        rms = np.concatenate([np.zeros(int(LEAD * FPS)), rms]); cen = np.concatenate([np.zeros(int(LEAD * FPS)), cen])
        segs, exact = speech_segments(rms, len(BEATS))
        if not exact:
            print("WARNING: the pauses in the recording did not give exactly", len(BEATS), "beats; beats were placed by word count")
    else:
        rms, cen = placeholder()
        segs = placeholder_segments()
    spans = build_timeline(segs)
    total = spans[-1][1]
    n = int(round(total * FPS))
    shapes, rn = mouth_track(rms, cen, n)
    rng = np.random.default_rng(9)
    blinks, t = [], 1.2
    while t < total:
        blinks.append(t); t += rng.uniform(2.6, 4.6)
    ctx = dict(spans=spans, shapes=shapes, rms=rn, blinks=blinks, total=total)
    print("beats:", [(round(sp[0], 1), round(sp[1], 1)) for sp in spans], f"total {total:.1f}s")

    if a.sample:
        mid = n // 2
        bounds = [(0, mid, mid + a.sample, ctx)]
    else:
        parts = 4
        bounds = [(i, n * i // parts, n * (i + 1) // parts, ctx) for i in range(parts)]
    with mp.get_context("fork").Pool(len(bounds)) as pool:
        files = pool.map(render_chunk, bounds)
    if a.sample:
        print("sample:", files[0]); return
    lst = OUT / "_av_list.txt"
    lst.write_text("\n".join(f"file '{p}'" for p in files))
    silent = OUT / "_av_silent.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)], check=True)

    bed = OUT / "_av_music.wav"
    starts = [sp[0] for sp in spans[1:]]
    music_inspire.render(bed, total, hits=starts, end=spans[-1][0])
    name = a.out or ("Iqrra_16_Avatar_Host.mp4" if a.audio else "Iqrra_16_Avatar_Host_PREVIEW.mp4")
    final = OUT / name
    if a.audio:
        flt = (f"[1:a]volume=-21dB,afade=t=out:st={total - 1.4:.2f}:d=1.4[m];"
               f"[2:a]loudnorm=I=-16:TP=-1.5:LRA=9,adelay={int(LEAD * 1000)}|{int(LEAD * 1000)},apad[v];"
               f"[m][v]amix=inputs=2:normalize=0:duration=first[a]")
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed), "-i", a.audio, "-filter_complex", flt]
    else:
        flt = f"[1:a]volume=-8dB,afade=t=out:st={total - 1.4:.2f}:d=1.4[a]"
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed), "-filter_complex", flt]
    subprocess.run(cmd + ["-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}",
                          "-movflags", "+faststart", str(final)], check=True)
    for p in files + [str(lst), str(silent), str(bed)]:
        __import__("os").unlink(p)
    print("wrote", final)


if __name__ == "__main__":
    main()
