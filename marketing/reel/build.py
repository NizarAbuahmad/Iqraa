#!/usr/bin/env python3
"""Build the Iqraa teacher intro reel (1080x1920, ~42s) for Facebook / Instagram Reels.

Three stages:
  1. Chrome headless renders each slide state of slides.html to frames/NN.png.
     Arabic MUST be rasterised here — ffmpeg's drawtext does no bidi reordering
     or glyph shaping, so any Arabic it renders comes out disconnected and
     backwards.
  2. ffmpeg turns the stills into clips (gentle alternating Ken Burns), chains
     them with xfade, and writes a silent master.
  3. Each music bed is muxed onto that master with -c:v copy, so every scored
     variant costs seconds rather than a full re-encode. The default track is
     the one whose first 3s are loudest relative to its own average — a bed
     that fades in wastes the hook.

    python build.py              # render + encode + score
    python build.py --encode     # reuse frames, re-encode + score
    python build.py --score      # reuse the silent master, just re-score
"""

import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRAMES = HERE / "frames"
OUT = HERE / "out"
W, H, FPS = 1080, 1920, 30

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]

MUSIC_DIR = Path(r"C:\Users\Lenovo\Downloads\Raya studio\FAS\Audio")
# short name -> filename. The first entry is the default and becomes
# iqraa-teachers-reel.mp4; the rest are written as -<name> alternates.
MUSIC = [
    ("solarflex", "solarflex-educational-education-school-music-541532.mp3"),
    ("delosound", "delosound-educational-education-school-music-432203.mp3"),
    ("nastelbom", "nastelbom-university-school-college-356707.mp3"),
    ("ikoliks", "ikoliks_aj-back-to-school-college-university-music-562784.mp3"),
    ("starostin", "viacheslavstarostin-education-school-educational-music-346811.mp3"),
]

# (slide id, seconds on screen, transition INTO this slide in seconds)
# 0.05 reads as a hard cut; the three s04 states cut so the tool tiles
# look like they are being tapped in rather than dissolving.
TIMELINE = [
    ("01",  2.8, 0.00),   # hook — 9:40pm, the evening is gone
    ("02",  2.7, 0.40),   # turn — logo
    ("03",  3.5, 0.40),   # curriculum
    ("04a", 0.55, 0.35),  # tools arriving
    ("04b", 0.55, 0.05),
    ("04c", 2.60, 0.05),
    ("15",  3.4, 0.40),   # custom plan: teaching style + period length
    ("05",  3.4, 0.40),   # lesson plan output
    ("06",  3.0, 0.40),   # worksheet
    ("07",  3.0, 0.40),   # class mode
    ("10",  3.6, 0.40),   # new evaluation from outcomes
    ("11",  3.2, 0.40),   # share code
    ("12",  3.6, 0.40),   # scan paper marks
    ("13",  3.5, 0.40),   # results dashboard
    ("14",  3.4, 0.40),   # gaps / what next
    ("16",  3.6, 0.40),   # messaging: student / parent / class
    ("08",  3.5, 0.40),   # verified answer key
    ("17",  3.4, 0.40),   # mobile + web
    ("09",  4.2, 0.40),   # close + CTA
]

POSTER_AT = 2.9        # the "مع اقرأ… دقائق." card, the strongest still
FADE_IN = 1.0
FADE_OUT = 2.0
SILENT = "_silent.mp4"


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def chrome() -> str:
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    sys.exit("No Chrome/Edge found — install Chrome or edit CHROME_CANDIDATES.")


def render() -> None:
    FRAMES.mkdir(exist_ok=True)
    exe = chrome()
    src = (HERE / "slides.html").as_uri()
    for slide, _, _ in TIMELINE:
        png = FRAMES / f"{slide}.png"
        run([
            exe,
            "--headless=new",
            "--disable-gpu",
            # without this Chrome silently drops the file:// <img> logo
            "--allow-file-access-from-files",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--disable-lcd-text",           # grayscale AA: no colour fringes on video
            "--font-render-hinting=none",
            f"--window-size={W},{H}",
            "--virtual-time-budget=8000",   # let Google Fonts land before the shot
            f"--screenshot={png}",
            f"{src}?s={slide}",
        ])
        if not png.exists():
            sys.exit(f"Chrome produced no frame for slide {slide}")
        print(f"  rendered {png.name}  ({png.stat().st_size // 1024} KB)")


def filtergraph():
    parts = []
    for i, (_, dur, _) in enumerate(TIMELINE):
        frames = max(2, round(dur * FPS))
        # alternate the drift so consecutive beats do not feel like one long push
        z = (
            f"1.00+0.060*on/{frames - 1}"
            if i % 2 == 0
            else f"1.06-0.060*on/{frames - 1}"
        )
        # upscale first: zoompan on a 1:1 source visibly judders on straight edges
        parts.append(
            f"[{i}:v]scale={W * 2}:{H * 2},setsar=1,"
            f"zoompan=z='{z}':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":s={W}x{H}:fps={FPS},format=yuv420p[v{i}]"
        )

    chain = "[v0]"
    acc = TIMELINE[0][1]
    for i in range(1, len(TIMELINE)):
        dur, trans = TIMELINE[i][1], TIMELINE[i][2]
        offset = round(acc - trans, 3)
        label = f"[x{i}]" if i < len(TIMELINE) - 1 else "[vout]"
        parts.append(
            f"{chain}[v{i}]xfade=transition=fade:duration={trans}:offset={offset}{label}"
        )
        chain = label
        acc = round(acc + dur - trans, 3)

    return ";".join(parts), acc


def encode() -> None:
    OUT.mkdir(exist_ok=True)
    graph, total = filtergraph()
    print(f"  timeline: {total:.2f}s")
    cmd = ["ffmpeg", "-y"]
    for slide, _, _ in TIMELINE:
        # single-frame input on purpose: zoompan emits d frames per INPUT frame,
        # so a looped still multiplies the clip length instead of setting it
        cmd += ["-i", str(FRAMES / f"{slide}.png")]
    cmd += [
        "-filter_complex", graph,
        "-map", "[vout]", "-an",
        "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2),
        "-movflags", "+faststart",
        str(OUT / SILENT),
    ]
    run(cmd)
    print(f"  wrote {SILENT}")

    run(["ffmpeg", "-y", "-ss", str(POSTER_AT), "-i", str(OUT / SILENT),
         "-frames:v", "1", str(OUT / "poster.png")])
    print("  wrote poster.png")


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        check=True, capture_output=True, text=True,
    )
    return float(out.stdout.strip())


def score() -> None:
    master = OUT / SILENT
    if not master.exists():
        sys.exit(f"{SILENT} missing — run without --score first.")
    total = duration(master)
    for i, (name, filename) in enumerate(MUSIC):
        track = MUSIC_DIR / filename
        if not track.exists():
            print(f"  SKIP {name}: {track} not found")
            continue
        dest = OUT / ("iqraa-teachers-reel.mp4" if i == 0
                      else f"iqraa-teachers-reel-{name}.mp4")
        af = (
            f"atrim=0:{total:.3f},asetpts=PTS-STARTPTS,"
            f"afade=t=in:st=0:d={FADE_IN},"
            f"afade=t=out:st={total - FADE_OUT:.3f}:d={FADE_OUT},"
            # Meta normalises playback to roughly -14 LUFS; matching it here
            # stops the platform from pumping a too-quiet or too-hot bed
            # loudnorm runs at 192k internally; resample back or the AAC
            # track lands at 96 kHz, which Meta re-encodes
            "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000"
        )
        run([
            "ffmpeg", "-y", "-i", str(master), "-i", str(track),
            "-filter_complex", f"[1:a]{af}[a]",
            "-map", "0:v", "-c:v", "copy",
            "-map", "[a]", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart", str(dest),
        ])
        tag = "  (default)" if i == 0 else ""
        print(f"  scored {dest.name}  ({dest.stat().st_size // 1024} KB){tag}")


if __name__ == "__main__":
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not on PATH.")
    only_score = "--score" in sys.argv
    if not only_score:
        if "--encode" not in sys.argv:
            print("rendering slides...")
            render()
        print("encoding...")
        encode()
    print("scoring...")
    score()
    print("done.")
