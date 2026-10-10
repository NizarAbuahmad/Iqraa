#!/usr/bin/env python3
"""Technical checks for an exported reel: format, audio level, black frames, safe-zone margins."""
import subprocess, sys, re
import numpy as np
from PIL import Image

path = sys.argv[1]
def run(*a): return subprocess.run(a, capture_output=True, text=True)
probe = run("ffprobe", "-v", "error", "-show_entries", "stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,channels", "-show_entries", "format=duration", "-of", "default=nw=1", path).stdout
print(probe.strip().replace("\n", " | "))
dur = float(re.search(r"duration=([\d.]+)", probe).group(1))
vol = run("ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "volumedetect", "-f", "null", "-").stderr
print("audio:", re.findall(r"(mean_volume|max_volume): (-?[\d.]+) dB", vol))
blk = run("ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vf", "blackdetect=d=0.1:pix_th=0.05", "-an", "-f", "null", "-").stderr
print("black segments:", blk.count("black_start"))
bad = 0
for i in range(0, int(dur * 2)):
    t = i / 2
    run("ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", path, "-frames:v", "1", "/tmp/_v.png")
    a = np.array(Image.open("/tmp/_v.png").convert("RGB")).astype(int)
    br = a.max(-1) > 150
    top, bot, rail = br[:270].sum(), br[-384:].sum(), br[1000:1536, -120:].sum()
    if top or bot or rail:
        bad += 1; print(f"  t={t:.1f}s bright px in margins: top {top} bottom {bot} right-rail {rail}")
print("frames sampled with content in safe-zone margins:", bad, "of", int(dur * 2))
