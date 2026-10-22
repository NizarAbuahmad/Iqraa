# Phone Today, friendlier empty states, a coloured Tools grid (PR 4)

Approved in chat on 2026-10-22. It follows the corner identities (#1167, #1169)
and the shared visual language (#1172).

## Problem

On a phone, a teacher opens straight into the chat (`index.tsx` redirects to
`/iqra`). The lesson, what is still missing for it and "Start class" exist only
on the desktop Today (`LessonWorkspace`).

Empty lists are a grey icon and two lines of text. On phones the Tools tab is a
plain list of rows.

## Decisions

1. **The phone tab bar for teachers** is Today, Library, Tools, Messages,
   Profile. «اسأل إقرأ» leaves the bar on phones only.
   - It stays in the desktop sidebar.
   - Its route stays registered (hidden), so every existing
     `router.push('/iqra')` still works.
   - Parents and students are unchanged: School, Library, Messages, Profile.
   - Tab visibility moves into a pure function (`services/tabVisibility.ts`)
     so it can be tested.
2. **A teacher on a phone lands on Today.** `index.tsx` renders a phone layout
   instead of redirecting to `/iqra`. Desktop keeps `LessonWorkspace`.
3. **One logic, two layouts.** The desktop's lesson logic moves unchanged into
   a hook, `useTodayLesson()`: which lesson, the prep board, skips, tool
   params, Start class, the next period and the setup nudge.
   - `LessonWorkspace` and the new `PhoneToday` both read it, so they cannot
     disagree about the lesson.
   - The phone also reloads on screen focus, because the web-only
     `window.focus` reload does not fire on native.
4. **The phone Today layout**, top to bottom:
   - A navy `Band` (`colors.ink`, the leaf motif, matching the desktop's navy
     band). It holds the date, the AI-source badge and the bell, a greeting
     with the teacher's first name (morning or evening by the hour), and the
     lesson panel: the period pill when the timetable gives one, subject and
     grade, the lesson title, amber «ابدأ الحصة» and «تغيير الدرس».
   - The setup nudge and the start-class error, the same as on desktop.
   - The prep checklist (`LessonPrepBoard`) on a `Surface`.
   - Four quick tools in their own colours (`PressableScale` + `useSurface`).
   - The ask card: up to two suggestions, a one-line input that opens the chat
     with the text already sent, and «افتح المحادثة».
   - The teacher's classes as chips.
   - The sections enter in turn (`Entrance`). The screen pays its own
     `insets.top`.
5. **No lesson bar on Today, on either size.** The lesson card is the bar's
   job done in full there.
   - `showLessonBar(pathname, …)` in `tabVisibility.ts` decides.
   - On phones the bell moves into Today's band (`NotificationBell` gains
     `onDark`).
6. **Friendlier empty states.** `EmptyState` becomes a lifted `Surface` card:
   the icon on a `colors.secondary` circle in `colors.primary`, the title, the
   body and the optional button.
   - School's two hand-drawn empty states (no homework; timetable not entered)
     move onto it, with no button, because a student or parent cannot fill
     either.
   - The five existing callers get the new look unchanged.
7. **The Tools tab on phones** becomes a two-column grid of the same cards
   desktop uses, with `useSurface()` and `PressableScale`, in `TAB_TOOLS`
   order. There are no headings: they were dropped on purpose on 2026-09-25,
   because with a dozen tools they cost scrolling without helping a teacher
   choose.
8. **Amber stays "now"**: only «ابدأ الحصة» and the period-now pill.

## Out of scope

- Celebrations.
- The dark-mode game-button contrast fix.
- Per-day period counts in the greeting: there is no reliable source today.
- Teacher «شُعبي»/exams sections on School: School is parent- and
  student-only.

## Verification

- `pnpm test` in `artifacts/mobile`:
  - `tabVisibility.test.ts`: tabs per role × device, `isHomePath`,
    `showLessonBar`, and `index.tsx` no longer redirecting teachers to `/iqra`;
  - `greeting.test.ts`.
- `pnpm run typecheck`.
- A screenshot pass:
  - phone Today and desktop Today, light and dark;
  - the Tools tab;
  - School empty (stubbed);
  - the classes/evaluations empty states.
