# Share a generated material by link — design

2026-11-20. Approved in chat by the product owner.

## Problem

A teacher who generates a lesson plan, quiz, worksheet, activity or deck wants to send it to a colleague on
WhatsApp so the colleague opens **that exact material** — without regenerating it. Today «مشاركة» sends plain text
(PR #1494 made it also copy), and `saved_materials` is owner-only: `routes/workspace.ts` serves a row only to the
teacher who saved it. No share link exists for materials (the exam's `/take/CODE` is for evaluations).

## Decisions (asked and answered)

1. **Anyone with the link can open it, no account.** A read-only page, like `/take/CODE`.
2. **Answer keys only for teachers.** The public page is the student copy (no keys). A signed-in teacher sees the
   full copy and can save it to their own files.
3. **Live, no expiry, can stop.** The link shows the current saved version. The owner can turn it off; deleting the
   material kills it too.

## Data

`saved_materials` gains two nullable columns (migration 0030, additive):

- `share_code text UNIQUE` — 8 characters from `SHARE_CODE_ALPHABET` (no I L O 0 1). 31⁸ ≈ 8.5 × 10¹¹: the exam's
  6 characters are fine for a code that expires in 7 days; a link that never expires gets two more.
- `shared_at timestamptz` — when the link was first made.

Turning sharing off sets both to null. A new share after that gets a **new** code, so an old forwarded link stays
dead.

## API

All under `artifacts/api-server`.

| Route | Who | Does |
| --- | --- | --- |
| `POST /workspace/items/:id/share` | the owner (teacher) | Returns `{ shareCode }`. Same code on every call while shared. |
| `DELETE /workspace/items/:id/share` | the owner | Clears the code. `{ ok: true }`. |
| `GET /shared/:code` | anyone | The material, **student copy** (`studentCopy`, `modules/homework/materialCopy.ts`). Rate-limited per IP. |
| `GET /shared/:code/full` | any teacher (`TEACHER_ROLES`) | The material with its answers. |
| `POST /shared/:code/save` | any teacher | Copies it into the caller's `saved_materials`; returns the new item. |

- The public read returns only `type, title, subject, grade, topic, language, content, savedAt` — never
  `formState` (it can hold a teacher's own notes: `priorTopicsNotes`, `adaptations`), never the owner's id or name.
- An unknown, malformed or stopped code is a 404, the same answer in every case.
- `toClientItem` adds `shareCode` so the owner's screens know a material is shared.
- The shared reads are another teacher's row, so they go through `systemDb` in one new file,
  `lib/sharedMaterial.ts`, pinned in `systemDbFiles.test.ts` (same reasoning as `lib/homeworkMaterial.ts`).
- **The copy's `formState`** keeps only number, boolean and short-string values, and drops the known free-text keys
  (`priorTopicsNotes`, `adaptations`, `objectives`, `objective`). The pickers and the lesson id survive, so «تعديل»
  on the copy reopens the right lesson and subject; the owner's private notes do not.
- The copy is a new row: title unchanged, not favourite, no class, no share code.

## App

- **Share button.** `useGeneratorExport` (quiz, worksheet, lesson plan, activity) and `workspace/view.tsx` gain
  «مشاركة رابط»: save first if the material has no server id (sign-in required — a device-only save cannot be
  shared, and says so), `POST …/share`, then `shareAsText("<title> — <url>")`, which also copies the link.
  The export menu's Share row becomes the link share where a material can be saved; the text share stays as
  «نسخ النص».
- **Link:** `${PROD_ORIGIN}/m/${code}` (`services/siteOrigin.ts`).
- **Public page:** `app/m/[code].tsx` renders `workspace/view.tsx` in a new read-only `shared` mode, loaded from
  `/shared/:code` (signed out, or not a teacher) or `/shared/:code/full` (a teacher). Teacher tools (edit, favourite,
  send, present) are hidden as in family mode. A teacher sees «احفظ في ملفاتي»; a visitor sees «سجّل لتحصل على نسخة
  بالإجابات», which opens sign-up.
- `/m` joins `PUBLIC_ROUTES` (`services/routeGating.ts`), and `crashReportingCore.ts` scrubs `/m/<code>` like
  `/take/<code>`.
- The material's own screen shows «مُشارَك برابط» with «إيقاف المشاركة».
- A «ما الجديد» entry for teachers.

## Out of scope

- A WhatsApp preview card (the web app has no per-route preview tags; the link shows as a plain URL).
- Opening the link inside the Android app (it opens in the browser).
- Showing who shared it.
- Sharing evaluations (they already have `/take/CODE`).
- ~~Whiteboards~~ — **shared since 2026-11-25** (see the status log, «Whiteboard: share a board by link»). A board is served whole, never through `studentCopy`: its `solution.answer` and steps are what the teacher showed the class, and the blanking rule would hand a student an empty board.

## Testing

- `materialShare.test.ts` (pure): code shape and alphabet; `copyableFormState` drops free text and keeps pickers.
- `sharedMaterial.db.test.ts` (Postgres): share is idempotent; stop clears and a re-share gets a new code; the public
  read has no `correctAnswer` / `answerKey` / `explanation` and no `formState`; the teacher read has them; a student
  account on `/full` is refused; save makes an owned copy without the owner's notes; unknown and stopped codes 404;
  another teacher cannot share or stop your material; deleting the material kills the link.
- `systemDbFiles.test.ts` and `mountOrder.test.ts` updated for the new file and the public `/shared` prefix.
- Mobile: `routeGating` test that `/m/X` is public; the share-URL builder uses `PROD_ORIGIN`.
