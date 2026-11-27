"""Assemble a December reel from reels/<id>.json.

    node reels/overlays.cjs reels/<id>.json   # Chrome renders captions/cards first
    python reels/build.py reels/<id>.json [--music <file>]

Two kinds of spec:
  * "clip": a raw screen recording, cut by "segments" ([start, end, speed?] in
    source seconds, joined in order), scaled into the phone window, with caption strips
    shown at output times ("captions": [{"t0","t1","text"}]), then the end card.
  * "cards": a text-only reel, each card held "dur" seconds, cross-faded.
Writes reels/out/<id>.mp4 (music bed, if given) and reels/out/<id>-silent.mp4.
Arabic text is never drawn by ffmpeg: every caption is a PNG made by Chrome.
"""
import json, os, subprocess, sys

W, H, FPS = 1080, 1920, 30
WIN = dict(x=126, y=330, w=828, h=1472)  # must match overlays.cjs
END_DUR, XF = 2.8, 0.35


def run(args):
    print(' '.join(args[:6]), '...')
    subprocess.run(args, check=True)


def main():
    spec_path = sys.argv[1]
    music = sys.argv[sys.argv.index('--music') + 1] if '--music' in sys.argv else None
    spec = json.load(open(spec_path, encoding='utf-8'))
    here = os.path.dirname(os.path.abspath(spec_path))
    b = os.path.join(here, 'build', spec['id'])
    os.makedirs(os.path.join(here, 'out'), exist_ok=True)
    body = os.path.join(b, 'body.mp4')

    if spec.get('clip'):
        src = os.path.join(here, spec['clip'])
        segs = spec.get('segments') or [[0, None]]
        speed = spec.get('speed', 1.0)
        parts, labels = [], []
        for k, seg in enumerate(segs):
            s, e = seg[0], seg[1]
            sp = seg[2] if len(seg) > 2 else speed  # optional per-segment speed
            trim = f"trim=start={s}" + (f":end={e}" if e is not None else '')
            parts.append(f"[0:v]{trim},setpts=(PTS-STARTPTS)/{sp},fps={FPS},"
                         f"scale={WIN['w']}:{WIN['h']}:force_original_aspect_ratio=decrease,"
                         f"pad={WIN['w']}:{WIN['h']}:(ow-iw)/2:(oh-ih)/2:color=0xF5F7FA,setsar=1[s{k}]")
            labels.append(f"[s{k}]")
        fc = ';'.join(parts) + f";{''.join(labels)}concat=n={len(labels)}:v=1:a=0[scr]"
        fc += f";[1:v][scr]overlay={WIN['x']}:{WIN['y']}:shortest=1[a0];[a0][2:v]overlay=0:0[a1]"
        inputs = ['-i', src, '-loop', '1', '-i', os.path.join(b, 'bg.png'), '-loop', '1', '-i', os.path.join(b, 'frame.png')]
        last = 'a1'
        for k, c in enumerate(spec.get('captions', [])):
            inputs += ['-loop', '1', '-i', os.path.join(b, f'cap-{k}.png')]
            nxt = f'c{k}'
            fc += (f";[{3 + k}:v]format=rgba,fade=in:st={c['t0']}:d=0.25:alpha=1,"
                   f"fade=out:st={max(c['t0'], c['t1'] - 0.25)}:d=0.25:alpha=1[cap{k}]"
                   f";[{last}][cap{k}]overlay=0:0:enable='between(t,{c['t0']},{c['t1']})'[{nxt}]")
            last = nxt
        fc += f";[{last}]format=yuv420p[out]"
        run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', fc, '-map', '[out]',
             '-r', str(FPS), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', body])
    else:
        cards = spec['cards']
        inputs, fc, off = [], '', 0.0
        for k, c in enumerate(cards):
            inputs += ['-loop', '1', '-t', str(c['dur']), '-i', os.path.join(b, f'text-{k}.png')]
            fc += f"[{k}:v]fps={FPS},format=yuv420p,setsar=1[t{k}];"
        last = 't0'
        off = cards[0]['dur']
        for k in range(1, len(cards)):
            off -= XF
            fc += f"[{last}][t{k}]xfade=transition=fade:duration={XF}:offset={off:.2f}[x{k}];"
            last = f'x{k}'
            off += cards[k]['dur']
        run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', fc.rstrip(';').rstrip(';'),
             '-map', f'[{last}]', '-r', str(FPS), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', body])

    # end card, joined with a short cross-fade
    end = os.path.join(b, 'end.mp4')
    run(['ffmpeg', '-y', '-v', 'error', '-loop', '1', '-t', str(END_DUR), '-i', os.path.join(b, 'end.png'),
         '-vf', f'fps={FPS},format=yuv420p,setsar=1', '-c:v', 'libx264', '-crf', '18', end])
    dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                         '-of', 'csv=p=0', body]).decode().strip())
    silent = os.path.join(here, 'out', f"{spec['id']}-silent.mp4")
    run(['ffmpeg', '-y', '-v', 'error', '-i', body, '-i', end, '-filter_complex',
         f"[0:v]setsar=1[a];[1:v]setsar=1[b];[a][b]xfade=transition=fade:duration={XF}:offset={dur - XF:.2f},format=yuv420p[v]",
         '-map', '[v]', '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', silent])
    total = dur + END_DUR - XF
    if music:
        run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-i', music, '-filter_complex',
             f"[1:a]atrim=0:{total:.2f},volume=0.55,afade=in:st=0:d=0.6,afade=out:st={total - 1.5:.2f}:d=1.5[m]",
             '-map', '0:v', '-map', '[m]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
             '-movflags', '+faststart', os.path.join(here, 'out', f"{spec['id']}.mp4")])
    print(f"done {spec['id']}: {total:.1f}s")


if __name__ == '__main__':
    main()
