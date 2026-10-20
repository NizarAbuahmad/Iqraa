#!/usr/bin/env python3
"""Reel 14 — Meta (Facebook / Instagram Reels) ad: the whole toolbox in one reel, inviting teachers to try it free.

Format      1080x1920, 27.8 s, 9:16 (Reels / Stories placements). Captions are burned in, so it works muted.
Safe zone   Meta overlays its own caption and button on Reels ads, so every piece of content stays inside
            y 270-1250 and x 65-1015 (top 14 %, bottom ~35 %, sides 6 % left clear). The phone shows the whole app screen and is
            deliberately taller than that: only its bottom ~310 px (the app's tab bar and lowest content) reaches into Meta's overlay zone, where the
            caption / button sit. Trade-off chosen on purpose: whole screen, much bigger. To keep the phone inside the
            zone instead, set bp.SW, bp.SH = 360, 779 and PCY = 850.
Offer       one claim only: «جرّبها مجانًا» + «أنشئ حساب معلم مجاني» — the app's own button text. The product has no
            price or billing today (docs/marketing-plan.md §3: tiers are hypotheses), so "try it free" is true now; if a
            paywall ships before the ad runs, this text must change.
Honesty     screens whose content is demo-mode AI carry the «وضع العرض · محتوى تجريبي» label (the marketing plan's rule
            for any "try it free" campaign); nothing says verified, graded by AI, or counts features.
Features    12, in the order of a lesson: ask / curriculum / worksheet / lesson plan / slides / interactive class /
            class challenge / games / whiteboard / evaluations / parent message / classes.
Footage     the tour (capture/takes/tour.mp4) and the committed takes r2n_library, r10_games, r11_interactive,
            r12_curriculum. Nothing is re-recorded. Frames showing the app's mirrored maths are not used.
Look        the poster language of Reel 13 (sand, one teal disc, giant ink type with a highlighter, tilted phone, stickers).
Music       both beds are rendered from the same picture: `_upbeat` and `_oriental`.

    node render_overlays.js ; python3 build_meta_ad.py
"""
import subprocess

import numpy as np
from PIL import Image, ImageDraw

import build_poster_reel as bp
import music_oriental
import music_upbeat
from reel_lib import FPS, H, OUT, OV, W, FrameReader, Take, ease

bp.SW, bp.SH = 500, 1082           # the whole 390x844 screen (aspect 0.462) at 1.28x — ~48 % taller than the first cut
BZ = bp.BZ
PCX, PCY = 540, 1012
ANGLE = -2.5
HOOK, SCENE, END = 2.4, 1.8, 3.8
TEAL, INK, YELLOW = bp.TEAL, bp.INK, bp.YELLOW

# (label png, take, source time, rate, crop (x, y, w, h) in CSS px, demo-mode content?)
FEATURES = [
    ("ad1", "tour", 56.2, 0.5, (0, 0, 390, 844), True),             # Ask Iqra: a request, a clarifying question, options
    ("ad2", "r12_curriculum", 15.0, 0.9, (0, 0, 390, 844), False),    # curriculum: units -> lessons
    ("ad3", "r2n_library", 15.9, 0.5, (0, 0, 390, 844), False),      # library worksheet: worked example
    ("ad4", "tour", 97.5, 0.0, (0, 0, 390, 844), True),              # lesson plan ready
    ("ad5", "tour", 252.6, 0.0, (0, 0, 390, 844), True),             # slides
    ("ad6", "r11_interactive", 11.8, 0.0, (0, 0, 390, 844), False),  # interactive classroom: the activities
    ("ad7", "tour", 197.0, 0.0, (0, 0, 390, 844), True),             # class challenge ready
    ("ad8", "r10_games", 4.8, 0.9, (0, 0, 390, 844), False),           # games: element game, answer ticks
    ("ad9", "tour", 354.0, 0.5, (0, 0, 390, 844), False),            # whiteboard
    ("ad10", "tour", 331.0, 0.9, (0, 0, 390, 844), True),             # evaluations
    ("ad11", "tour", 322.2, 1.0, (0, 0, 390, 844), True),            # parent message
    ("ad12", "tour", 380.5, 1.0, (0, 0, 390, 844), False),           # classes + students
]


def main():
    takes = {n: Take(n) for n in {f[1] for f in FEATURES} | {"tour"}}
    hook_take = takes["tour"]
    scenes = [dict(label=None, take="tour", src=50.6, rate=0.0, cam=(0, 0, 390, 844), dur=HOOK, demo=False)]   # the empty chat, not the slate
    for lab, tk, src, rate, cam, demo in FEATURES:
        scenes.append(dict(label=lab, take=tk, src=src, rate=rate, cam=cam, dur=SCENE, demo=demo))
    t = 0.0
    for s in scenes:
        s["t0"] = t
        t += s["dur"]
    t_end, total = t, t + END
    cuts = [s["t0"] for s in scenes[1:]]
    dings = [s["t0"] + 0.2 for s in scenes[1:]]

    imgs = {f[0]: Image.open(OV / f"{f[0]}.png").convert("RGBA") for f in FEATURES}
    imgs["adh"] = Image.open(OV / "adh.png").convert("RGBA")
    imgs["sk_free"] = Image.open(OV / "sk_free.png").convert("RGBA")
    imgs["dmo"] = Image.open(OV / "dmo.png").convert("RGBA")
    end_img = Image.open(OV / "end_ad.png").convert("RGB")
    bg = bp.background()
    body, screen_mask = bp.phone_sprite()

    silent = OUT / "_ad_silent.mp4"
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
            e = end_img
            out = Image.blend(last.convert("RGB"), e, ease(te / 0.3))
            enc.stdin.write(out.tobytes())
            continue
        idx = max(i for i, s in enumerate(scenes) if s["t0"] <= tt + 1e-9)
        s = scenes[idx]
        if idx != cur:
            if reader:
                reader.close()
            reader = FrameReader(takes[s["take"]], s["src"]); cur = idx
        tr = tt - s["t0"]
        frame = bg.copy()

        # phone: pops on every cut, floats between
        foot = bp.footage(takes[s["take"]], reader, s, tt, tr)
        foot.putalpha(screen_mask)
        ph = body.copy(); ph.alpha_composite(foot, (BZ, BZ))
        notch = Image.new("RGBA", ph.size, (0, 0, 0, 0))
        ImageDraw.Draw(notch).rounded_rectangle((ph.width // 2 - 56, BZ + 12, ph.width // 2 + 56, BZ + 38), 13, fill=INK + (255,))
        ph.alpha_composite(notch)
        pop = bp.back_out(min(tr / 0.32, 1), 1.6)
        k = 0.9 + 0.1 * pop if idx > 0 else 0.58 + 0.06 * bp.back_out(min(tt / 0.55, 1))      # hook: smaller phone, lower, under the 2-line headline
        ph = ph.resize((max(1, int(ph.width * k)), max(1, int(ph.height * k))), Image.LANCZOS)
        ph = ph.rotate(-(ANGLE + 1.0 * np.sin(tt * 1.7)), resample=Image.BICUBIC, expand=True)
        sprite, pad = bp.shadowed(ph)
        bp.paste_center(frame, sprite, PCX, (1060 if idx == 0 else PCY) + 8 * np.sin(tt * 2.1))

        # headline: the hook, then one label per feature (wipes in from the right)
        head = imgs["adh"] if s["label"] is None else imgs[s["label"]]
        y_head = 300
        p = ease(tr / (0.5 if s["label"] is None else 0.28))
        vis = max(1, int(head.width * p))
        frame.alpha_composite(head.crop((head.width - vis, 0, head.width, head.height)), (1015 - vis, y_head + int((1 - p) * 26)))

        # the offer, on screen from the first beat of the montage to the end card
        if idx >= 1:
            q = (tt - (HOOK + 0.15)) / 0.45
            sp = imgs["sk_free"]
            sc_ = max(0.01, bp.back_out(q, 2.4))
            sp = sp.resize((max(1, int(sp.width * sc_)), max(1, int(sp.height * sc_))), Image.LANCZOS).rotate(8, expand=True, resample=Image.BICUBIC)
            bp.paste_center(frame, sp, 330, 590 + 5 * np.sin(tt * 2.6))

        # demo-mode label on screens that show generated content
        if s["demo"]:
            a = ease(tr / 0.2)
            dm = imgs["dmo"].resize((int(imgs["dmo"].width * .85), int(imgs["dmo"].height * .85)), Image.LANCZOS)
            bp.paste_center(frame, bp.fade(dm, a), 255, 432)           # beside the feature label, off the app content

        # progress ticker: one segment per feature
        if idx >= 1:
            segw, gap = 62, 10
            span = 12 * segw + 11 * gap
            L = Image.new("RGBA", (span, 14), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
            for i in range(12):
                x0 = span - (i + 1) * segw - i * gap                       # fills right-to-left
                done = i < idx
                col = INK + (255,) if done else (11, 27, 51, 50)
                d.rounded_rectangle((x0, 0, x0 + segw, 14), 7, fill=col)
            frame.alpha_composite(L, (540 - span // 2, 276))

        last = frame
        enc.stdin.write(frame.convert("RGB").tobytes())
    enc.stdin.close(); enc.wait()
    reader.close()

    for name, mod in (("upbeat", music_upbeat),):           # add ("oriental", music_oriental) for the Levantine version
        bed = OUT / f"_ad_{name}.wav"
        mod.render(bed, total, hits=cuts, end=t_end, dings=dings)
        final = OUT / f"Iqrra_14_Meta_Ad_{name}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(bed),
                        "-filter_complex", f"[1:a]volume=-1.5dB,afade=t=out:st={total - 1.4:.2f}:d=1.4[a]",
                        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}",
                        "-movflags", "+faststart", str(final)], check=True)
        bed.unlink()
        print("wrote", final)
    silent.unlink()
    print(f"{total:.2f}s, features {len(FEATURES)}, cuts {[round(c, 1) for c in cuts]}")


if __name__ == "__main__":
    main()
