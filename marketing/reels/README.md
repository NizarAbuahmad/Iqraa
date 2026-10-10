# Reels (1080×1920, Instagram / Facebook)

| # | File | Status |
| --- | --- | --- |
| 1 | `out/Iqrra_01_Three_Steps.mp4` (22.9 s) | **Built** — one real workflow: tools → شرائح الدرس → الصف العاشر · الجغرافيا · الغلاف الجوي → generated deck → presented |
| 2 | `Iqrra_02_Library.mp4` | **Blocked — no footage** (see below) |
| 3 | `Iqrra_03_Classes.mp4` | **Blocked — no footage** |
| 4 | `Iqrra_04_Communication.mp4` | **Blocked — no footage** |

## Build (Reel 1)

```bash
node render_overlays.js          # Arabic headlines + end card, rendered by Chromium (never ffmpeg drawtext)
python3 make_music.py out/bed.wav 23.5
python3 build_reel1.py           # -> out/Iqrra_01_Three_Steps.mp4
```

Footage is `../tutorial/segments/*.mp4` (the 2026-09-15 recording). `build_reel1.py` lists every
source window; they deliberately skip the Claude desktop toast (seg07 ≈8–12 s), the delete-slide
confirm + Chrome print dialog (seg09 0–5 s) and the downloads bubble that names an unrelated
`.pptx` (seg09 ≈13–16 s).

## Things to know about Reel 1

- The app's own «وضع العرض · محتوى تجريبي» badge is in the footage, so the reel carries the same
  label under the card (repo rule: demo content says so).
- The tap-ripples sit on real click positions read from the footage. The step-1 ripple on
  شرائح الدرس is the one exception: the recording cuts straight from hovering that card to the
  tool open, so the click itself is not on camera.
- **Music is an original synthesised bed** (`make_music.py`) — no third-party licence. The five
  stock tracks used by the earlier reel are not in the repo and `docs/marketing-plan.md` still lists
  "music licences" as unbought, so none were reused. Swap in a licensed track by replacing `out/bed.wav`.

## Footage still needed for Reels 2–4

None of these screens appear anywhere in `marketing/tutorial/` (it only covers lesson picker, tools
list, شرائح الدرس and خطة الدرس). Record in the demo account, 1080p, no notifications, no terminals.

**Reel 2 — library.** Open the resource library from the app (not مكتبتي media tab — 503s in
production, and `/curriculum/resources` links are dead). Needed: library landing → one real search or
browse for a single lesson topic → open one resource and hold on its content. ~25 s. A resource
preview frame for the opening hook comes from the same take.

**Reel 3 — classes.** حسابي → صفوفي: classes overview with a fictional demo class → roster-consent
gate («أُقرّ بذلك») → add-class form filled → new class in the overview → open the class.
No real student names or photos; seed a fictional class first.

**Reel 4 — communication.** الرسائل tab (the tab exists in the nav but is never opened in the
footage). Needed: inbox showing both class-group and parent threads, open the class-group thread and
send the demo reminder, open a parent thread and send the second demo message. Demo environment only,
fictional parent/student names, no profile photos. Both exact messages are in the brief.
