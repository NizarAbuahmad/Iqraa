# Screens pass

Looks, not asserts. From the repo root:

1. `cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`
2. `cd e2e && node serve.mjs &` (serves `dist/` on :8098)
3. `OUT=/tmp/shots node screens.mjs` — then open the PNGs. Dark mode uses `prefers-color-scheme`, which the app reads once at startup.

`ONLY=library,profile` shoots a subset (names from `ROUTES`). `UI_LANG=en` shoots
the English UI instead of Arabic (file names end in `-en`) — check a row layout in
both, since direction is set per component, not by the document. `REDUCED=1` emulates
`prefers-reduced-motion: reduce` and shoots the moment the splash is gone, with no
settle wait — this checks that the reduced-motion screens render correctly. It cannot show
that nothing moves: on a cold load the entrance finishes behind the splash. For
that, navigate in-app into a corner (e.g. library to a hub) with reduced motion
on and look at the first frame.
