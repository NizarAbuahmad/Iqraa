#!/usr/bin/env python3
"""Cut the screen recording into the tutorial master.

Pass 1 (--video): trim the take into segments, interleave the chapter cards,
normalise geometry, mask the desktop notification, and concat. It PRINTS the
resulting timeline, which is what the caption times are written against.

Pass 2 (--caption): overlay the caption PNGs and bed the music under it.

The source take is 1918x986 (Game Bar captured the window, not a 1080p region),
so it is scaled to 1920x987 and padded to 1080 in brand navy rather than
upscaled to fill — a 986->1080 stretch visibly softens Arabic UI text.
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SEG = HERE / "segments"
CARDS = HERE / "cards"
CAPS = HERE / "captions"
SRC = Path(r"C:\Users\Lenovo\Downloads\Recording 2026-09-15 225657.mp4")
MUSIC = Path(r"C:\Users\Lenovo\Downloads\Raya studio\FAS\Audio"
             r"\solarflex-educational-education-school-music-541532.mp3")

W, H, FPS = 1920, 1080, 30
NAVY = "0x081B3A"

# A Claude desktop notification sits bottom-right of the source frame from
# t=47 to t=51. Blur it rather than cut — the cut would land mid-action.
# measured from the source frame: the toast body spans roughly
# x 1450-1903, y 815-973. Cover it generously — an under-sized box left
# the "Claude" header row and the close button legible above the blur.
TOAST = dict(src_from=46.8, src_to=51.4, x=1425, y=800, w=495, h=230)

# ordered timeline. card: a still. clip: (src_in, src_out, speed).
# speeds >1 tighten the navigation-heavy stretches without dropping steps.
TIMELINE = [
    dict(kind="card", name="intro1", dur=3.6),
    dict(kind="card", name="c1",    dur=2.6),
    dict(kind="clip", src=(2.0, 21.2),   speed=1.45),   # picking the lesson
    dict(kind="clip", src=(22.2, 31.8),  speed=1.45),   # unit + lesson
    dict(kind="card", name="c2",    dur=2.4),
    dict(kind="clip", src=(32.8, 36.0),  speed=1.0),    # the curriculum grid
    dict(kind="card", name="c3",    dur=2.6),
    dict(kind="clip", src=(37.0, 59.2),  speed=1.3),    # slides tool + options
    dict(kind="card", name="c4",    dur=2.6),
    dict(kind="clip", src=(71.5, 94.0),  speed=1.0),    # result + presenting
    dict(kind="clip", src=(94.6, 98.6),  speed=1.0),    # the textbook figure
    dict(kind="card", name="c5",    dur=2.6),
    dict(kind="clip", src=(105.5, 133.4), speed=1.15),  # lesson plan
    dict(kind="card", name="outro1", dur=4.2),
]


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"ffmpeg failed:\n{' '.join(str(c) for c in cmd)}\n{p.stderr[-2500:]}")


ENC = ["-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "19",
       "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2), "-an"]


def build_video():
    SEG.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    for f in SEG.glob("*.mp4"):
        f.unlink()

    timeline, t = [], 0.0
    for i, item in enumerate(TIMELINE):
        dest = SEG / f"{i:02d}.mp4"
        if item["kind"] == "card":
            png = CARDS / f"{item['name'].replace('t0', '0')}.png" \
                if item["name"].startswith("t") else CARDS / f"{item['name']}.png"
            if not png.exists():
                sys.exit(f"missing card: {png}")
            dur = item["dur"]
            run(["ffmpeg", "-y", "-loop", "1", "-i", str(png), "-t", f"{dur}",
                 "-vf", f"scale={W}:{H},fps={FPS},format=yuv420p", *ENC, str(dest)])
            label = f"card {item['name']}"
        else:
            a, b = item["src"]
            speed = item["speed"]
            base = (f"[0:v]scale={W}:987,pad={W}:{H}:0:46:color={NAVY}[base];")
            # the toast lives in source time; this clip starts at `a`
            if a <= TOAST["src_from"] <= b:
                lo = TOAST["src_from"] - a
                hi = min(TOAST["src_to"], b) - a
                base += (
                    f"[base]split[b1][b2];"
                    f"[b2]crop={TOAST['w']}:{TOAST['h']}:{TOAST['x']}:{TOAST['y'] + 46},"
                    f"boxblur=26:2[bl];"
                    f"[b1][bl]overlay={TOAST['x']}:{TOAST['y'] + 46}"
                    f":enable='between(t,{lo:.2f},{hi:.2f})'[base2];"
                )
                last = "base2"
            else:
                last = "base"
            graph = base + f"[{last}]setpts=PTS/{speed},fps={FPS},format=yuv420p[v]"
            run(["ffmpeg", "-y", "-ss", f"{a}", "-to", f"{b}", "-i", str(SRC),
                 "-filter_complex", graph, "-map", "[v]", *ENC, str(dest)])
            dur = (b - a) / speed
            label = f"clip {a:g}-{b:g} @{speed}x"

        timeline.append(dict(i=i, start=round(t, 2), end=round(t + dur, 2), what=label))
        t += dur

    lst = SEG / "concat.txt"
    lst.write_text("".join(f"file '{(SEG / f'{i:02d}.mp4').as_posix()}'\n"
                           for i in range(len(TIMELINE))), encoding="utf-8")
    master = OUT / "_video.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-c", "copy", str(master)])

    (HERE / "timeline.json").write_text(
        json.dumps(timeline, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"  {master.name} — {t:.1f}s total\n")
    for r in timeline:
        print(f"   {r['start']:7.2f} -> {r['end']:7.2f}   {r['what']}")


def build_captions():
    master = OUT / "_video.mp4"
    if not master.exists():
        sys.exit("run --video first")
    caps = json.loads((HERE / "caption_times.json").read_text(encoding="utf-8"))
    inputs, graph, last = ["-i", str(master)], "", "0:v"
    for n, c in enumerate(caps, start=1):
        png = CAPS / f"{c['i']:03d}.png"
        if not png.exists():
            sys.exit(f"missing caption png {png}")
        inputs += ["-i", str(png)]
        graph += (f"[{last}][{n}:v]overlay=0:0:"
                  f"enable='between(t,{c['start']},{c['end']})'[o{n}];")
        last = f"o{n}"
    graph = graph.rstrip(";").replace(f"[o{len(caps)}]", "[v]")

    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(master)],
        capture_output=True, text=True, check=True).stdout.strip())

    inputs += ["-i", str(MUSIC)]
    ai = len(caps) + 1
    # a tutorial bed sits far under the reel's -14 LUFS; it must not fight reading
    graph += (f";[{ai}:a]atrim=0:{dur:.3f},asetpts=PTS-STARTPTS,"
              f"afade=t=in:st=0:d=1.5,afade=t=out:st={dur - 2.5:.3f}:d=2.5,"
              f"loudnorm=I=-26:TP=-2:LRA=11,aresample=48000[a]")

    dest = OUT / "iqraa-tutorial.mp4"
    run(["ffmpeg", "-y", *inputs, "-filter_complex", graph,
         "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "19",
         "-pix_fmt", "yuv420p", "-r", str(FPS), "-g", str(FPS * 2),
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dest)])
    print(f"  wrote {dest.name}  ({dest.stat().st_size // 1024} KB, {dur:.1f}s)")


if __name__ == "__main__":
    if not SRC.exists():
        sys.exit(f"source recording not found: {SRC}")
    args = sys.argv[1:]
    if not args or "--video" in args:
        print("building video...")
        build_video()
    if "--caption" in args:
        print("captioning...")
        build_captions()
    print("done.")
