/**
 * ESM resolve hook so `node --test` can follow the `@/*` -> repo-root alias
 * that Metro/tsconfig already resolve for the app and editor.
 *
 * Deliberately narrow: only specifiers starting with `@/` are touched. Plain
 * relative imports keep needing an explicit extension exactly as they do
 * today (see CLAUDE.md's extensionless-import note) — this hook must not
 * paper over that, since it's what makes a genuinely broken import fail loudly
 * instead of only under a bundler nobody runs in CI.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// This file lives in artifacts/mobile/scripts/ — one level below the root
// tsconfig's `@/*` -> `./*` maps against.
const PROJECT_ROOT = new URL('../', import.meta.url);

const CANDIDATES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) {
    return nextResolve(specifier, context);
  }

  const base = fileURLToPath(new URL(specifier.slice(2), PROJECT_ROOT));
  for (const ext of CANDIDATES) {
    if (existsSync(base + ext)) {
      return nextResolve(pathToFileURL(base + ext).href, context);
    }
  }

  // Nothing matched — resolve the plain path anyway so Node's own
  // ERR_MODULE_NOT_FOUND names the real file it looked for.
  return nextResolve(pathToFileURL(base).href, context);
}
