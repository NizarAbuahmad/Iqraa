# First-run spotlight tour (all roles) — design

2026-10-26. Built in the same PR; the write-up of what was verified is the top
entry of [`docs/status-log.md`](../../status-log.md).

## Why

A new teacher, student or parent landed on their home screen with no guidance.
The only intro is the pre-login carousel (`app/onboarding.tsx`), and the old
in-app «coach card» was retired (`app/faq.tsx`). The ask: walk a new user through
the app the way other apps do — dim the screen, cut out one real element, ring it,
say one thing about it, move on.

Decisions taken with the owner:

- **Audience:** every role (teacher, student, parent), each with its own steps. An
  admin has none.
- **Style:** a spotlight tour on the real home screen, four to six steps, plus
  Profile → «Replay the tour». Not a slide deck, not a checklist.
- **Who sees it on its own:** new accounts only (see *Eligibility*). Existing users
  use Replay.
- **Where "seen" lives:** on the device, per account. No migration.

Improvement over the reference screenshots: the text sits on a **solid card**, not
on the dim layer, so contrast holds in light and dark and in both languages. The
dashed ring, the connector line and its dot are kept.

## Shape

A module-level target registry and tour store read with `useSyncExternalStore`;
**no provider**. One `<TourHost>` overlay is mounted at the root, beside `AppSplash`
and `ConfirmHost`. It is not a `<Modal>`: a Modal is a separate native window, and
on web only gets its Escape key and focus trap after an `animationend` that some
embedded browsers never fire.

| Piece | Where | Pure? |
|---|---|---|
| Steps per role × layout, eligibility, step navigation, storage keys | `services/tour.ts` | yes |
| Live state (current step) and the analytics for how a tour ended | `services/tourStore.ts` | yes |
| Where a target is: registrants per id, first one with an area | `services/tourRegistry.ts` | yes |
| Geometry: hole, scrim path, card placement, connector | `services/tourPlacement.ts` | yes |
| AsyncStorage I/O (fails closed) | `services/tourStorage.ts` | no |
| Overlay, card, target registration, tab button | `components/tour/` | no |
| Autostart and Replay hooks | `hooks/useTour.ts` | no |

`node --test` loads only the pure ones (no `react-native` import), which is where
nearly all the logic is.

## Steps

A step points at a **target id** by name. A phone's tab bar registers `tab-<name>`
(a custom `tabBarButton` around the same `PlatformPressable`, so no layout change);
the desktop sidebar rows register `nav-<name>`; Today's elements register
`today-lesson`, `today-prep`, `today-ask`. A step whose target is not on screen
after about 0.7 s is dropped, not drawn around nothing.

| Role / layout | Steps |
|---|---|
| Teacher, phone | welcome → lesson panel → prep board → ask card (scrolled into view) → Tools tab → Profile tab |
| Teacher, desktop | welcome → lesson header → prep board → sidebar Ask Iqrra → Tools → Profile |
| Student | welcome → Library → School → Messages → Profile |
| Parent | welcome → School → Messages → Profile |

The bell is left out: it duplicates Messages for non-teachers, and a teacher's phone
already has it in the lesson band. The welcome step has no target and is centred.

`tourTargets.test.ts` reads the source on both sides: every literal target a step
names must be registered by some screen, and no step may point at a tab its role
cannot see. Rename `today-prep` on one side and it fails.

## Eligibility

`tourBlocker` returns why the tour must not start now, or `null`. It starts only
when **all** hold:

- the auth state has loaded, the account has a tour (not an admin), and both the
  per-account done flag and the device-wide switch have been **read** (an unread
  flag blocks, so a slow storage read never starts it twice);
- the user is on its role's own home route — teacher `/`, student `/curriculum`,
  parent `/notifications` — and has been for ~700 ms, so a redirect in flight never
  starts it;
- none of `needsTeacherSetup`, `needsRosterClaim`, `needsGradeSetup`,
  `needsGuardianApproval` applies. These are the root layout's own gates, **imported
  from `routeGating.ts`**, not copies of them (an unread «skip the class picker»
  flag counts as not skipped);
- the account was created on or after `TOUR_SINCE` (2026-10-26) and no more than
  14 days ago, so nobody who signed up before it shipped is ambushed mid-semester.

It is **marked done when it starts**, not when it ends: a process killed halfway never
shows it again, and Skip, Escape, Done and Back-out need no separate branch.
Storage reads fail **closed** (a broken store reads as done / suppressed).

`@iqra_tour_off_v1` = `'1'` is a device-wide switch. The e2e journey sets it because
the per-account flag cannot be pre-seeded (the user id does not exist yet).

## Overlay

- Sized from its **own `onLayout`**, with its own origin subtracted from each
  target's window rectangle, which absorbs an Android status-bar or edge-to-edge
  offset without knowing about either.
- One `react-native-svg` `<Svg>`: the scrim is a single `<Path fillRule="evenodd">`
  (whole screen, then the hole), plus the dashed ring and the connector with its
  dot. Dark mode uses a black-based scrim because a navy veil barely dims a navy page.
- Card placement (`tourPlacement.ts`): **beside** a narrow target at a side edge on a
  wide screen (a sidebar row — the card below it would cover the rows the next steps
  point at); else **below**, else **above**, else **docked** at the far edge (the prep
  board is too tall for either). Never beside on a phone.
- Targets below the fold (phone Today's prep board and ask card) are scrolled to the
  top before measuring: a zero-height anchor and the target scroll together, so
  measuring both gives the target's place in the content whatever the offset.
- Measures after the layout settles, retries ~6 × 100 ms, then drops the step. Re-measures
  on a resize, keeping the old ring until the new one lands.
- Dragging a desktop window across the sidebar breakpoint swaps the sidebar for the
  tab bar and so every target id; the tour then ends as **skipped** rather than
  reporting `tour_completed` after every remaining step was dropped.

## Accessibility

While a tour is up, the app behind it is hidden from assistive technology with
`aria-hidden` on a wrapper around the `Stack` — the one spelling all three platforms
act on (React Native maps it to Android's `importantForAccessibility` and iOS's
`accessibilityElementsHidden`; react-native-web ignores those two and only puts
`aria-hidden` on the DOM).

Web: `role="dialog"`, `aria-modal`, Escape skips (capture-phase keydown, as
`CommandPalette`), Tab is trapped on the card, focus moves to Next each step with
the brand's 3 px focus ring. Because the card stays mounted, Next keeps focus and
nothing would be announced, so the title and sentence sit in an `aria-live="polite"`
region. Native: `accessibilityViewIsModal` (iOS) and `announceForAccessibility` per
step. Hardware Back steps back, then skips. Targets are 44 pt, state is `aria-*`,
motion respects reduce-motion. A deep link or push that navigates away from the home
route ends the tour. ⌘K is ignored while a tour is up (the palette's Escape / Tab
handling would fight the tour's).

The card is capped at the screen height less its margins, and its title and sentence
scroll past that: large accessibility text can make them taller than a small phone,
and Skip and Next must never leave the screen. The centred and docked positions are
clamped to the margin for the same reason.

## Replay

Profile's row asks for a replay (`requestReplay`) and navigates home; the tour starts
once the home screen has arrived and held still, exactly as the automatic start does.
A fixed delay after navigating could fire before a slow device got there, and the
overlay ends a tour that is not on the home route. A request that never reaches home
lapses after 8 s.

## Analytics

`tour_started {role, layout}`, `tour_replayed {role, layout}`, `tour_step {step, index}`,
`tour_completed {steps}`, `tour_skipped {atStep, index}`. No new `EXPO_PUBLIC_*` key.
`tour_step` is sent when a step is **shown** (the overlay calls `reportStepShown`), not when
Next is pressed: a step whose target never appears is dropped before it is seen and must not
count. Steps whose target is not mounted are left out when the tour begins, so "of N" is
fixed for the whole tour, and a tour with nothing left to point at does not start.

## Out of scope

A cross-device «seen» flag (needs a migration and an API); tours of individual tools
(the generators); any change to the pre-login carousel; removing the dead
`wasCoachDismissed` / `coach*` code.
