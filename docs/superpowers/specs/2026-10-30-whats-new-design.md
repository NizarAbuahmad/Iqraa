# «ما الجديد» — telling existing users about a new feature

2026-10-30. Asked for as «How to inform users of each new features we add?»; the
recommendation (an in-app list, shipped in the same PR as the feature) was approved
with «Go».

## Problem

Nothing in the app tells an existing user that something changed. The first-run
tour (`services/tour.ts`) is for new accounts only; the admin broadcast
(`POST /admin/broadcasts`) mails the iqrra.com waitlist, not app users; pushes fire
only on classroom events. A feature that ships is found by accident or not at all.

## What it is

1. **A list in source**, `artifacts/mobile/services/whatsNew.ts`: `WHATS_NEW`,
   newest first. An entry has an `id`, the Amman `date` it reached users, the
   `roles` it is for (teacher / student / parent), a title and a body as i18n keys,
   and an optional `route` that its «جرّبها» button opens.
2. **A dialog, once per account**, mounted at the root (`WhatsNewHost`, beside
   `TourHost`). It shows the unseen entries for the account's role, at most three,
   newest first, when the account lands on its home screen. Every entry it shows is
   marked seen at the moment it opens, as the tour is marked done when it starts: a
   killed app never shows the same note twice.
3. **A screen**, `/whats-new`, opened from Profile («ما الجديد»), listing every
   entry for the role, read or not. Opening it marks them all seen.

## Who sees an entry

`unseenFor` / `whatsNewBlocker` (pure, pinned by `whatsNewTest`):

- The entry names the account's role. Admins have no role here, as in the tour.
- The account was created **before** the entry's date. A newer account met the
  feature as part of the app; the tour is how it learns the app.
- The entry's date has arrived (a future date stays hidden until that day) and is at
  most `WHATS_NEW_MAX_AGE_DAYS` (45) old, so someone returning after months is not
  handed a backlog. The Profile screen still lists old entries.
- The same gates the tour waits for: home route, no guardian / roster / teacher /
  grade setup pending.
- Never on top of the tour: not while it runs or a replay is pending, and not for an
  account still young enough for its own tour (`TOUR_SINCE`, `TOUR_MAX_AGE_DAYS`)
  that has not had it.
- Not on a device with the tour's off switch (`@iqra_tour_off_v1`), which the e2e
  journey sets.

Storage is per account on the device (`@iqra_whats_new_seen_v1:<id>`, a JSON list
of ids), like the tour's flag. A read that fails counts as "all seen": a device that
cannot remember never nags. A teacher on phone and web sees a note on each; that is
accepted for now.

## Analytics

`whats_new_shown` (`role`, `count`, `ids`), `whats_new_opened` (`id`, `source`:
`dialog` | `screen`), `whats_new_closed` (`count`).

## The rule for every PR

A user-visible feature adds an entry to `WHATS_NEW` in the same PR, dated the day it
merges, or says in the PR body why it does not need one. `whatsNew.test.ts` checks
that every entry has a unique id and a real date, that both languages have its
keys, and that its route is a screen every one of its roles may open
(`routeGating.ts`).

## Not in this change

A «جديد» badge on a tool tile, a one-step spotlight, email to app users (needs its
own consent), announcement pushes, and server-side seen state.
