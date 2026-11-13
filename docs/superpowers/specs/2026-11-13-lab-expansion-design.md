# Science Lab expansion — more grades, the media we already have, and six physics tools

Status: written 2026-11-13. PR 1 (grade filter, media) built; PRs 2–5 not started.

Builds on `2026-10-06-science-lab-design.md` (the Lab itself),
`2026-10-06-virtual-lab-design.md` (the predict–observe–explain sheets) and
`2026-10-07-lab-class-workflow-design.md` (lab items as deck slides). Read those
for the constraints they record; this spec does not repeat them.

## Problem

The library's «المختبر» corner is the app's only place for science teaching
tools, and it serves one grade. Measured 2026-11-13:

- `lab_items.json` holds 19 items, **all Grade 10**: chemistry 7, physics 8,
  biology 4 (images only). `lab.test.ts` pins every item to Grade 10, because
  its lesson index only reads the six Grade 10 chemistry/physics/biology files.
- `external_resources.json` already holds **24 licensed science images and
  videos the Lab does not list**: 8 Grade 10 earth-science (rocks, ocean
  currents, NASA videos) and 16 Grade 5 «العلوم» (food web, Azraq wetland, body
  systems with Arabic labels, Tafila wind farm…). They appear on lesson shelves
  but not in the corner.
- The 6 written virtual-lab sheets (`virtualLabs.ts`, 4 chemistry, 2 physics)
  have no `reviewedAt`, so `releasedVirtualLab` hides every one of them in
  production, and no screen outside a dev build lets a science teacher read one.
- The Lab screen filters by subject and kind only. A Grade 9 teacher who opens
  it sees Grade 10 material and nothing to say so.
- Grade 9 physics (measurement, Newton, work and simple machines, fluids,
  refraction and lenses) has no lab item at all, and of Grade 10 physics only
  vectors and Newton's laws do.

## Decisions

| Question | Decision |
| --- | --- |
| New corner for physics? | No. Physics, chemistry, biology, earth science and «العلوم» stay one corner. Eight physics items do not fill a corner, and a corner is a hue, not a subject. |
| Default grade | The viewer's own grade (`user.gradeIds`, the library's `narrowToSelection` rule) when that grade has lab items; otherwise all grades. |
| Physics tools, first round | Projectile motion (G10), fluid pressure (G9), buoyancy (G10), refraction with critical angle (G9), thin-lens ray diagram (G9), lever (G9). Six interactive ids; four topics. |
| Virtual-lab sheets | In scope: an admin-only review screen and a written checklist. Recording a review stays a code change, as `virtualLabs.ts` requires. |
| Media | Every science image or video in `external_resources.json` gets a lab item, and a test keeps it that way. Simulations are excluded (they reach teachers only through a released sheet). |
| Schema | None. No database table, no API change. Everything is curriculum data and mobile code. |

## Approaches considered

1. **Extend the manifest and the existing screen (chosen).** Hand-add the 24
   media rows to `lab_items.json`, add a coverage test so a new science image
   cannot be forgotten, add a grade filter. Keeps every lab item's id stable,
   which matters because ids are in share links (`labShareUrl`) and lesson decks
   (`labSlides.ts`).
2. **Derive external rows from `external_resources.json` at load time.** No
   duplicated titles, but the 12 existing external items would change identity
   and break links teachers have already shared, and curation (which image is
   worth a projector) would be lost.
3. **One screen per grade, or a sub-corner per subject.** More routes, the same
   data, and thin pages. Rejected for the reason in *Decisions*.

## Design

### 1. Grade filter on the Lab screen

`app/curriculum/lab/index.tsx` gains a row of grade chips above the subject
chips: «كل الصفوف» plus one chip per grade that has at least one lab item,
derived from `LAB_ITEMS` like `SUBJECT_IDS` is today, in `MVP_GRADE_IDS` order.
After this spec that is Grades 10, 9 and 5.

- Initial grade: the first of `narrowToSelection(getVisibleGrades(), user?.gradeIds)`
  that has lab items; `null` (all) if none does. Not persisted.
- Subject chips show only subjects that have items **in the selected grade**.
  If a grade change leaves the picked subject with nothing, the subject resets
  to «الكل».
- With «كل الصفوف» selected, each row's meta line adds the grade name
  («الصف التاسع · قانون · انكسار الضوء»); with one grade selected it does not.
- `filterLabItems` already takes `gradeId`; no library change is needed for the
  filter itself.

New i18n keys: `labAllGrades` (ar «كل الصفوف», en "All grades").

### 2. The media already licensed

At least 24 new `external` rows in `lab_items.json` (one per resource, more
where the rule below files one twice), titles copied from the resource, as
`lab.test.ts` already requires:

- Grade 10 earth science: `commons-basalt-columbia-river`,
  `commons-conglomerate-sharon`, `commons-gneiss-ellsworth`,
  `noaa-ocean-surface-currents`, `noaa-gulf-stream-sst`,
  `yt-nasa-rock-cycle`, `yt-nasa-ocean-in-motion`,
  `yt-nasa-large-scale-ocean-currents`.
- Grade 5 science: the 16 `commons-g5-*` images.

A resource filed on several lessons gets one row, on its first lesson, unless a
second lesson is a different unit (then one row each). The rows file
`gradeId` from the resource's `gradeIds`.

**Coverage test** (new, in `lab.test.ts`): every resource in
`EXTERNAL_RESOURCES` whose `subjectId` is one of `chemistry`, `physics`,
`biology`, `earth-science`, `science` and whose `kind` is `image` or `video` is
pointed at by at least one lab item. A `simulation` must **not** be (it would
bypass `releasedVirtualLab`, the same hole `lessonShelf.test.ts` pins).

**Test index rewrite.** `lessonIndex()` in `lab.test.ts` becomes a table of
`{ file, gradeId, subject, semester }` covering G10 chem/phys/bio/earth, G9
phys, G5 science, built through `lessonKbId` exactly as now. The test
"files every item under grade 10" becomes "files every item under its lesson's
grade". `SLUG_BY_SUBJECT` gains `earth-science` and `science`. A grade added
later is one row in that table.

Biology gets no new media here; it still has four images. Recorded as a gap,
not solved.

### 3. Law cards for Grade 9 and Grade 10 physics

New `law` items. The existing rules hold: `titleAr` is one of the lesson's own
vocabulary terms (copied verbatim, diacritics included), every Arabic word on
the card is in `termsAr`, formulas are Latin, and `labSlides.test.ts` checks each
one renders in a deck. Each formula below was read in the book's extracted text
on 2026-11-13 (PDF page of `data/extracted/<file>`); the implementer re-reads the
page before copying, because the text layer garbles Arabic around it.

| Lesson (kbl id) | `titleAr` (a vocabulary term) | Formula | Source |
| --- | --- | --- | --- |
| `kbl-g9-phys-s1-nccd-u3_l1` | الشغلُ | `W = F d` | g9-physics-s1 p.12 |
| `kbl-g9-phys-s1-nccd-u3_l1` | القُدرةُ | `P = W / Δt` | g9-physics-s1 p.69 |
| `kbl-g9-phys-s1-nccd-u3_l2` | الرافعةُ | `MA = load / force = d2 / d1` | g9-physics-s1 p.80 |
| `kbl-g9-phys-s2-nccd-u4_l1` | ضغطُ المائعِ | `P = P0 + ρ h g` | g9-physics-s2 p.14 |
| `kbl-g9-phys-s2-nccd-u5_l1` | معاملُ الانكسارِ | `n = c / v` | g9-physics-s2 p.37 |
| `kbl-g9-phys-s2-nccd-u5_l1` | الانكسارُ | `n1 sin θ1 = n2 sin θ2` | g9-physics-s2 p.41 |
| `kbl-g9-phys-s2-nccd-u5_l2` | زاويةٌ حَرجةٌ | `sin θc = n2 / n1` | g9-physics-s2 p.46 |
| `kbl-phys-s2-nccd-u5_l1` | قوة الطفو | `FB = ρf Vf g` | phys-s2 p.63 |
| `kbl-phys-s1-nccd-u2_l2` | المدى الأفقي | `R = T × v0 cos θ` | phys-s1 p.60 |

Symbols follow the book: `g = 10 m/s²`, `P0` for atmospheric pressure, `ρf`/`Vf`
for the displaced fluid, and the lever's `d1`/`d2` exactly as p.80–81 assign
them (its worked example: 25 kg at 20 cm balanced by 10 kg at 50 cm, MA 2.5).
A unit with a slash is written as a negative power (`kg·m⁻³`), per the deck
rule in `labSlides.ts`.

### 4. Six interactive tools

Each follows `LabVectorAddition`: an SVG scene from `react-native-svg`, −/+
steppers (big targets for a projector, no drag), a results card, and **all
numbers from a pure module in `artifacts/mobile/services/`** with a test in
`services/__tests__/`, so what is drawn is what was tested. Values are
computed in Latin and formatted with `formatLabNumber` (Arabic digits) only at
display. `g = 10 m/s²` everywhere, as the books use. New ids are **appended** to
`LAB_INTERACTIVE_IDS`; each needs its entry in `LabInteractive.tsx`'s `Record`,
which fails to compile without it. Colours come from `useColors()` (the corner
provider), never `palette`.

| id | Lesson | Controls | Shows | Pure module |
| --- | --- | --- | --- | --- |
| `projectile-motion` | G10 `u2_l2` الحركة في بعدين | v0 5–30 m/s (1), θ 0–90° (5), launch height 0–20 m (5) | Path, T, R, max height; θ = 0 from a height is the book's horizontal case (p.62) | `labProjectile.ts` |
| `fluid-pressure` | G9 `u4_l1` المائعُ الساكنُ | depth 0–50 m (5), fluid water / mercury (book's ρ), open to the air on/off | A column with a marked point; ρhg and P0 + ρhg | `labFluids.ts` |
| `buoyancy` | G10 `u5_l1` الموائع السكونية | object volume, object density, fluid (only fluids whose density the G10 book prints, e.g. fresh water 1000 and sea water 1024 kg/m³) | FB, Fg, sinks / floats / suspended; floating depth from Vf = (ρo/ρf)Vo | `labFluids.ts` |
| `refraction` | G9 `u5_l1`, also filed on `u5_l2` | medium 1 and 2 from the book's table (p.38), θ1 0–89° (1) | Incident and refracted ray, θ2; when n1 > n2 the critical angle, and total internal reflection past it | `labRefraction.ts` |
| `thin-lens` | G9 `u5_l3` العدساتُ الرقيقةُ | converging / diverging; object beyond 2F, at 2F, between F and 2F, at F, inside F | The book's standard rays and the image; a description: real/virtual, inverted/upright, larger/smaller/same, where it forms | `labLens.ts` |
| `lever` | G9 `u3_l2` الآلاتُ البسيطةُ | load mass, load arm, effort arm, effort | A first-class lever that tips toward the larger moment; MA; the effort needed to balance | `labLever.ts` |

Notes that decide behaviour:

- **The thin lens shows no numbers.** The Grade 9 book teaches lenses by ray
  diagram only (PDF p.56–62 print no lens equation). `labLens.ts` uses the lens
  equation internally to place the image correctly, but the screen prints only
  the qualitative description the book teaches. At F it says no image forms
  (the rays leave parallel). Printing `1/f = …` would teach Grade 9 something
  their book does not.
- **Refraction stops at total internal reflection, honestly.** For θ1 > θc,
  `labRefraction.ts` returns `{ kind: 'total-internal-reflection', criticalDeg }`,
  never a NaN angle, and the screen draws the reflected ray.
- **Fluid pressure and buoyancy are two ids sharing one module**, because the
  Grade 9 lesson has no buoyant force in its vocabulary and the Grade 10 one
  does. Each grade sees only its own book's quantities.
- **Projectile at θ = 90°** has R = 0 and still draws; at θ = 0 with zero height
  the screen says the body does not leave the ground rather than drawing a dot.
- Fluid densities and refractive indices are copied from the books' own tables
  and worked examples, not from general references, so the numbers on the
  projector match the page.

**Tests pin the books' worked examples**, plus identities that catch a wrong
formula:

- `labFluids`: h = 20 m in water with P0 = 1×10⁵ Pa → 3×10⁵ Pa (G9 p.15);
  mf = 0.3 kg → FB = 3 N (G10 p.65); ρo > ρf sinks, ρo < ρf floats with
  Vf/Vo = ρo/ρf (G10 p.66).
- `labRefraction`: 1.33·sin 45° = n2·sin 38° → n2 ≈ 1.53 (p.42); θc for n = 1.33 →
  48.8°; n1 = 1.8, n2 = 1.3 → θc ≈ 46.2° (p.49); light into a denser medium never
  reflects totally.
- `labProjectile`: complementary angles give equal ranges from the ground; 45°
  gives the largest; T, R and max height against a hand-worked case; the
  horizontal launch from height h has T = √(2h/g).
- `labLever`: 25 kg at the load arm 20 cm balances 10 kg at 50 cm, MA 2.5
  (p.81); equal moments balance, unequal tip toward the larger.
- `labLens`: each of the five converging cases and the diverging case yields the
  description in the book's table (p.62), checked case by case.

Each tool also gets a lab item (`kind: 'interactive'`) on its lesson, so it
appears in the Lab, in present mode and, as a share-link slide, in that lesson's
deck (`labSlides.ts` already handles interactives).

### 5. Reviewing the virtual-lab sheets

The sheets are written and gated; what is missing is a way for a science
teacher to read one as a teacher will see it.

- **`app/admin/virtual-labs.tsx`**, a `system_admin` screen in the existing
  admin area. It lists all `VIRTUAL_LABS` with lesson, simulation and status
  (reviewed by whom and when, or «لم تُراجَع»). Opening one renders it through
  the same `VirtualLabCard` / `virtualLabWorksheet` path teachers get, with
  `dev: true`, plus the simulation link and the teacher key. Nothing on it
  writes anything.
- **`docs/virtual-lab-review.md`**, a one-page checklist for the reviewer: run
  the simulation beside the sheet; every procedure step names a control that
  exists, in the language the student sees; every observation is what the
  simulation actually shows; the teacher key answers each question; the Arabic
  is correct for Grade 10.
- **Recording** a review stays a code change: a PR sets `reviewedBy` (the
  reviewer's name and subject) and `reviewedAt` (the date of the review), as
  `virtualLabs.ts` requires. `validateVirtualLabs` already refuses one without
  the other; it gains one rule: `reviewedAt` is a valid ISO date not in the
  future.
- **Released sheets appear in the Lab.** The Lab screen gets a section
  «تجارب افتراضية» listing the sheets `releasedVirtualLab` returns for the
  selected grade/subject. A row opens the lesson's detail screen, where
  `VirtualLabCard` already lives. With nothing reviewed the section is absent,
  so this ships safely before any review happens.

## Scope and order

Five pull requests, each shippable alone and each with its «ما الجديد» entry
(dated the day it merges) or a stated reason for none:

1. Grade filter + the 24 media rows + the test index rewrite + coverage test.
2. The nine law cards.
3. Review screen, checklist, the `reviewedAt` date rule, the «تجارب افتراضية»
   section.
4. `projectile-motion`, `fluid-pressure`, `buoyancy` (the last two share
   `labFluids.ts`, so they land together).
5. `refraction`, `thin-lens`, `lever`.

Every PR is mobile and `lib/curriculum` only, so a merge deploys the web
bundle and the API (`lib/` changed); no migration, no native module, no
`app.json` version bump.

## Out of scope

- A separate physics, biology or earth-science corner.
- New licensed media for biology or for Grades 1–4 and 6–9 science; this spec
  only lists what is already in `external_resources.json`.
- Grade 9 chemistry, biology and earth science, and Grades 6–8 «العلوم» lab
  items: their books are in the catalog, but nothing licensed is filed on them
  yet. The grade filter and the test table make each one a data change later.
- Inclined plane, pulley and wheel-and-axle tools (the lesson covers them; the
  lever comes first).
- Measurement and significant figures (G9 `u1`), motion graphs and circular
  motion (G10): good candidates for a second round.
- Recording a review from inside the app, or any database state for lab items.
- Waves (G10 `u6`): needs its own design for animation on a projector.

## Risks

- **A formula copied wrong is taught to a class.** Mitigated by the page
  citations above, the worked-example tests, and the existing rule that a law
  card's Arabic is only the lesson's own vocabulary. The text layer garbles
  Arabic; the formulas were read from its Latin runs, so the implementer checks
  each against the rendered page image, not the text alone.
- **Lesson ids for Grade 9 and Grade 5 must resolve in the app.** `getLessonById`
  is what names a row's lesson; PR 1 checks it returns each new item's lesson,
  or the meta line is blank.
- **The lever's arm labels.** The book's `d1`/`d2` assignment is easy to swap;
  the p.81 test fixes it.
- **Admin screen and a minor.** The review screen is `system_admin` only and
  holds no student data.
