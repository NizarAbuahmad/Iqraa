#!/usr/bin/env python3
"""YouTube thumbnail for Reel 15 (1280x720): giant two-line title with the highlighter, a tilted phone with the app,
the lockup. Text is shaped by Chromium (thumb_overlays.html -> overlays_thumb/), the phone is a frame of the tour.

    python3 make_youtube_thumb.py          # writes out/Iqrra_15_YouTube_Thumbnail.png
"""
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

import build_poster_reel as bp
from reel_lib import HERE, OUT, Take

HTML = """<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@800;900&family=Almarai:wght@800&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent}body{direction:rtl;width:1280px;font-family:Almarai}
.o{position:absolute;left:0;top:0}
.t{width:720px;text-align:right;font-family:Cairo;font-weight:900;font-size:150px;line-height:1.08;color:#0B1B33}
.mk{background:linear-gradient(transparent 56%,#FFC93C 56%,#FFC93C 90%,transparent 90%);padding:0 12px;margin:0 -12px}
.s{font-family:Cairo;font-weight:900;font-size:56px;color:#fff;background:#0B1B33;border-radius:20px;padding:10px 34px;box-shadow:0 9px 0 #00A99D;white-space:nowrap}
.lk{width:260px}</style>
<div id="t_main" class="o t">كل أدوات<br><span class="mk">حصتك</span> هنا</div>
<div id="t_chip" class="o s">جولة كاملة · للمنهاج الأردني</div>
<div id="t_lock" class="o"><img class="lk" src="assets/lockup-ink.svg"></div>
"""


def main():
    Path("thumb_overlays.html").write_text(HTML)
    subprocess.run(["node", "render_html.js", "thumb_overlays.html", "overlays_thumb", "1280", "720"], check=True, capture_output=True)
    ov = {p.stem: Image.open(p).convert("RGBA") for p in Path("overlays_thumb").glob("*.png")}
    W, H = 1280, 720
    img = Image.new("RGBA", (W, H), (246, 245, 241, 255))
    d = ImageDraw.Draw(img)
    disc = Image.new("RGBA", (760, 760), (0, 0, 0, 0)); ImageDraw.Draw(disc).ellipse((0, 0, 759, 759), fill=(0, 169, 157, 255))
    img.alpha_composite(disc, (-70, 160))
    d.ellipse((560, 40, 640, 120), fill=(255, 201, 60, 255))
    bp.SW, bp.SH = 330, 714
    body, mask = bp.phone_sprite()
    take = Take("tour")
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", "52.5", "-i", str(take.mp4), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"])
    import io
    shot = Image.open(io.BytesIO(raw)).convert("RGBA").resize((330, 714), Image.LANCZOS)
    shot.putalpha(mask)
    ph = body.copy(); ph.alpha_composite(shot, (bp.BZ, bp.BZ))
    ImageDraw.Draw(ph).rounded_rectangle((ph.width // 2 - 44, bp.BZ + 9, ph.width // 2 + 44, bp.BZ + 30), 10, fill=(11, 27, 51, 255))
    ph = ph.rotate(4, resample=Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", (ph.width + 120, ph.height + 120), (0, 0, 0, 0))
    sh.paste((11, 27, 51, 255), (60, 78), ph.getchannel("A").point(lambda v: int(v * 110 / 255)))
    sh = sh.filter(ImageFilter.GaussianBlur(20)); sh.alpha_composite(ph, (60, 60))
    img.alpha_composite(sh, (70, 0 - 30))
    img.alpha_composite(ov["t_main"], (1240 - ov["t_main"].width, 150))
    img.alpha_composite(ov["t_chip"], (1240 - ov["t_chip"].width, 520))
    img.alpha_composite(ov["t_lock"], (1240 - ov["t_lock"].width, 40))
    out = OUT / "Iqrra_15_YouTube_Thumbnail.png"
    img.convert("RGB").save(out)
    print("wrote", out, img.size)


if __name__ == "__main__":
    main()
