# Shrinking photos on a phone (تصغير الصور على الهاتف) — design

Date: 2026-10-15 · Status: implemented in code 2026-10-15; not verified on a device (see «On a device»)

## Why

`services/imageDownscale.ts` shrinks a picked photo to 1600px on its long edge
(JPEG 0.72) before it is sent anywhere. It does this **on web only**: on a
native build `downscaleImage` returns its input untouched. Its own header says
why — "adding a dependency for a platform nobody is running yet" — and that
stopped being true when the Android build path landed (STATUS.md, «A second
Android build path», 2026-09-19).

Five picker helpers call it, and all five say in their comments that the photo
is downscaled. On a phone, none of them is:

| Helper | Used for | Photos per pick |
| --- | --- | --- |
| `pickMarkSheetPhoto` | single-student mark scan | 1 |
| `pickMarkSheetPhotos` | **class scan, paper setup from photos** | up to 40 / 4 |
| `pickChatImage` (`messaging.ts`) | chat attachment | 1 |
| `pickAvatarPhoto` (`avatarPick.ts`, 512px edge) | profile picture | 1 |
| `pickLessonPhotos` (`lessonMediaPick.ts`) | lesson attachments | many |

There is a second problem hiding behind the first. Every one of these helpers
asks the picker for `base64: true`, so the **full-resolution** photo is
base64-encoded and handed to JavaScript *before* `downscaleImage` can see it.
For a multi-select pick the picker returns every selected photo's base64 in one
result. Downscaling after that point could not fix the memory cost even if it
worked on native. (This is read from the picker's API shape; the memory cost
has not been measured.)

The class scan (PR #1052, STATUS.md «Known limits») is the case that hurts:
forty photos, each held as a multi-megabyte string, then each sent as one
request body against an 8,000,000-character per-photo ceiling
(`MAX_SCAN_IMAGE_CHARS`), a 10,000,000-character four-page setup ceiling
(`MAX_SETUP_TOTAL_CHARS`) and a 12 MB body limit. The first real scan in
production was refused for size (`imageDownscale.ts` header). Nobody has run
the class scan on a phone.

## What this changes

Native picks stop asking the picker for base64. They ask for a file `uri`, shrink
**one photo at a time** with `expo-image-manipulator`, and only the shrunk
JPEG is ever turned into base64. Web is unchanged.

```
web:     picker(base64:true) ─▶ downscaleImage(dataUrl)  [canvas, as today]
native:  picker(uri only)    ─▶ resize to ≤1600px, JPEG 0.72 ─▶ base64 ─▶ data URL
                                (one photo at a time; the original is never
                                 held as a string)
```

### Decisions taken

| Question | Decision |
| --- | --- |
| How to resize on native | `expo-image-manipulator` (`~14.0.8`, the SDK 54 pin from `expo/bundledNativeModules.json`). Not pure-JS decoding (a 12 MP JPEG decoded in Hermes is slower and bigger than the problem), and not server-side resizing (the upload and the phone's memory are the problem, not the server's) |
| What the native picker returns | A file `uri` plus the asset's `width`/`height`; `base64` is **not** requested. Picker `quality` is set to 1 on native so the photo is not JPEG-compressed twice (once by the picker, once by the resize) — handwriting suffers from generation loss |
| Concurrency | Strictly sequential. The point is bounding peak memory to one photo; speed is secondary |
| Size and quality | Same constants as web — `MAX_SCAN_EDGE` 1600, JPEG 0.72 — so a photo is the same size whichever platform took it. Tuning waits for a real run (see «Open for the real run») |
| Which call sites | All five, through one shared helper (recommended — see decision 3). Each already says in its own comment that it downscales, and they share the defect. The class scan is the reason for the work, not the only beneficiary |
| If the resize fails | Fall back to reading the **original** file: the original, full size, at the camera's quality. The native picker now runs at quality 1, so this is roughly twice the bytes of the old quality-0.6 re-encode and closer to the 8,000,000-character per-photo ceiling than before. The server's `image_too_large` refusal then names the problem. If even the read fails the helper returns `null`, which every caller already treats as «cancelled» |
| A photo already within the limit | Read as is, no re-encode (the same rule web has: "re-encoding would only lose detail") |

## Design

### Units

| Unit | Does | Depends on |
| --- | --- | --- |
| `services/imageFit.ts` (pure; exists) | Gains `resizeArg(width, height, maxEdge)` → `{ width } \| { height } \| null` | nothing |
| `services/photoEncode.ts` (new; **no** `react-native`/`expo-*` imports) | `encodePickedPhoto(asset, deps, maxEdge)` — the decision logic: which path, no-op for small photos, the fallback, `null` on total failure | `imageFit.ts`, injected `deps` |
| `services/imageDownscale.ts` (exists) | Gains `pickedPhotoToDataUrl(asset, maxEdge?)` — supplies the real `deps` (web canvas, `expo-image-manipulator`, `expo-file-system/legacy`) and calls `encodePickedPhoto`. Keeps `downscaleImage` for the web path | the above |
| the five pick helpers | Request `base64: Platform.OS === 'web'`, `quality: 1` on native, and call `pickedPhotoToDataUrl(asset)` per asset, **sequentially** | `imageDownscale.ts` |

The split exists for the repo's usual reason (CLAUDE.md, «Commands»): `node
--test` cannot load anything that imports `react-native` or `expo-*`, so the
logic worth pinning lives where tests can reach it and the platform calls are
injected.

`deps` is three functions, and nothing else:

```ts
interface PhotoDeps {
  platform: 'web' | 'native';
  webDownscale(dataUrl: string, maxEdge: number): Promise<string>;      // existing canvas path
  nativeResize(uri: string, arg: { width: number } | { height: number }): Promise<string>; // → base64 JPEG
  readAsBase64(uri: string): Promise<string>;
}
```

### The resize

`resizeArg` passes **exactly one** of `width` / `height` to the manipulator —
whichever is the long edge of the asset — so the other is computed by the
manipulator and the aspect ratio cannot be distorted. It returns `null` when
the photo is already within `maxEdge` (no resize, no re-encode).

Why not `fitWithin`'s two numbers: a camera photo can carry an EXIF rotation, in
which case the picker's reported `width`/`height` may be the stored (unrotated)
size while the manipulator works on the rotated one. Passing both would stretch
the photo; passing one cannot. The cost of the picker's dimensions being
transposed is that the cap lands on the other axis — a 4:3 photo then ends up at
most ~2133px long instead of 1600, still a large cut and still correct.
**Whether this happens on the target phones is unverified** — it is the first
thing to look at on a device.

Native call shape (SDK 54, from the package's own type declarations):

```ts
const context = ImageManipulator.manipulate(uri);
try {
  const ref = await context.resize(arg).renderAsync();
  try {
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
    return out.base64;
  } finally {
    ref.release();
  }
} finally {
  context.release();   // the context holds the bitmap; the ref shares it
}
```

`expo-image-manipulator` is imported **lazily inside the native branch**
(`await import(...)`), so the web bundle and the node tests never load it.

### Error handling

| Failure | Result |
| --- | --- |
| `nativeResize` throws (decode error, out of memory, module missing) | read the original via `readAsBase64`; build the data URL from it — the original, full size, at the camera's quality (larger than the old quality-0.6 pick) |
| `readAsBase64` also throws | `null` for that photo; multi-photo helpers skip it (as they already skip an asset with no base64) |
| User cancels, or no permission | unchanged — empty / `null` |
| A photo still too large after shrinking | unchanged — the server answers `image_too_large` and the screen shows its existing message; shrinking only makes this rare, it does not remove the server's limits |

The server's limits are **not** changed. At 1600px / JPEG 0.72 a page of
handwriting should be a few hundred kilobytes (an estimate; unmeasured), so the
combined-size ceiling for a four-page setup is out of reach in practice — which
is also why STATUS's note that the combined-size refusal reuses the single-photo
wording stays a known limit rather than being fixed here.

### UX

A forty-photo pick now does up to forty native resizes before the screen has
anything to show. The class-scan screen shows **no** busy indicator during
them: `reading` is set only after `pickMarkSheetPhotos` returns (see the
screen's own comment in `scan-class.tsx`). For that time the button looks idle,
and a second tap is swallowed by `pickingRef`. This is not a regression — the
old Android picker at quality 0.6 also re-encoded every photo at full size
before returning. Setting a busy state before the picker opens, as
`app/evaluations/new.tsx` does, is the follow-up and stays out of this spec.
How long forty take on a mid-range Android is unmeasured.

## Native surface and rollout — the part that can break installed apps

This adds a native module, so CLAUDE.md's rule applies in full: **`app.json`'s
`version` must change in the same PR that adds the dependency.**
`runtimeVersion.policy` is `appVersion`; without a bump, `mobile-update.yml`
publishes JS that calls `ExpoImageManipulator` to installed binaries that do not
contain it, which crashes on launch and persists across launches (recovery is a
reinstall).

- `version` goes **1.3.0 → 1.4.0** (default; see decision 1 below).
- Consequence, stated plainly: every installed 1.3.0 binary stops receiving OTA
  updates, from the moment this merges, until it is replaced by a 1.4.0 build.
  That is the mechanism working, not a bug — but it is a cost, and it is why the
  timing deserves a choice rather than a default.
- Production web (the Expo web bundle) is unaffected: web keeps the canvas path
  and never loads the native module.
- A new Android build is required to use any of this on a phone:
  `mobile-build.yml` (`workflow_dispatch`, `eas.json` profile `preview` for the
  internally distributed APK) — or the non-EAS path in STATUS. Nothing in this
  work can be exercised on a phone before that build exists.
- `EXPO_PUBLIC_*`: none added.

## Testing

**In `node --test` (`services/__tests__/`):**
- `resizeArg`: portrait, landscape, square, already-small → `null`, a very thin
  image, zero / NaN dimensions → `null`, always exactly one key.
- `encodePickedPhoto` with fake deps, one test per row of the error-handling
  table: web path delegates to `webDownscale`; native small photo → read as is,
  `nativeResize` never called; native large photo → `nativeResize` called with a
  single key and its base64 wrapped as `data:image/jpeg;base64,…`;
  `nativeResize` throws → original read; both throw → `null`; MIME for the
  fallback taken from the asset, defaulting to `image/jpeg`.
- Sequential, not parallel: a fake `nativeResize` that records overlap proves
  the multi-photo helper never has two in flight (the property memory depends
  on).
- A source-text guard (the pattern `scanRoutes.test.ts` uses where a harness is
  impossible): none of the five helpers passes `base64: true` unconditionally —
  it must be conditional on the platform — so the full-resolution string cannot
  quietly come back.
- Existing `imageDownscale.test.ts` (`fitWithin`) keeps passing unchanged.

**On a device (cannot be done in this environment; the acceptance criteria):**
1. A 12 MP portrait photo from the Android camera app → long edge ≤ 1600px (≤
   ~2133px if EXIF dimensions are transposed — and note which), and visibly
   upright, not stretched.
2. The resulting request body for that photo, measured, is well under the 8 MB
   ceiling.
3. A forty-photo class scan completes without the app being killed, and without
   `image_too_large`.
4. The marks on a real marked paper are still legible in the shrunk image (look
   at it, then run the scan).
5. One other call site (chat image or avatar) still looks right.

## Not in this spec

- Raising or restructuring the server limits, or giving the combined-size
  refusal its own wording.
- Web changes (the double JPEG generation on web — picker 0.6 then canvas
  0.72 — is real but harmless to the class scan and is left alone).
- A progress indicator for long picks.
- Auto-marking from students' answers (still its own spec).
- A CI guard tying native dependencies to `app.json`'s `version`. The rule is
  still enforced by people; this change is another reason to want one, but
  inventing it here widens the PR.

## Open for the real run

- Is 1600px enough to read the **student's name** at the top of a paper? Marks
  were the reference when 1600 was chosen; the class scan also depends on the
  name. If names misread on a phone and read fine on a larger original,
  `MAX_SCAN_EDGE` is the single constant to raise (try 2000). Do not change it
  before there is a photo that fails.
- Whether `quality: 1` on the native picker returns the original file or
  re-encodes anyway on Android. Harmless either way, unverified.

## Decisions taken by the owner (2026-10-15)

1. **Version: bump to 1.4.0.** Chosen over riding 1.3.0. Every installed 1.3.0
   app stops receiving OTA updates until it is replaced by a 1.4.0 build.
2. **Timing: not answered.** Treated as «nothing else is waiting on a native
   build». If something is, it should join the same 1.4.0 build; the plan does
   not depend on it.
3. **Scope: all five helpers** — `pickMarkSheetPhoto`, `pickMarkSheetPhotos`,
   `pickChatImage`, `pickAvatarPhoto`, `pickLessonPhotos`.
