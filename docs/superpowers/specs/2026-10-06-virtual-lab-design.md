# Virtual lab link + predict–observe–explain sheet — design

Date: 2026-10-06 · Status: approved in conversation, awaiting spec review

## Why

Public schools often lack lab equipment, and Grade 10 lab lessons
(«تجربة استهلالية») have no content in Iqraa today: no outcomes, no
structured lab data (the book's 71 labs are parked, STATUS.md). Guided
virtual labs match physical labs for conceptual understanding; unguided
"click and watch" does not. So the feature pairs **a link to a free
simulation** with **a predict–observe–explain (POE) sheet** that does the
teaching.

## Decisions taken

| Question | Decision |
| --- | --- |
| Scope | The 7 Grade 10 lab lessons: 5 chemistry, 2 physics |
| Sheet source | Hand-written, one per lab, fixed (same with live AI on or off) |
| Licence | Link only to PhET, like the GeoGebra precedent: no embed, no screenshots, no copying; credit beside the link |
| Architecture | Approach A: the sheet is rendered as a `WorksheetOutput` |
| Surfaces | Lesson-page card, QR on the printed sheet, save to موادي, chat chip |
| Release | A sheet is hidden from teachers until a subject teacher's review is recorded |

## Licence position (checked 2026-10-06)

PhET relicensed its library to CC BY-NC on 2026-03-29. Classroom use by
teachers and students is free; use giving a for-profit product "commercial
advantage" needs a PhET licence. Iqraa therefore **only links** to
`phet.colorado.edu`. The student or teacher opens the simulation themselves,
for free classroom use. Iqraa embeds nothing, copies nothing, shows no
screenshot, and prints PhET's attribution beside every link. The worksheet
text is Iqraa's own. This is the same reasoning STATUS.md records for
GeoGebra («The GeoGebra embed is gone»): a link is an ordinary visit to a
free site.

## Labs and candidate simulations

PhET's site is blocked from the build environment, so **each URL must be
confirmed in a browser (HTML5, Arabic locale) before its entry is added**.
No entry is written from memory. A lab whose simulation cannot be confirmed
ships with no entry.

| Lesson id | Lab | Candidate PhET simulation | Confidence |
| --- | --- | --- | --- |
| `kbl-chem-s1-nccd-u1_lab` | الطيف الذري | Models of the Hydrogen Atom (HTML5) | Verify. "Neon Lights" may be Java-only |
| `kbl-chem-s1-nccd-u2_lab` | نمذجة التوزيع الإلكتروني | Build an Atom | Arabic reported |
| `kbl-chem-s1-nccd-u3_lab` | الروابط في المركبات التساهمية | Molecule Shapes | Arabic reported |
| `kbl-chem-s2-nccd-u4_lab` | المعادلة الكيميائية | Balancing Chemical Equations | Arabic reported |
| `kbl-chem-s2-nccd-u5_lab` | الطاقة المرافقة للتفاعل | Reactions & Rates | Verify HTML5 |
| `kbl-phys-s1-nccd-u1_lab` | ناتج جمع قوتين عمليًا | Vector Addition | Arabic reported |
| `kbl-phys-s1-nccd-u2_lab` | وصف الحركة باستخدام المدرج الهوائي | The Moving Man | Verify Arabic |

All seven lesson ids were resolved with `getLessonById` on 2026-10-06, and
each returns its «تجربة استهلالية» lesson.

## Design

### 1. Data

**Catalog entries** (`lib/curriculum/src/data/external_resources.json`), one
per confirmed simulation:
- `kind: 'simulation'`, `provider: 'phet'`, and a new licence id
  `CC-BY-NC-4.0`.
- That licence maps to a new use policy, **`link-only`**: may be pointed at,
  never framed, never copied, never sent to a model.
- Each entry has PhET's attribution, the Arabic run URL where one exists
  (else English), and `licenseCheckedAt` = the day it was confirmed.
- The `simulation` kind's comment changes from "shown in an iframe" to
  "opened as a link".

**Sheets** (`lib/curriculum/src/virtualLabs.ts`, new): one typed
`VirtualLabSheet` per lab:

```ts
interface VirtualLabSheet {
  lessonId: string;          // KB id of the lab lesson
  resourceId: string;        // catalog entry for the simulation
  aimAr: string;
  predict: string[];         // 1–2 prompts
  procedure: string[];       // numbered steps in the simulation
  observe: string[];         // observation prompts / table rows
  explain: string[];         // 2–3 questions tying it to the lesson
  teacherKey: { predict: string[]; observe: string[]; explain: string[] };
  reviewedBy?: string;       // subject teacher who checked it
  reviewedAt?: string;       // ISO date; absent = not released
}
```

`releasedVirtualLab(lessonId, { dev })` returns a sheet only when
`reviewedAt` is set, or when `dev` is true (dev builds, for review).

### 2. The sheet as a worksheet

`virtualLabWorksheet(sheet, resource, lang)`
(`artifacts/mobile/services/virtualLab.ts`, pure) returns a
`WorksheetOutput`:
- Title «مختبر افتراضي: ⟨lesson title⟩». The aim goes in `instructions`.
- Sections «أتوقّع», «ألاحظ», «أفسّر» as `short_answer` questions.
- `answerKey` from `teacherKey`, numbered to match.
- One new optional field on `WorksheetOutput`:
  `lab?: { url; simName; attribution; steps: string[] }`. Every other
  worksheet leaves it absent.

### 3. Exports

- **PDF** (`buildWorksheetHTML`): when `lab` is present, a boxed «المحاكاة»
  block after the instructions holds the simulation name, the URL as plain
  text (works on a photocopy), a QR code of the URL, the attribution, and
  the numbered steps. The QR comes from `qrcode-generator` (MIT, pure JS,
  zero dependencies) as inline SVG. No native module, so no `app.json`
  version bump.
- **Student/teacher copy**: existing `includeAnswers`. The key prints on its
  own page on the teacher copy only.
- **Word**: the same content through the worksheet text, with the link and
  steps. No QR in Word.
- **Share/copy**: the link and steps as text.
- **Student/teacher choice extended**: in موادي and the chat, the
  «نسخة الطالب / نسخة المعلم» choice (PR #883, quiz only) is extended to all
  worksheets. A lab sheet's key must not reach students by default.

### 4. Surfaces

- **`VirtualLabCard`** on `app/curriculum/lesson-detail.tsx`, under the
  resource shelf, rendered only for a lab lesson with a released sheet.
  - Everyone sees the simulation name, «افتح المحاكاة» (`openExternal`) and
    the credit.
  - Teachers also see «ورقة العمل» (export menu with the copy choice: PDF,
    Word, share) and «احفظ في موادي».
  - Students never see the key or the export actions.
- **Save to موادي**: `saveItem` as type `worksheet`, with
  `formState: { lessonId, materialKind: 'virtual-lab' }`.
  - Class filing, reopening and export work unchanged.
  - The موادي viewer shows the «المحاكاة» block (link + steps) on screen.
- **Chat chip**: when the open lesson is a lab lesson with a released sheet,
  `buildLessonSuggestions` puts «🔬 المختبر الافتراضي» first. Tapping it adds
  the sheet as a worksheet message, with no generation. Export and save then
  work as for any chat worksheet. Typed requests are not routed in this
  version.
- **Analytics**: `virtual_lab_opened { lessonId, surface }` when the
  simulation link is opened. Exports already count as `material_exported`.

### 5. Testing (TDD)

- Catalog guard:
  - every `simulation` entry is `link-only`;
  - none has an `ingest` block;
  - every `licenseCheckedAt` is within 180 days.
- Sheet integrity:
  - every sheet's `lessonId` is a real lesson of type `lab`;
  - its `resourceId` is a real `simulation` entry;
  - predict, observe and explain are non-empty;
  - key lengths match the questions.
- Release gate: an unreviewed sheet is hidden unless `dev`.
- Builder: section order, numbering, `lab` block populated.
- Print: the HTML carries the URL text, an `<svg` QR and the attribution;
  the student copy has no key; non-lab worksheets are byte-identical to
  before.
- Chip: appears only on lab lessons with a released sheet.
- Running app:
  - lesson card;
  - PDF export, decoding the QR to confirm it carries the right URL;
  - save to موادي and reopen;
  - chat chip → sheet → export.

## Out of scope

Embedding any simulation; NOBOOK or other providers; non-lab lessons; a QR
in Word; AI-generated lab sheets; typed chat requests for a lab.

## Dependencies on people

1. **Content review.** The 7 sheets are drafted in Arabic by the
   implementer and stay hidden until a chemistry or physics teacher reviews
   each one (`reviewedBy`/`reviewedAt` recorded).
2. **URL confirmation.** Someone with browser access confirms each
   simulation URL (HTML5, Arabic). Alternatively, allow `phet.colorado.edu`
   in the cloud environment's network settings.
