# Screens pass

Looks, not asserts. From the repo root:

1. `cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`
2. `cd e2e && node serve.mjs &` (serves `dist/` on :8098)
3. `OUT=/tmp/shots node screens.mjs` — then open the PNGs. Dark mode uses `prefers-color-scheme`, which the app reads once at startup.
