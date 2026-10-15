# Shrinking photos on a phone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A photo picked on a phone is shrunk to ≤1600px (JPEG 0.72) one photo at a time before it becomes a data URL, and the full-resolution base64 is never held in JavaScript.

**Architecture:** The decision logic (which path, no-op for small photos, fallback to the original, `null` on total failure, strictly sequential multi-photo encoding) lives in `photoEncode.ts`, which imports nothing from `react-native` / `expo-*` and takes its platform calls as injected `deps` — so `node --test` can pin it. `imageDownscale.ts` supplies the real `deps` (web canvas, `expo-image-manipulator`, `expo-file-system/legacy`). The five photo-picking helpers stop asking the picker for base64 on native and go through one shared function.

**Tech Stack:** Expo SDK 54, `expo-image-manipulator` `~14.0.8` (new native module), `expo-image-picker`, `expo-file-system/legacy`, `node:test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-10-15-native-photo-downscaling-design.md`

## Global Constraints

- **`expo-image-manipulator` is `~14.0.8`** — the pin in `expo/bundledNativeModules.json` for SDK 54. Published 2025-12-05, so it clears the workspace's `minimumReleaseAge: 1440`.
- **`app.json` `version` goes `1.3.0` → `1.4.0` in the same commit that adds the dependency** (CLAUDE.md, «`app.json`'s `version` is the OTA compatibility key»). Never one without the other.
- **`expo-image-manipulator` and `expo-file-system/legacy` are imported lazily, inside the native branch only** (`await import(...)`), so the web bundle and `node --test` never load them.
- **`imageFit.ts` and `photoEncode.ts` import nothing from `react-native` or `expo-*`.** Anything loaded by `node --test` uses explicit `.ts` import extensions.
- **Constants:** long edge `MAX_SCAN_EDGE = 1600` (avatar keeps its own `512`); JPEG quality `0.72` on both web and native; the native picker is asked for `quality: 1` and **no** base64.
- **Pass exactly one of `width` / `height` to the manipulator**, never both (aspect can never be distorted).
- **Sequential only.** Never encode two photos at once; peak memory must stay at one photo.
- Mobile tests live in `artifacts/mobile/services/__tests__/` only (the runner's glob). Run them with `cd artifacts/mobile && pnpm test`; a single file with `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<file>`.
- Server size limits, web behaviour, `DEMO_MODE` and all user-facing strings are **not** touched. No i18n keys are added.
- Typecheck from the repo root: `pnpm run typecheck` (building libs first matters; `tsc` inside one package alone gives TS6305).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `artifacts/mobile/package.json`, `pnpm-lock.yaml` | modify | add `expo-image-manipulator` |
| `artifacts/mobile/app.json` | modify | `version` 1.4.0 |
| `artifacts/mobile/services/imageFit.ts` | modify | add `ResizeArg` + `resizeArg()` (pure) |
| `artifacts/mobile/services/photoEncode.ts` | **create** | `PickedPhoto`, `PhotoDeps`, `encodePickedPhoto`, `encodePickedPhotos` (pure, injected deps) |
| `artifacts/mobile/services/imageDownscale.ts` | modify | real `deps`; export `pickedPhotoToDataUrl`, `pickedPhotosToDataUrls`, `PICK_BASE64`, `photoPickQuality`; rewrite the header comment |
| `artifacts/mobile/services/documents/pick.ts`, `messaging.ts`, `avatarPick.ts`, `lessonMediaPick.ts` | modify | the five helpers use the shared function |
| `artifacts/mobile/services/__tests__/imageDownscale.test.ts` | modify | `resizeArg` tests |
| `artifacts/mobile/services/__tests__/photoEncode.test.ts` | **create** | encode logic with fake deps |
| `artifacts/mobile/services/__tests__/photoPickers.test.ts` | **create** | source-text guard on the five helpers |
| `STATUS.md` | modify | the known limit becomes a shipped-but-unverified change + the 1.4.0 entry |

---

### Task 1: The dependency and the version bump (one commit)

**Files:**
- Modify: `artifacts/mobile/package.json`, `pnpm-lock.yaml`, `artifacts/mobile/app.json:5`

**Interfaces:**
- Produces: `import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'` resolves and typechecks (used by Task 4).

- [ ] **Step 1: Add the dependency**

```bash
cd /home/user/Iqraa && pnpm --filter @workspace/mobile add expo-image-manipulator@~14.0.8
```
(If the package name differs, read `name` in `artifacts/mobile/package.json` and use that.) Expected: `package.json` gains `"expo-image-manipulator": "~14.0.8"` in `dependencies`; `pnpm-lock.yaml` changes.

- [ ] **Step 2: Bump the version in the same change**

In `artifacts/mobile/app.json` change line 5 from `"version": "1.3.0",` to `"version": "1.4.0",`. Change nothing else in the file.

- [ ] **Step 3: Verify the diff is only what was intended**

Run: `git diff --stat`
Expected: exactly `artifacts/mobile/package.json`, `artifacts/mobile/app.json`, `pnpm-lock.yaml`. In `pnpm-lock.yaml` the only added packages are `expo-image-manipulator` (and nothing that is not a dependency of it). If other packages moved, stop and report.

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: all projects `Done`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/package.json artifacts/mobile/app.json pnpm-lock.yaml
git commit -m "mobile: add expo-image-manipulator and bump version to 1.4.0 (new native module)"
```

---

### Task 2: `resizeArg` — which single dimension to cap

**Files:**
- Modify: `artifacts/mobile/services/imageFit.ts`
- Test: `artifacts/mobile/services/__tests__/imageDownscale.test.ts`

**Interfaces:**
- Produces: `export type ResizeArg = { width: number } | { height: number };` and `export function resizeArg(width: number, height: number, maxEdge: number): ResizeArg | null` — `null` means «leave the photo alone» (already within `maxEdge`, **or** dimensions unknown/invalid). Exactly one key is ever present.

- [ ] **Step 1: Write the failing tests**

Add to the imports of `services/__tests__/imageDownscale.test.ts` `resizeArg`, i.e. change `import { fitWithin, MAX_SCAN_EDGE } from '../imageFit.ts';` to `import { fitWithin, MAX_SCAN_EDGE, resizeArg } from '../imageFit.ts';`, and append:

```ts
describe('resizeArg', () => {
  it('caps the height of a portrait photo and leaves the width to the manipulator', () => {
    assert.deepEqual(resizeArg(3024, 4032, 1600), { height: 1600 });
  });

  it('caps the width of a landscape photo', () => {
    assert.deepEqual(resizeArg(4032, 3024, 1600), { width: 1600 });
  });

  it('caps the width of a square photo', () => {
    assert.deepEqual(resizeArg(3000, 3000, 1600), { width: 1600 });
  });

  it('is null for a photo already within the limit — no resize, no re-encode', () => {
    assert.equal(resizeArg(800, 600, 1600), null);
    assert.equal(resizeArg(1600, 1200, 1600), null);
    assert.equal(resizeArg(1200, 1600, 1600), null);
  });

  it('is null when the dimensions are unknown, never a guess', () => {
    for (const [w, h] of [[0, 100], [100, 0], [-5, 5], [NaN, 100], [Infinity, 100]]) {
      assert.equal(resizeArg(w!, h!, 1600), null, `${w}x${h}`);
    }
  });

  it('never returns both keys, so the aspect ratio cannot be distorted', () => {
    for (const [w, h] of [[8000, 3], [3, 8000], [4032, 3024], [3024, 4032], [2000, 2000]]) {
      const arg = resizeArg(w!, h!, 1600);
      assert.ok(arg, `${w}x${h}`);
      assert.equal(Object.keys(arg!).length, 1, `${w}x${h}`);
    }
  });

  it('uses the limit it is given, not the scan default', () => {
    assert.deepEqual(resizeArg(3024, 4032, 512), { height: 512 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/imageDownscale.test.ts`
Expected: FAIL — `resizeArg` is not exported (SyntaxError / "does not provide an export named 'resizeArg'").

- [ ] **Step 3: Implement**

Append to `services/imageFit.ts`:

```ts
/** The one dimension to give the native manipulator; it works out the other. */
export type ResizeArg = { width: number } | { height: number };

/**
 * What to pass `resize()` so a photo's long edge becomes `maxEdge`, or `null`
 * to leave it alone.
 *
 * Exactly one of `width` / `height` is returned. The manipulator derives the
 * other from the image's own aspect ratio, so the result can never be
 * stretched — which matters because the picker's reported width/height may be
 * the stored (unrotated) size of an EXIF-rotated photo. If they are
 * transposed the cap lands on the other axis and the photo ends up a little
 * larger than `maxEdge`, never distorted.
 *
 * `null` covers both «already small enough» and «dimensions unknown»: in
 * neither case is there a safe resize to ask for, and the caller falls back to
 * the photo as it is.
 */
export function resizeArg(width: number, height: number, maxEdge: number): ResizeArg | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (!(width > 0) || !(height > 0)) return null;
  if (Math.max(width, height) <= maxEdge) return null;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: the command from Step 2.
Expected: PASS — all `fitWithin` tests still pass and the 7 new `resizeArg` tests pass.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/imageFit.ts artifacts/mobile/services/__tests__/imageDownscale.test.ts
git commit -m "mobile: resizeArg — the single dimension to cap when shrinking a photo"
```

---

### Task 3: `photoEncode` — the decision logic, with injected platform calls

**Files:**
- Create: `artifacts/mobile/services/photoEncode.ts`
- Test: `artifacts/mobile/services/__tests__/photoEncode.test.ts`

**Interfaces:**
- Consumes: `MAX_SCAN_EDGE`, `resizeArg`, `ResizeArg` from `./imageFit.ts`.
- Produces:
  - `export interface PickedPhoto { uri: string; width: number; height: number; mimeType?: string | null; base64?: string | null }` (structurally compatible with `ImagePicker.ImagePickerAsset`)
  - `export interface PhotoDeps { platform: 'web' | 'native'; webDownscale(dataUrl: string, maxEdge: number): Promise<string>; nativeResize(uri: string, arg: ResizeArg): Promise<string>; readAsBase64(uri: string): Promise<string> }` — `nativeResize` resolves with the **base64 body** of a JPEG (no `data:` prefix); `readAsBase64` resolves with the base64 body of the file as it is.
  - `export function encodePickedPhoto(asset: PickedPhoto, deps: PhotoDeps, maxEdge?: number): Promise<string | null>`
  - `export function encodePickedPhotos(assets: PickedPhoto[], deps: PhotoDeps, maxEdge?: number): Promise<string[]>` — sequential, order kept, failed photos omitted.

- [ ] **Step 1: Write the failing tests**

Create `services/__tests__/photoEncode.test.ts`:

```ts
/**
 * Which way a picked photo is turned into a data URL, and what happens when
 * the shrinking fails.
 *
 * The platform calls are injected, so this runs under `node --test`. What it
 * pins: a big photo is resized with a single dimension, a small one is not
 * re-encoded, a failed resize falls back to the original rather than losing
 * the photo, and several photos are never in flight at once — that last one is
 * the property phone memory depends on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodePickedPhoto,
  encodePickedPhotos,
  type PhotoDeps,
  type PickedPhoto,
} from '../photoEncode.ts';

function fakeDeps(over: Partial<PhotoDeps> = {}) {
  const calls: string[] = [];
  const deps: PhotoDeps = {
    platform: 'native',
    async webDownscale(url, edge) {
      calls.push(`web:${edge}`);
      return `${url}#small`;
    },
    async nativeResize(uri, arg) {
      calls.push(`resize:${uri}:${JSON.stringify(arg)}`);
      return 'SMALL64';
    },
    async readAsBase64(uri) {
      calls.push(`read:${uri}`);
      return 'FULL64';
    },
    ...over,
  };
  return { deps, calls };
}

const photo = (over: Partial<PickedPhoto> = {}): PickedPhoto => ({
  uri: 'file:///a.jpg',
  width: 3024,
  height: 4032,
  mimeType: 'image/jpeg',
  ...over,
});

describe('encodePickedPhoto — native', () => {
  it('resizes a big portrait photo by its height and returns the shrunk JPEG', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo(), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
    assert.deepEqual(calls, ['resize:file:///a.jpg:{"height":1600}']);
  });

  it('resizes a big landscape photo by its width', async () => {
    const { deps, calls } = fakeDeps();
    await encodePickedPhoto(photo({ width: 4032, height: 3024 }), deps);
    assert.deepEqual(calls, ['resize:file:///a.jpg:{"width":1600}']);
  });

  it('uses the limit it is given', async () => {
    const { deps, calls } = fakeDeps();
    await encodePickedPhoto(photo(), deps, 512);
    assert.deepEqual(calls, ['resize:file:///a.jpg:{"height":512}']);
  });

  it('labels a shrunk PNG as a JPEG — that is what the manipulator wrote', async () => {
    const { deps } = fakeDeps();
    const out = await encodePickedPhoto(photo({ mimeType: 'image/png' }), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
  });

  it('reads a photo that is already small as it is, with no re-encode', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 800, height: 600, mimeType: 'image/png' }), deps);
    assert.equal(out, 'data:image/png;base64,FULL64');
    assert.deepEqual(calls, ['read:file:///a.jpg']);
  });

  it('reads a photo of unknown size as it is rather than guessing a resize', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 0, height: 0 }), deps);
    assert.equal(out, 'data:image/jpeg;base64,FULL64');
    assert.deepEqual(calls, ['read:file:///a.jpg']);
  });

  it('defaults the type to JPEG when the picker did not say', async () => {
    const { deps } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 100, height: 100, mimeType: undefined }), deps);
    assert.equal(out, 'data:image/jpeg;base64,FULL64');
  });

  it('falls back to the original when the resize throws', async () => {
    const { deps, calls } = fakeDeps({
      async nativeResize() {
        throw new Error('out of memory');
      },
    });
    const out = await encodePickedPhoto(photo({ mimeType: 'image/heic' }), deps);
    assert.equal(out, 'data:image/heic;base64,FULL64');
    assert.deepEqual(calls, ['read:file:///a.jpg']);
  });

  it('falls back to the original when the resize returns nothing', async () => {
    const { deps } = fakeDeps({ nativeResize: async () => '' });
    const out = await encodePickedPhoto(photo(), deps);
    assert.equal(out, 'data:image/jpeg;base64,FULL64');
  });

  it('is null when the resize and the read both fail', async () => {
    const { deps } = fakeDeps({
      nativeResize: async () => {
        throw new Error('x');
      },
      readAsBase64: async () => {
        throw new Error('y');
      },
    });
    assert.equal(await encodePickedPhoto(photo(), deps), null);
  });

  it('is null when the original reads back empty', async () => {
    const { deps } = fakeDeps({ readAsBase64: async () => '' });
    assert.equal(await encodePickedPhoto(photo({ width: 10, height: 10 }), deps), null);
  });
});

describe('encodePickedPhoto — web', () => {
  const web = (over: Partial<PhotoDeps> = {}) => fakeDeps({ platform: 'web', ...over });

  it('hands the picker\'s base64 to the canvas path with the limit', async () => {
    const { deps, calls } = web();
    const out = await encodePickedPhoto(photo({ base64: 'ABC', mimeType: 'image/png' }), deps, 512);
    assert.equal(out, 'data:image/png;base64,ABC#small');
    assert.deepEqual(calls, ['web:512']);
  });

  it('is null when the picker returned no base64', async () => {
    const { deps, calls } = web();
    assert.equal(await encodePickedPhoto(photo({ base64: undefined }), deps), null);
    assert.deepEqual(calls, []);
  });

  it('returns the photo unshrunk if the canvas path throws', async () => {
    const { deps } = web({
      webDownscale: async () => {
        throw new Error('decode');
      },
    });
    assert.equal(
      await encodePickedPhoto(photo({ base64: 'ABC' }), deps),
      'data:image/jpeg;base64,ABC',
    );
  });

  it('never touches the native calls', async () => {
    const { deps, calls } = web();
    await encodePickedPhoto(photo({ base64: 'ABC' }), deps);
    assert.equal(calls.some(c => c.startsWith('resize') || c.startsWith('read')), false);
  });
});

describe('encodePickedPhotos', () => {
  it('never has two photos in flight — peak memory is one photo', async () => {
    let inFlight = 0;
    let peak = 0;
    const { deps } = fakeDeps({
      async nativeResize() {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 5));
        inFlight -= 1;
        return 'SMALL64';
      },
    });
    const assets = Array.from({ length: 6 }, (_, i) => photo({ uri: `file:///${i}.jpg` }));
    const out = await encodePickedPhotos(assets, deps);
    assert.equal(out.length, 6);
    assert.equal(peak, 1);
  });

  it('keeps the order of the photos', async () => {
    const { deps } = fakeDeps({ nativeResize: async uri => uri.slice(-5, -4) });
    const assets = ['a', 'b', 'c'].map(n => photo({ uri: `file:///x${n}.jpg` }));
    assert.deepEqual(await encodePickedPhotos(assets, deps), [
      'data:image/jpeg;base64,a',
      'data:image/jpeg;base64,b',
      'data:image/jpeg;base64,c',
    ]);
  });

  it('leaves out a photo that could not be read and keeps the rest', async () => {
    const { deps } = fakeDeps({
      async nativeResize(uri) {
        if (uri.includes('bad')) throw new Error('x');
        return 'SMALL64';
      },
      async readAsBase64() {
        throw new Error('y');
      },
    });
    const out = await encodePickedPhotos(
      [photo({ uri: 'file:///1.jpg' }), photo({ uri: 'file:///bad.jpg' }), photo({ uri: 'file:///3.jpg' })],
      deps,
    );
    assert.equal(out.length, 2);
  });

  it('is empty for no photos', async () => {
    const { deps } = fakeDeps();
    assert.deepEqual(await encodePickedPhotos([], deps), []);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/photoEncode.test.ts`
Expected: FAIL — cannot find module `../photoEncode.ts`.

- [ ] **Step 3: Implement**

Create `services/photoEncode.ts`:

```ts
/**
 * Turning a picked photo into a data URL, smaller — the decisions only.
 *
 * Split from `imageDownscale.ts` for the reason `routeGating.ts` gives: that
 * file reaches for `react-native` and the DOM, and `node --test` can load
 * neither. The platform calls are passed in as `deps`, so what is worth
 * pinning — which path a photo takes, what happens when shrinking fails, that
 * several photos are handled one at a time — lives where tests can reach it.
 *
 * On web the picker hands over base64 and a canvas shrinks it. On a phone the
 * picker hands over only a file `uri`, one photo is shrunk natively, and only
 * the *shrunk* JPEG is ever turned into a string — the full-resolution photo is
 * never held in JavaScript, which is what 40 class-scan photos need.
 */
import { MAX_SCAN_EDGE, resizeArg, type ResizeArg } from './imageFit.ts';

/** What the picker gives us about one photo (a subset of `ImagePickerAsset`). */
export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
  mimeType?: string | null;
  /** Present only when the picker was asked for it, i.e. on web. */
  base64?: string | null;
}

export interface PhotoDeps {
  platform: 'web' | 'native';
  /** Web: shrink a data URL on a canvas. Never needs to throw. */
  webDownscale(dataUrl: string, maxEdge: number): Promise<string>;
  /** Native: shrink the file at `uri`; resolves with the base64 body of a JPEG. */
  nativeResize(uri: string, arg: ResizeArg): Promise<string>;
  /** Native: the file at `uri` as it is, as a base64 body. */
  readAsBase64(uri: string): Promise<string>;
}

const dataUrl = (mime: string, base64: string) => `data:${mime};base64,${base64}`;

/**
 * One photo as a data URL, or `null` when it cannot be read at all (every
 * caller already treats that like a cancelled pick).
 *
 * A failed resize falls back to the original rather than losing the photo —
 * that is today's behaviour on a phone, so it is never worse than before, and
 * the server's size refusal then names the problem.
 */
export async function encodePickedPhoto(
  asset: PickedPhoto,
  deps: PhotoDeps,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string | null> {
  const mime = asset.mimeType || 'image/jpeg';

  if (deps.platform === 'web') {
    if (!asset.base64) return null;
    const original = dataUrl(mime, asset.base64);
    try {
      return await deps.webDownscale(original, maxEdge);
    } catch {
      return original;
    }
  }

  const arg = resizeArg(asset.width, asset.height, maxEdge);
  if (arg) {
    try {
      const shrunk = await deps.nativeResize(asset.uri, arg);
      // The manipulator writes a JPEG whatever the input was.
      if (shrunk) return dataUrl('image/jpeg', shrunk);
    } catch {
      // fall through to the original
    }
  }

  try {
    const original = await deps.readAsBase64(asset.uri);
    return original ? dataUrl(mime, original) : null;
  } catch {
    return null;
  }
}

/**
 * Several photos, **one at a time**, in order. Strictly sequential on purpose:
 * running them together would hold several decoded photos at once, which is the
 * thing this module exists to avoid. A photo that cannot be read is left out.
 */
export async function encodePickedPhotos(
  assets: PickedPhoto[],
  deps: PhotoDeps,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string[]> {
  const out: string[] = [];
  for (const asset of assets) {
    const url = await encodePickedPhoto(asset, deps, maxEdge);
    if (url) out.push(url);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: the command from Step 2.
Expected: PASS — 19 tests (11 native, 4 web, 4 multi-photo).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/photoEncode.ts artifacts/mobile/services/__tests__/photoEncode.test.ts
git commit -m "mobile: photoEncode — shrink one photo at a time, fall back to the original, never two in flight"
```

---

### Task 4: Wire the real platform calls into `imageDownscale.ts`

**Files:**
- Modify: `artifacts/mobile/services/imageDownscale.ts` (whole file replaced; `downscaleImage`'s body is unchanged except the quality constant)

**Interfaces:**
- Consumes: `encodePickedPhoto`, `encodePickedPhotos`, `PhotoDeps`, `PickedPhoto` from `./photoEncode.ts`; `ImageManipulator`, `SaveFormat` from `expo-image-manipulator`; `readAsStringAsync` from `expo-file-system/legacy`.
- Produces (used by Task 5):
  - `export const PICK_BASE64: boolean` — `true` on web only; pass as the picker's `base64` option.
  - `export function photoPickQuality(webQuality: number): number` — `webQuality` on web, `1` on native; pass as the picker's `quality`.
  - `export function pickedPhotoToDataUrl(asset: PickedPhoto, maxEdge?: number): Promise<string | null>`
  - `export function pickedPhotosToDataUrls(assets: PickedPhoto[], maxEdge?: number): Promise<string[]>`
  - `downscaleImage(dataUrl, maxEdge?)` unchanged (still exported), plus the existing re-exports `fitWithin`, `MAX_SCAN_EDGE`, and a re-exported type `PickedPhoto`.

This file imports `react-native` and `expo-*`, so it cannot be unit-tested; the logic it calls is pinned in Task 3 and the call sites in Task 5. Verification here is typecheck.

- [ ] **Step 1: Replace the file**

Overwrite `services/imageDownscale.ts` with:

```ts
/**
 * Shrinking a photo before it is sent to be read.
 *
 * A teacher photographs a marked paper with whatever their phone does by
 * default — twelve megapixels, several megabytes, and a third larger again
 * once it is base64 for the data URL. The first real scan in production was
 * refused for exactly that reason.
 *
 * The fix is to send less, not to accept more. A page of handwritten marks is
 * legible at about 1600px on the long edge; beyond that every extra pixel is
 * bytes uploaded over a phone connection and tokens paid for, and buys nothing
 * a reader can use.
 *
 * **Two paths, one result.** On web the picker returns base64 and a canvas
 * shrinks it (`downscaleImage`). On a phone the picker is asked for a file `uri`
 * only — no base64, no picker-side compression — and `expo-image-manipulator`
 * shrinks one photo at a time, so the full-resolution photo is never a string in
 * JavaScript. Both end as a JPEG at quality `SHRUNK_JPEG_QUALITY`. The decisions
 * (which path, the fallback, one at a time) are in `photoEncode.ts`, which
 * tests can load; this file only supplies the platform calls.
 *
 * Adding `expo-image-manipulator` changed the native surface, which is why
 * `app.json`'s `version` moved to 1.4.0 with it (CLAUDE.md, «`app.json`'s
 * `version` is the OTA compatibility key»).
 */
import { Platform } from 'react-native';
import { fitWithin, MAX_SCAN_EDGE } from './imageFit.ts';
import {
  encodePickedPhoto,
  encodePickedPhotos,
  type PhotoDeps,
  type PickedPhoto,
} from './photoEncode.ts';

export { fitWithin, MAX_SCAN_EDGE };
export type { PickedPhoto };

/** JPEG quality of a shrunk photo, the same on web and on a phone. */
const SHRUNK_JPEG_QUALITY = 0.72;

/**
 * Pickers ask for base64 only on web. On a phone they ask for a `uri` and let
 * `pickedPhotoToDataUrl` read it, shrunk — asking the picker for base64 would
 * put every full-resolution photo in memory before anything could shrink it.
 */
export const PICK_BASE64 = Platform.OS === 'web';

/**
 * The picker's own `quality`: whatever the caller wanted on web, and 1 on a
 * phone, so the photo is not JPEG-compressed twice (once by the picker, once by
 * the resize) — generation loss is what smears handwriting.
 */
export function photoPickQuality(webQuality: number): number {
  return Platform.OS === 'web' ? webQuality : 1;
}

/**
 * Return the same photo, smaller (web, from a data URL). Falls back to the
 * original on any failure — a scan refused for size is a better outcome than
 * one that never happens because the resize threw.
 */
export async function downscaleImage(
  dataUrl: string,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return dataUrl;

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('could not decode the photo'));
      el.src = dataUrl;
    });

    const size = fitWithin(image.naturalWidth, image.naturalHeight, maxEdge);
    if (size.width === 0) return dataUrl;
    // Already small enough — re-encoding would only lose detail.
    if (size.width === image.naturalWidth && size.height === image.naturalHeight) {
      return dataUrl;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, size.width, size.height);

    // JPEG, not PNG: this is a photograph, and PNG would be several times
    // larger for no gain on a page of handwriting.
    return canvas.toDataURL('image/jpeg', SHRUNK_JPEG_QUALITY);
  } catch {
    return dataUrl;
  }
}

const photoDeps: PhotoDeps = {
  platform: Platform.OS === 'web' ? 'web' : 'native',
  webDownscale: downscaleImage,

  async nativeResize(uri, arg) {
    // Lazy: the web bundle and the node tests must never load a native module.
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
    const ref = await ImageManipulator.manipulate(uri).resize(arg).renderAsync();
    try {
      const out = await ref.saveAsync({
        format: SaveFormat.JPEG,
        compress: SHRUNK_JPEG_QUALITY,
        base64: true,
      });
      if (!out.base64) throw new Error('the resize produced no data');
      return out.base64;
    } finally {
      // A native image reference: hold nothing between photos.
      ref.release();
    }
  },

  async readAsBase64(uri) {
    const { readAsStringAsync } = await import('expo-file-system/legacy');
    return readAsStringAsync(uri, { encoding: 'base64' });
  },
};

/**
 * One picked photo as a data URL, shrunk to `maxEdge` on its long edge.
 * `null` when it cannot be read — callers already treat that as «cancelled».
 */
export function pickedPhotoToDataUrl(
  asset: PickedPhoto,
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string | null> {
  return encodePickedPhoto(asset, photoDeps, maxEdge);
}

/** Several picked photos, one at a time and in order; unreadable ones are left out. */
export function pickedPhotosToDataUrls(
  assets: PickedPhoto[],
  maxEdge: number = MAX_SCAN_EDGE,
): Promise<string[]> {
  return encodePickedPhotos(assets, photoDeps, maxEdge);
}
```

- [ ] **Step 2: Typecheck**

Run (repo root): `pnpm run typecheck`
Expected: all projects `Done`. If the compiler says `release` does not exist on `ImageRef`, or `manipulate` is not on `ImageManipulator`, **stop and report the exact error** — do not cast around it; the API shape was read from the package's published types and a mismatch means the plan is wrong.

- [ ] **Step 3: Run the mobile tests**

Run: `cd artifacts/mobile && pnpm test`
Expected: 0 failures (the existing suite plus Tasks 2 and 3).

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/services/imageDownscale.ts
git commit -m "mobile: shrink picked photos on a phone with expo-image-manipulator, one at a time"
```

---

### Task 5: Move the five helpers onto it, and guard them

**Files:**
- Modify: `artifacts/mobile/services/documents/pick.ts`, `artifacts/mobile/services/messaging.ts`, `artifacts/mobile/services/avatarPick.ts`, `artifacts/mobile/services/lessonMediaPick.ts`
- Create: `artifacts/mobile/services/__tests__/photoPickers.test.ts`

**Interfaces:**
- Consumes (from Task 4): `PICK_BASE64`, `photoPickQuality`, `pickedPhotoToDataUrl`, `pickedPhotosToDataUrls`.
- Produces: the five helpers' public signatures are **unchanged** — `pickMarkSheetPhoto(): Promise<string | null>`, `pickMarkSheetPhotos(limit: number): Promise<string[]>`, `pickChatImage(): Promise<string | null>`, `pickAvatarPhoto(): Promise<string | null>`, `pickLessonPhotos(): Promise<string[]>`.

- [ ] **Step 1: Write the failing guard test**

Create `services/__tests__/photoPickers.test.ts`:

```ts
/**
 * The five photo pickers must not put a full-resolution photo in memory.
 *
 * They import `expo-image-picker`, which `node --test` cannot load, so this
 * reads the source (the pattern `scanRoutes.test.ts` uses where a harness is
 * impossible). What it proves is textual: none asks the picker for base64
 * unconditionally, none shrinks by calling the web-only `downscaleImage`
 * directly, and every pick that wants base64 also asks for the native-safe
 * quality. How a photo is actually handled is in `photoEncode.test.ts`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), 'utf8');

const FILES: Record<string, string> = {
  'documents/pick.ts (pickMarkSheetPhoto, pickMarkSheetPhotos)': read('../documents/pick.ts'),
  'messaging.ts (pickChatImage)': read('../messaging.ts'),
  'avatarPick.ts (pickAvatarPhoto)': read('../avatarPick.ts'),
  'lessonMediaPick.ts (pickLessonPhotos)': read('../lessonMediaPick.ts'),
};

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

for (const [name, source] of Object.entries(FILES)) {
  describe(name, () => {
    it('never asks the picker for base64 unconditionally', () => {
      assert.doesNotMatch(source, /base64:\s*true/);
    });

    it('asks for base64 only through PICK_BASE64', () => {
      assert.match(source, /base64:\s*PICK_BASE64/);
      assert.equal(count(source, /base64:/g), count(source, /base64:\s*PICK_BASE64/g));
    });

    it('does not call the web-only downscaleImage itself', () => {
      assert.doesNotMatch(source, /\bdownscaleImage\(/);
    });

    it('shrinks through pickedPhotoToDataUrl / pickedPhotosToDataUrls', () => {
      assert.match(source, /pickedPhotos?ToDataUrls?\(/);
    });

    it('gives every base64 pick the native-safe quality', () => {
      assert.ok(
        count(source, /photoPickQuality\(/g) >= count(source, /base64:\s*PICK_BASE64/g),
        'each pick that sets base64 must also set quality through photoPickQuality()',
      );
    });
  });
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/photoPickers.test.ts`
Expected: FAIL — every file still has `base64: true` and calls `downscaleImage(`.

- [ ] **Step 3: `documents/pick.ts`**

Replace the import line `import { downscaleImage } from '../imageDownscale';` with:

```ts
import {
  PICK_BASE64,
  photoPickQuality,
  pickedPhotoToDataUrl,
  pickedPhotosToDataUrls,
} from '../imageDownscale';
```

Replace `pickMarkSheetPhoto` (its doc comment through its closing brace) with:

```ts
/**
 * One photo of a marked paper, as a data URL.
 *
 * There is no object storage in this app, so a data URL is the whole transport.
 * On web the picker is asked for base64 (a blob URL is not readable later); on
 * a phone it is asked for the file only, and the photo is shrunk to 1600px
 * before it ever becomes a string — a default phone photo is megabytes, and
 * the first real scan in production was refused for size. `quality` alone does
 * not help: it re-compresses twelve megapixels rather than sending fewer.
 *
 * Quality is deliberately lower than the teaching-image picker on web: this is
 * handwriting on paper, not a diagram to display.
 */
export async function pickMarkSheetPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: photoPickQuality(0.6),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return null;

  return pickedPhotoToDataUrl(result.assets[0]!);
}
```

Replace `pickMarkSheetPhotos` (doc comment through closing brace) with:

```ts
/**
 * Several photos of marked papers (or of the pages of one exam), each shrunk the
 * same way `pickMarkSheetPhoto` does, one at a time. Empty on cancel or no
 * permission.
 *
 * `limit` is a ceiling on the picker, and applied again to the result because
 * `selectionLimit` is advisory on some platforms.
 */
export async function pickMarkSheetPhotos(limit: number): Promise<string[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: photoPickQuality(0.6),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return [];

  return pickedPhotosToDataUrls(result.assets.slice(0, limit));
}
```

- [ ] **Step 4: `messaging.ts`**

Replace `import { downscaleImage } from './imageDownscale.ts';` with:

```ts
import { PICK_BASE64, photoPickQuality, pickedPhotoToDataUrl } from './imageDownscale.ts';
```

Replace the body of `pickChatImage` (keep its doc comment, but change «downscaled the same way a lesson-media photo is» to stay true — it now is) with:

```ts
export async function pickChatImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: photoPickQuality(0.85),
    base64: PICK_BASE64,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  return pickedPhotoToDataUrl(asset);
}
```

- [ ] **Step 5: `avatarPick.ts`**

Replace `import { downscaleImage } from './imageDownscale';` with:

```ts
import { PICK_BASE64, photoPickQuality, pickedPhotoToDataUrl } from './imageDownscale';
```

Replace `pickAvatarPhoto` with:

```ts
/** One photo from the library, downscaled. Null on cancel/no permission. */
export async function pickAvatarPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: photoPickQuality(0.85),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return null;

  return pickedPhotoToDataUrl(result.assets[0]!, MAX_AVATAR_EDGE);
}
```

- [ ] **Step 6: `lessonMediaPick.ts`**

Replace `import { downscaleImage } from './imageDownscale';` with:

```ts
import { PICK_BASE64, photoPickQuality, pickedPhotosToDataUrls } from './imageDownscale';
```

Replace `pickLessonPhotos` (doc comment through closing brace) with:

```ts
/** One or more photos from the library, downscaled the same way `pickMarkSheetPhoto` does, one at a time. Empty on cancel/no permission. */
export async function pickLessonPhotos(): Promise<string[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: photoPickQuality(0.85),
    base64: PICK_BASE64,
  });
  if (result.canceled || !result.assets?.length) return [];

  return pickedPhotosToDataUrls(result.assets);
}
```
Leave `uriToDataUrl`, `pickLessonFiles` and every other import in that file as they are.

- [ ] **Step 7: Run the guard, then everything**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/photoPickers.test.ts`
Expected: PASS (4 files × 5 tests = 20).

Run (repo root): `pnpm run typecheck` — expected all `Done`. Run `cd artifacts/mobile && pnpm test` — expected 0 failures (`designScale` and `i18nTerminology` included).

Also run: `grep -rn "downscaleImage" artifacts/mobile --include=*.ts --include=*.tsx | grep -v node_modules | grep -v __tests__`
Expected: only `services/imageDownscale.ts` itself (definition and the `webDownscale:` entry).

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/services/documents/pick.ts artifacts/mobile/services/messaging.ts artifacts/mobile/services/avatarPick.ts artifacts/mobile/services/lessonMediaPick.ts artifacts/mobile/services/__tests__/photoPickers.test.ts
git commit -m "mobile: the five photo pickers read a shrunk photo, never the full-size base64, on a phone"
```

---

### Task 6: STATUS.md, the spec's record, and final verification

**Files:**
- Modify: `STATUS.md` (the bullet near line 1203 and a new bullet after the 1.3.0 entry near line 87)
- Modify: `docs/superpowers/specs/2026-10-15-native-photo-downscaling-design.md` (Status line only)

- [ ] **Step 1: Replace the stale known limit**

In `STATUS.md`, find the bullet beginning `- Photos are only downscaled on web. On a phone each photo is sent at full size` (in the class-scan section's «Known limits») and replace the whole bullet (down to «…the first thing a real Android run should try.») with:

```
- ~~Photos are only downscaled on web.~~ **Changed 2026-10-15:** on a phone the
  five photo pickers now ask for a file only and shrink one photo at a time to
  1600px (512px for avatars) / JPEG 0.72 with `expo-image-manipulator` (spec
  `docs/superpowers/specs/2026-10-15-native-photo-downscaling-design.md`). **Not
  verified on a device** — nothing in this repo has run it on a phone. Still true:
  the combined-size refusal reuses the single-photo code and wording
  (`image_too_large` → «الصورة كبيرة جدًا»). The device checks that remain are
  listed under «On a device» in the spec's «Testing» section, and the first is
  EXIF-rotated camera photos (the cap may land on the other axis, up to ~2133px,
  never distorted). If the resize fails, the dimensions are unknown, or the photo
  is already within the limit, the photo is sent as it is (not re-encoded) — a
  failed resize logs `[photoEncode] native resize failed` and looks exactly like
  the old full-size behaviour, so check the log, not the upload size, when asking
  whether it ran.
```

- [ ] **Step 2: Add the version entry**

In `STATUS.md`, immediately after the bullet that begins `- **Android keyboard fix needs a new binary: \`version\` 1.2.0 → 1.3.0**` and ends `…needs no screen change.`, insert:

```
- **Native photo shrinking needs a new binary: `version` 1.3.0 → 1.4.0**
  (2026-10-15). `expo-image-manipulator` is a native module. Because
  `runtimeVersion.policy` is `appVersion`, **every installed 1.3.0 app stops
  receiving OTA updates from the merge until it is replaced by a 1.4.0 build**
  (a 1.4.0 update can never reach a binary without the module, which is the
  point). A 1.4.0 Android build is therefore needed before any of this exists on
  a phone: `mobile-build.yml` (`workflow_dispatch`, profile `preview`).
  **Not verified:** that any 1.3.0 binary was ever installed (so how many apps
  this strands is unknown), the resize on a device, and the shrunk size and
  speed for a 40-photo class scan.
```

- [ ] **Step 3: Mark the spec**

In the spec, change the line `Date: 2026-10-15 · Status: decisions taken 2026-10-15 (see the last section); ready for the implementation plan` to `Date: 2026-10-15 · Status: implemented in code 2026-10-15; not verified on a device (see «On a device»)`.

- [ ] **Step 4: Final verification — fresh, from the repo root**

Run: `pnpm run typecheck` — expected all `Done`.
Run: `cd artifacts/mobile && pnpm test` — expected `# fail 0`, and the new files `photoEncode.test.ts`, `photoPickers.test.ts` and the extended `imageDownscale.test.ts` all appear in the run.
Run: `cd artifacts/api-server && pnpm build && pnpm test` — expected `# fail 0` (nothing in the API changed; this proves the lockfile change broke nothing).
Run: `git diff origin/main --stat` — expected: the files in the File Structure table plus the plan and spec, and nothing else (no `android/`, no `eas.json`, no server files).

- [ ] **Step 5: Commit**

```bash
git add STATUS.md docs/superpowers/specs/2026-10-15-native-photo-downscaling-design.md
git commit -m "docs: STATUS — native photo shrinking shipped in code, version 1.4.0, not verified on a device"
```
