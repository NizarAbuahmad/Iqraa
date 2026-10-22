# Celebrations (PR 5)

Approved in chat on 2026-10-22. It follows the design refresh (#1167, #1169,
#1172, #1174).

## Problem

Finishing something in the app is silent. A student who hands in an exam sees
a grey check. Finishing a game shows a text line. Ticking off the last homework
looks like every other tick. A teacher whose prep checklist reaches 5 of 5
sees a number change.

## Decisions

1. **Four moments, chosen because each marks real progress:**
   - **A student hands in an exam** (`/take/CODE`). This fires only when this
     sitting is handed in, not when a paper that was already handed in is
     reopened or reported `already_submitted`. It is a big burst with
     «أحسنت! سُلّمت ورقتك». No score is shown: releasing results is the
     teacher's decision.
   - **A game in the games hub ends.** It is a small burst with «أحسنت!», or
     a big one with «علامة كاملة!» for a perfect score.
     - Trivia is perfect when every question is right.
     - The maths drill is perfect when it has at least one attempt and every
       attempt is correct.
     - Memory and colour-spot have no "perfect".
   - **A student ticks their last open homework.** This fires when the save
     succeeds and every trackable item for that child is done. It is a small
     burst with «أنجزت كل واجباتك». Parents never tick, so they never see it.
   - **A teacher's prep checklist reaches all ready** on Today, phone and
     desktop. It is a small burst with «الدرس جاهز».
2. **Fire on the crossing, never on the state.**
   - A moment fires only when, *for the same subject* (same lesson, same
     child, same game round), the condition goes from false to true within
     this session.
   - Opening Today at 5 of 5, switching to a lesson that is already complete,
     or reloading a fully-done homework list does nothing.
   - One pure function, `justCompleted(prev, next)`, decides this everywhere.
3. **One shared overlay, `Celebrate`.**
   - It is absolute-fill and `pointerEvents="none"`, so it never blocks a tap.
   - Confetti falls about 60% of the screen in about 1.2s, fading over its last
     third: 24 pieces for a big burst, 12 for a small one.
   - A `Surface` badge pops in the middle with a `checkmark-circle` in
     `colors.primary` and the message, then hides after about 1.8s.
   - The piece layout comes from a seeded generator (`confettiPieces`), so it
     is deterministic and testable.
   - Colours are the brand teal plus the five corners' light primaries. Amber
     is not used: it means "now".
4. **Feel and access.**
   - `Haptics.notificationAsync(Success)` on native.
   - `AccessibilityInfo.announceForAccessibility(message)`, so a screen-reader
     user hears it.
   - With reduced motion there is no confetti and no pop: the badge only fades
     in and out.
   - Every `Animated` call uses `NATIVE_DRIVER`.
5. **Left alone.** The classroom presentation keeps its own celebration, and
   the English hub's badges are unchanged.

## Verification

- `pnpm test`:
  - `celebration.test.ts`: `justCompleted` (the crossing, key change, the first
    measurement, regressions), the determinism and bounds of `confettiPieces`,
    and the colours (no amber, every corner present);
  - `allTrackedDone` in `homework.test.ts`;
  - source checks that each of the four moments mounts `Celebrate`.
- `pnpm run typecheck`.
- Screenshots of the overlay mid-burst (light and dark) and with reduced
  motion.
