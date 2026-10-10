# Reels (1080×1920, Instagram / Facebook)

| # | File | Footage | Length |
| --- | --- | --- | --- |
| 1 | `out/Iqrra_01_Three_Steps.mp4` | the 2026-09-15 desktop walkthrough (`../tutorial/segments`) | 22.9 s |
| 2 | `out/Iqrra_02_Library.mp4` | **recorded from the app**, demo account | 22.7 s |
| 3 | `out/Iqrra_03_Classes.mp4` | **recorded from the app**, demo account | 24.4 s |
| 4 | `out/Iqrra_04_Communication.mp4` | **recorded from the app**, demo account | 24.3 s |
| 5 | `out/Iqrra_05_Quiz.mp4` | **recorded from the app**, demo account (+ a clip of Reel 2's take) | 23.1 s |
| 6 | `out/Iqrra_06_Ask_Iqra.mp4` | cut from the full-app tour (chapter 03), demo mode | 21.5 s |
| 7 | `out/Iqrra_07_Class_Games.mp4` | cut from the full-app tour (chapters 12, 08) | 20.0 s |
| 8 | `out/Iqrra_08_Lesson_Slides.mp4` | cut from the full-app tour (chapter 10), demo mode | 22.6 s |
| 9 | `out/Iqrra_09_Full_Lesson.mp4` | cut from the full-app tour (chapter 16), demo mode | 20.4 s |

Reels 1–4 share one layout (headline in the top safe zone, the app in a rounded card, branded end card),
the same Chromium-rendered Arabic (Cairo / Almarai, never ffmpeg `drawtext`) and the same music bed.

## What is real, what is staged (Reels 2–4)

Everything on screen is a real screen of this repo's app, recorded in a phone-sized browser against a
throwaway local Postgres. Nothing is sent to a real person: there is no email service, no push, and the
accounts exist only on that machine.

- **Accounts.** One fictional teacher «سلمى الخطيب» per reel, created through the real `/auth/register`
  route. `email_verified` is set directly in SQL because there is no mailer locally; the roster-consent
  prompt («أُقرّ بذلك») is acknowledged off-camera on that fictional account.
- **Reel 2.** Nothing staged. The library is the real المكتبة tab, and the search is the lesson already
  shown in the app's own lesson bar («تركيب الاقترانات»); the one result is what the library holds for it.
- **Reel 3.** The teacher starts with two seeded classes so the overview has cards. On camera: «شعبة جديدة»,
  the name typed, الكيمياء switched off, «أنشئ الشعبة», the add-students sheet (first names only, all
  fictional), back to the overview (now three classes), and the new class opened. Dead time is sped up.
- **Reel 4.** Class «الثامن علوم أ» with three student accounts and two parent accounts, all created through the
  real claim-code flow (`STUDENT_ACCOUNTS=true`, as in production). The class-group thread is created before any
  message; both messages are the demo texts from the brief and exist only in that local database. The pill
  «محادثة تجريبية · حساب تجريبي» says so on screen.
- **Wording.** The app calls a class a «شعبة»; the brief's copy says «صف / صفوف» and is kept verbatim, so Reel 3's
  headlines say «صفّك» over screens that say «شعبة».

## Reel 5 — «سؤال الحصة» (a different format)

Reels 1–4 are screen walkthroughs; Reel 5 is a quiz: a real multiple-choice question from the library worksheet
«تركيب الاقترانات» (item 2: f(x) = x² − 1, find f(3), options 8 / 9 / 2 / −1), a 3-2-1 ring, the answer
highlighted in the app, the same key row highlighted in «مفتاح الإجابات», and a closing clip of the library card.
`build_reel5.py` has the rationale; the take is `capture/r5_record.cjs`.

- **Nothing says «verified».** Every key in the premade library is `verificationSource: 'bank'` (computed with its
  question) — none is `'symbolic'` — so the reel shows the key and never claims proof. I checked the answer by hand
  (3² − 1 = 8; 9 is the "forgot the −1" slip).
- **Why item 2.** The sheet numbers questions per section but its key globally, and only in the first section do they
  agree — highlighting key row 6 under a question the app labels «3.» would confuse. (Another MCQ on that sheet has
  an Arabic «و» that renders like a stray "g" next to Latin maths, so it was dropped.)
- **Library issue, since fixed on this branch:** 27 of 28 premade sheets repeated question stems inside one sheet.
  The manifest was regenerated, so «تركيب الاقترانات» now has 4 questions, not the 10 shown in Reels 2 and 5.

## Reels 6–9 — cut from the full-app tour

`capture/takes/tour.mp4` is an 8m14s silent screen recording (780×1688, 26 chapter cards) supplied by the repo
owner. It is **not committed** (21 MB, gitignored); put it at that path to rebuild, with an empty
`tour.events.json` (`[]`) beside it. `build_tour_reels.py` holds the four cuts, with the source timestamps.

Left out on purpose: every frame where the build the tour was recorded from shows maths with its words and
symbols in reversed bidi order (chapter 03's worksheet reply, chapter 10's «مفردات الدرس» slide, the class
challenge's questions, chapter 16's worksheet and «تحقّق سريع» cards). Those are real app defects — worth a fix,
and not something a promo should be the first place a teacher meets. Also left out: the empty calendar/timetable,
the sign-in screen (a typed e-mail) and the blank whiteboard. Copy on these four is written by me, not supplied.

    node render_overlays.js ; python3 build_tour_reels.py 6 7 8 9

## Rebuilding

```bash
# 1. the app (see ../../LOCAL_SETUP.md): Postgres up, .env with DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY=dummy
#    and STUDENT_ACCOUNTS=true; then
pnpm --filter @workspace/db run migrate && pnpm --filter @workspace/db run seed:assessment
pnpm run dev:api                                              # :8080
(cd ../../artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api CI=1 npx expo export --platform web)
node capture/serve.mjs ../../artifacts/mobile/dist &          # :8081, SPA fallback

# 2. fictional demo state + signed-in browser sessions (wipes the LOCAL users table, then re-seed assessment)
capture/prep_all.sh

# 3. record a take, then build  (relogin first: access tokens last 15 min and refresh tokens rotate)
node capture/relogin.cjs demo.library@example.com r2  && node capture/r2_record.cjs
node capture/r3_record.cjs                          # r3 / r4 sessions: node capture/relogin.cjs demo.classes@example.com r3
node capture/relogin.cjs demo.messages@example.com r4 && node capture/r4_record.cjs

node render_overlays.js && python3 make_music.py out/bed.wav 23.5
python3 build_reel1.py && python3 build_reel2.py && python3 build_reel3.py && python3 build_reel4.py
node capture/relogin.cjs demo.library@example.com r2 && node capture/r5_record.cjs && python3 build_reel5.py
python3 verify_reel.py out/Iqrra_02_Library.mp4              # format, loudness, black frames, safe-zone margins
```

Recording uses Chrome's screencast (`capture/rec.cjs`) at 2× so the footage is crisp and scrolling stays smooth
(3× dropped to ~19 fps). It logs every pointer move and tap; `reel_lib.py` draws the arrow and the tap ripple from
that log, so a highlight always sits where the click really landed. Cameras are written in CSS pixels of the
390×844 viewport. Playwright is loaded from `/opt/node-tools` — adjust the path in `capture/common.cjs` elsewhere.

`take`s are committed (`capture/takes/*.mp4` + `.events.json`) so the reels rebuild without re-recording.

## Reel 1 notes

- The app's own «وضع العرض · محتوى تجريبي» badge is in that footage, so the reel carries the same label.
- Source windows skip the Claude toast (seg07 ≈8–12 s), the delete-slide confirm + Chrome print dialog
  (seg09 0–5 s) and a downloads bubble naming an unrelated `.pptx` (seg09 ≈13–16 s).
- The step-1 ripple on شرائح الدرس is the one drawn tap: the recording cuts from hovering that card to the tool open.

## Music

An original synthesised bed (`make_music.py`) — no third-party licence. The five stock tracks used by the
earlier reel are not in the repo and `docs/marketing-plan.md` still lists "music licences" as unbought. To use a
licensed track, replace `out/bed.wav` and rebuild.
