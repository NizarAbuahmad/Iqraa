# Teacher tutorial

`out/iqraa-tutorial.mp4` — **Part 1, 1920×1080, 1:51**, cut from the 2026-09-15
screen recording. Silent capture with burned-in Arabic captions and a quiet music bed.

## Build

```bash
python build.py --cards        # render all chapter cards
python captions_part1.py       # caption PNGs (transparent) + caption_times.json
python assemble.py --video     # trim, mask, concat -> out/_video.mp4, prints the timeline
python assemble.py --caption   # overlay captions + bed music -> out/iqraa-tutorial.mp4
```

`assemble.py --video` prints the timeline (also written to `timeline.json`). Caption
times in `captions_part1.py` are written against that timeline, so if you change a
segment, re-read the timeline before retiming captions.

## Rules that are not optional

- **Arabic is rendered by Chrome, never by ffmpeg.** `drawtext` does no bidi
  reordering or glyph shaping — it renders Arabic disconnected and backwards.
  Cards and captions are both Chrome screenshots.
- **Caption PNGs must keep their alpha.** `captions_part1.py` checks the PNG colour
  type; a caption that lost alpha would paint a black slab across the footage.
- Source is **1918×986** (Game Bar captured the window, not a 1080p region). It is
  scaled to 1920×987 and padded to 1080 in brand navy. Do **not** stretch 986→1080;
  it visibly softens the Arabic UI text.
- A **Claude desktop notification** appears in the source at t≈47–51, bottom-right.
  `TOAST` in `assemble.py` blurs it. The first mask was 40px too short and left the
  header row legible — if you re-record, just don't let a notification fire.

## What Part 1 covers

Lesson bar and changing the lesson → the tools screen → شرائح الدرس → export →
presenting on screen → خطة الدرس with مدة الحصة and أسلوب التدريس.

Captions deliberately name **no lesson**: the take moves across three subjects
(الأحياء in the chat bar, الكيمياء in the unit browse, الجغرافيا in the slides,
deck and plan), so a caption naming one would contradict the screen.

The demo badge «وضع العرض · محتوى تجريبي» is visible throughout and is explained
in a caption at 0:15 rather than ignored.

## What Part 2 still needs recorded

None of this is in the current take:

1. **Signup + email verification** — the 6-digit code is mandatory for password
   signups and skipped for Google.
2. **Classes and students** — حسابي → صفوفي, the roster-consent gate
   («قبل إضافة بيانات الطلبة» → «أُقرّ بذلك») that fires before the first class,
   creating a class, pasting a name list, and the two different codes
   (class-wide «رمز الانضمام» vs the per-student claim code behind the key icon).
3. **Evaluations end to end** — تقييم جديد → نتاجات التعلّم → أنشئ وولّد الأسئلة →
   انشر التقييم → رابط الطلاب → أدخل إجابات الطلاب → سلّم وصحّح → لوحة النتائج →
   ما الذي فات الصف.
4. **Paper exam + OCR** — «امتحان ورقي» mode and «امسح العلامات من الورقة».

For the results dashboard to show a real distribution, build a class with a marked
exam **before** recording — you cannot produce that live on camera.

Captions for these are drafted in `build.py` (`CAPTIONS`), written against the
13-chapter plan. They will need retiming, and any that name a maths lesson will
need rewording to match whatever subject gets recorded.

## Avoid on camera

Terminals (the repo docs carry the demo password in plaintext), the مكتبتي media
library tab (503s in production), avatar upload (503), `/curriculum/resources`
(the ministry's certificate expired — all links dead), and anything near password
reset (removed from client and server).
