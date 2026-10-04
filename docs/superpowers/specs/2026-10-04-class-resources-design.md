# Class resources — attaching Library items (and later links and files) to a class

## Problem

A class's الموارد tab holds one kind of thing: the teacher's own saved
materials (`saved_materials` rows with `class_group_id` set). A teacher who
wants a Library video, a ready-made worksheet or a book's QR link in front of
their class has no way to put it there. The tab's empty state invites them to
attach "a lesson or worksheet from your workspace", the «+» sheet offers the
same, and its only other door («أنشئ مادة جديدة») lands on the tools hub,
where the Library is just another card with no way back to this class.

The ask was wider than the Library: "add materials here from library **and
others**". Confirmed scope: Library items, teacher-pasted links, and files
uploaded from the device. Those are three different amounts of work sharing
one data model, so this spec designs **piece #1 (Library items)** in full and
shapes the model so #2 and #3 slot in. Each piece gets its own plan and PR.

| # | Piece | Needs a schema push? |
|---|---|---|
| 1 | Library items in a class, plus the shared "class resource" row | Yes — creates the table |
| 2 | Teacher-pasted links | No — the columns already exist |
| 3 | Files uploaded from the device | Yes — adds storage columns |

## What exists today (verified in the code, 2026-10-04)

- **Three Library sources** (`services/resourceCatalog.ts`): `uploaded` (staff
  uploads — table `library_resources`, global, a file in the public R2 bucket
  *or* an https link, filed by grade / subject / lesson / category),
  `premade-sheet` (frozen worksheets shipped in `@workspace/curriculum`), and
  `book-qr` (the links printed in the NCCD books; some are plain http and carry
  a per-row `insecure` warning).
- **A class's tab** loads `getItems({ classId })` — saved materials only — and
  opens each in `/workspace/view`.
- **A plan that was never built.** `ResourceAction` includes `'add-to-class'`
  and `addToClassPlan()` says a premade sheet should be copied into the
  teacher's materials and then attached, while uploads and book-QR links
  cannot be attached at all ("shared links, not teacher-owned material").
  Nothing wires it: the Library screen only performs `print` and `open`, so
  premade sheets advertise an action nothing carries out. It is referenced
  only by `resourceCatalog.ts` and its test.
- **The premade-sheet viewer is read-only** (`/workspace/view?premade=<id>`
  hides Edit and the save actions), so a "copy" has no consumer.
- **Teacher uploads already exist for lessons** (`lesson_media`, route
  `POST /media/lesson`): image / audio / PDF, 8 MB as a `data:` URL, stored in
  the **private** bucket, served through time-limited signed URLs, owned per
  user. There is no video type and no multipart path anywhere in the server.
- **Schema changes are manual.** Nothing deploys the schema; a PR touching
  `lib/db/src/schema` must say `schema-push: done|n/a`, and past changes ship
  a hand-written additive `docs/schema-push-<date>-<name>.sql` run in the Neon
  console before merge (see `docs/deploying.md`, *Schema*).

## Decisions (made with the product owner)

1. **Entry point: inside the class.** The class's «+» sheet gains a
   «من المكتبة» row that opens a Library picker filtered to the class. A
   Library-screen «add to class» button is **out of scope** (it could reuse the
   same `POST` later).
2. **Scope: Library items, pasted links and device files**, delivered as the
   three pieces above, in that order.
3. **Storage: a new `class_resources` table** (not a new kind of
   `saved_materials` row). The decisive reason is piece #3: a device file needs
   a storage key, and in `saved_materials` that would sit in app-written JSON,
   obliging the server to sign URLs from keys a client supplied. In
   `class_resources` the server owns the key.
4. **Pointer rows, not copies.** A resource is a reference the class holds, not
   a document the teacher owns. This reverses the dormant `addToClassPlan` copy
   semantics, which the read-only viewer cannot use.
5. **Snapshot, not live reference.** A row renders from what it saved at add
   time (see *Data model*).

## Data model

New table `class_resources` in `lib/db/src/schema/classResources.ts`:

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `class_group_id` | uuid, not null, → `class_groups(id)` **on delete cascade** |
| `teacher_id` | uuid, not null, → `users(id)` on delete cascade. The owner; makes authorisation a single comparison |
| `kind` | text: `library` now; `link` (piece #2) and `file` (piece #3) reserved |
| `library_source` | text, null unless `kind = library`: `uploaded` \| `premade-sheet` \| `book-qr` |
| `library_native_id` | text, null unless `kind = library`. The catalogue's own id — an id, never a title |
| `title` | text, not null (snapshot) |
| `media_kind` | text, not null (snapshot): the Library category, or `image` / `page`, used for the icon and shelf |
| `url` | text, null (snapshot). Absent on a premade sheet, which never leaves the app |
| `thumbnail_url` | text, null (snapshot) |
| `created_at` | timestamptz, default now |

A partial unique index on `(class_group_id, library_source, library_native_id)`
where `kind = 'library'` stops the same item being added to a class twice.
Nothing for files is added now: piece #3 adds its own nullable columns with its
own push.

**Snapshot semantics.** The tab never downloads the Library to render. Premade
sheets and book-QR links ship with the app, so they cannot disappear between
deploys. A staff upload can be deleted, so `GET` left-joins `library_resources`
and marks a row `unavailable` when its source is gone. The accepted cost: a
staff edit (a corrected link, a new cover) does not reach classes that already
added the item.

*Amended 2026-10-04, after the piece-1 implementation review (owner's decision):*
one column is not a snapshot. A staff upload's `url` is composed from
`R2_PUBLIC_BASE_URL`, which may move, so `GET` rebuilds it from the Library row
(`r2_key ? publicUrl(r2_key) : source_url`) for every upload that still exists;
the stored value is only the fallback (the row is gone, the computed link is
null, or the Library lookup fails). `title`, `media_kind`, `thumbnail_url` and
every premade-sheet / book-QR column stay snapshots. The staff-edit cost above
therefore applies to the title and cover only.

## API

All under `/classes/:id/resources`, inside the existing class router, so every
guard is path-scoped (CLAUDE.md: a bare `router.use` in a prefix-less router is
API-wide).

- `GET` → `{ resources: ClassResource[] }`, newest first, each with
  `unavailable: boolean`. A missing table reads as an empty list
  (`isSchemaMissing`), so an early deploy cannot break the class screen.
- `POST` `{ kind: 'library', source, nativeId, … }` → 201 with the row.
  - `source = uploaded`: `nativeId` must be a UUID that exists in
    `library_resources` (else 404); the server copies title, kind, url and
    cover **from its own row** and ignores any client-supplied values.
  - `premade-sheet` / `book-qr`: the server cannot see those catalogues, so it
    validates what the app sends — title ≤ 200 chars, url ≤ 2048 chars, known
    `media_kind`, https only **except** `book-qr`, where plain http is accepted
    (some printed codes use it) and is warned per row exactly as the Library
    does.
  - A repeat returns 409 `already_added`; the app treats it as success, so a
    double tap is harmless.
  - A missing table answers 503 `roster_storage_unavailable` — the code
    `failRoster` already returns and the app already understands. `DELETE`
    answers it too.
- `DELETE /:rid` removes the row only. It never touches the Library item.
- A class that is not the caller's answers **404**, never 403, so a class's
  existence does not leak.

## Client flow

- **Attach sheet** («أرفق مادة»): keeps its saved-materials list and gains an
  always-present **«من المكتبة»** row. That also removes today's dead end — an
  empty class with nothing saved now has somewhere to go.
- **Library picker** (new component, not more lines in the 1,800-line class
  screen): items from `buildResourceCatalog`, narrowed with the existing,
  tested `filterResources({ gradeId, subjectId })` and ordered by the same
  shelf order as the Library screen, each row carrying its kind label (no
  section headers — a deliberate simplification). One tap adds; the sheet stays open so several
  can be added; items already in the class show «مضاف»; «تم» closes. It uses a
  compact row (title, kind icon, add button) rather than the Library screen's
  cover cards, so the Library screen is untouched. `listLibrary` already
  returns `[]` on failure, so when the staff list is unreachable the picker
  still offers premade sheets and book-QR links and needs no error state of its
  own.
- **The tab** is one list of materials and resources, **newest first**
  (materials by `savedAt`, resources by `created_at`), each resource tagged
  «المكتبة»; the tab count covers both. The empty-state text
  mentions the Library.
- **Opening a row**: a material opens in `/workspace/view` as today; a
  resource with a url opens through `openExternal`; a premade sheet opens in the
  read-only viewer (`?premade=<nativeId>`); an `unavailable` row is greyed
  with «لم يعد متاحًا» and a Remove button.
- **Removing**: ✕ deletes the class's row. No confirmation — it is not
  destructive (the Library item remains and can be re-added).
- **Retiring the dormant plan.** Delete `'add-to-class'` from `ResourceAction`,
  `addToClassPlan` and the `AddToClassStep` type, and update their three
  assertions in `resourceCatalog.test.ts`, so two contradictory plans do not
  coexist.
- The class screen loads resources in their own try/catch, like exams: a
  failure keeps the previous list and never blanks the materials tab.
- One `class_resource_added` analytics event (`source`, `media_kind`).
- New Arabic and English strings (picker title, «من المكتبة», «مضاف», «تم»,
  «المكتبة» tag, «لم يعد متاحًا»); the `noMaterialsDesc` empty-state copy
  changes.

## Failure modes and rollout

- **Schema first.** Ship `docs/schema-push-<date>-class-resources.sql`
  (`CREATE TABLE IF NOT EXISTS` + the index), run it in the Neon console
  **before merge**, confirm with
  `pnpm --filter @workspace/db run verify-schema`, and put `schema-push: done`
  at the start of a line in the PR body (matched literally). The daily
  `schema-check` job also catches a miss, and `verify-schema` checks columns,
  not only table names.
- **Tolerant read, loud write.** `GET` degrades to empty; `POST` and `DELETE`
  answer 503 and the app shows a new, accurate message («تعذّر تحديث موارد
  الشعبة»). The existing save-to-class error says "the material is saved",
  which would be false here.
- Account deleted: rows cascade. A class is never hard-deleted in the product:
  `DELETE /classes/:id` archives it, and every per-id route then answers 404
  through `findLiveClass`, so an archived class's shelf is unreachable rather
  than removed.
- A staff upload deleted after being added: flagged `unavailable` (above).

## Testing and verification

- **Pure units**: server-side validation (`api-server/src/lib/classResource.ts`,
  mirroring `libraryResource.ts`); the client merge-and-sort of materials with
  resources; "already added" matching in the picker.
- **Route**: an unauthenticated request to `/classes/:id/resources` must answer
  401, not 404 (the "unowned path" tell `mountOrder.test.ts` guards). Run
  `pnpm build` in `artifacts/api-server` first — that suite boots the built
  bundle.
- **Live check against local Postgres with two teachers**: the other teacher
  gets 404; a repeated add is idempotent; a deleted staff upload comes back
  `unavailable`; the table-missing paths answer as designed. Then drive the
  picker in the browser (Expo web) — add, reopen, remove, open each source.
  Note: every tab and the class screen stay mounted, so text queries match
  hidden copies; filter to visible elements.
- `STATUS.md` gets an entry; the PR states what was and was not verified
  (native devices are not).

## Pieces #2 and #3

- **#2, pasted links.** `kind = link`, using the existing `title` and `url`.
  Adds an «أضف رابطًا» form to the «+» sheet and reuses the Library's https
  link check (`parseLibraryLink`). List, open and remove are unchanged. **No
  schema change.**
- **#3, device files.** Adds nullable `r2_key`, `mime_type`, `size_bytes`
  (server-set only) with its own push. A new
  `POST /classes/:id/resources/file` takes a `data:` URL like lesson media
  (≤ 8 MB; image / audio / PDF) into the **private** bucket via `putObject`
  under a server-generated key. `GET` mints a fresh signed URL per row and
  never stores one, and never signs a key taken from the request.
  - **Limitation to accept:** no video upload under the 8 MB data-URL cap.
  - **To design there:** deleting an *account* cascades the rows but not the
    stored objects, so the account-deletion path must delete a teacher's
    class-resource files first (or a sweep must). Archiving a class leaves the
    files in place and needs nothing.

## Out of scope for piece #1

A Library-screen «add to class» button; editing a title; reordering; copying a
resource to another class (add it again); and what students see — student
accounts are disabled in v1, so who may see a class's resources is a separate
decision to make when they ship.

## Open points

None that block the plan. `media_kind` is exactly the catalogue's existing
`ResourceKind` (the Library categories plus `image` and `page`).
