# Lab expansion PR 5: refraction, thin-lens and lever tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last three physics tools join the Science Lab, all for Grade 9:
- **refraction** with the critical angle, for «انكسارُ الضوءِ» and «تطبيقاتٌ وظواهرُ بصريّةٌ»;
- a **thin-lens ray diagram**, for «العدساتُ الرقيقةُ»;
- a **lever**, for «الآلاتُ البسيطةُ».

Each tool's maths lives in a pure, tested module pinned to the Grade 9 books' worked examples.

**Architecture:** Same pattern as PR 4. A pure module in `artifacts/mobile/services/` with a test, an SVG component in `components/lab/` built from the shared `LabControls` (PR 4), an id appended to `LAB_INTERACTIVE_IDS`, its entry in `LabInteractive`'s `Record`, and lab items in `lab_items.json`. Refraction is one tool filed on two lessons (refraction, and the critical angle), so the "every interactive, once each" test becomes "every interactive at least once".

**Tech Stack:** TypeScript, `react-native-svg`, `node:test`, Expo / React Native (web build for the visual check).

**Spec:** `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` §4 ("Notes that decide behaviour": the thin lens shows no numbers; refraction stops at total internal reflection honestly), *Scope and order* item 5. Builds on PRs 1–4 (plans `2026-11-13-lab-expansion-pr1.md`, `-pr2.md`, `2026-11-24-lab-expansion-pr3.md`, `2026-11-25-lab-expansion-pr4.md` in `docs/superpowers/plans/`).

## Global Constraints

- **Prerequisite:** PRs 1–4 are merged to `main`. Start from the latest `origin/main`, either in a fresh branch or by restarting the session branch from `origin/main` if its PR merged. PR 5 is its own pull request.
- PR 4 supplies `components/lab/LabControls.tsx` (`LabStepper`, `LabResultRow`, `LabQuantity`, `LabChoice`) and `services/labSteps.ts` (`stepValues`, `stepIndex`). Use them; do not re-create a stepper.
- **The book's numbers.** All come from `lib/curriculum/src/data/extracted/<file>`, cited by PDF page:
  - **Refractive indices** (g9-physics-s2, p.38, table 1):
    - air 1.0003
    - water 1.33
    - acetone 1.36
    - glycerin 1.47 (the book spells it «الجلسرين»)
    - glass 1.52
    - quartz 1.55
    - diamond 2.42
  - **Refraction and critical-angle examples** (g9-physics-s2):
    - p.42: 1.33·sin 45° = n2·sin 38° gives n2 = 1.53. At normal incidence, 1 × sin 0° = 1.33·sin θ2 gives θ2 = 0.
    - p.46: water's critical angle is 48.6° (the book rounds 1/1.33 to 0.75).
    - p.49: from 1.8 into 1.3, θc = 46.2°.
  - **Lenses** (g9-physics-s2, p.59–65):
    - Lens names: convex «المحدّبة» and concave «المقعّرة».
    - The five object positions, from the table on p.59: x > 2F, x = 2F, F < x < 2F, x = F, x < F.
    - Image words, from the p.62 definitions and the examples on p.63–65: «مكبّر / مصغّر / مساوٍ للجسم في الحجم», «مقلوب / معتدل», «حقيقي / وهمي».
    - Worked results:
      - beyond 2F: «مصغّرٌ ومقلوبٌ وحقيقيٌّ» (p.63)
      - between F and 2F: «مُكبّرٌ ومقلوبٌ وحقيقيٌّ» (p.63)
      - inside F: «مكبّرٌ ومعتدلٌ ووهميٌّ» (p.64)
      - concave lens: «مصغّرٌ ومعتدلٌ ووهميٌّ» (p.65)
  - **Lever** (g9-physics-s1, p.79–81):
    - The book's notation: `F1 d1 = F2 d2`, where `F1`/`d1` are the load and load arm and `F2`/`d2` the effort and effort arm; and `MA = d2 ÷ d1`.
    - Examples: 25 kg at 20 cm balances 10 kg at 50 cm, MA = 2.5; arms of 3 cm and 15 cm give MA = 5.
- **The thin lens prints no numbers** (spec §4): the Grade 9 book teaches lenses by ray diagram only. `labLens.ts` uses the lens equation internally so the image is drawn in the right place; the screen shows only the book's qualitative description.
- **Refraction never shows a NaN angle.** Beyond the critical angle it reports total internal reflection and draws the reflected ray.
- Maths in Latin; Arabic digits only at display time (`formatLabNumber`).
  - A unit is never printed beside a number: it goes in the row's label.
  - Corner components take theme colours from `useColors()`, never `palette`. Fixed hues (fluids, rays) are hex constants in the component, as `LabVectorAddition` does.
  - Icon sizes must be on the scale, touch targets at least 44 points, and no hand-written `shadowColor`.
- New ids are **appended** to `LAB_INTERACTIVE_IDS`; existing lab item ids never change.
- Mobile tests live in `artifacts/mobile/services/__tests__/`, import no `react-native`/`expo-*`, and use explicit `.ts` relative imports.
- Edit with the Edit tool. Read the `git diff` of `i18n.ts` and `lab_items.json`.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `artifacts/mobile/services/labRefraction.ts` (+ test) | Create | Media table, Snell's law, critical angle |
| `artifacts/mobile/components/lab/LabRefraction.tsx` | Create | The refraction tool |
| `artifacts/mobile/services/labLens.ts` (+ test) | Create | Image for each case, ray diagram geometry |
| `artifacts/mobile/components/lab/LabThinLens.tsx` | Create | The lens tool |
| `artifacts/mobile/services/labLever.ts` (+ test) | Create | Moments, balance, MA |
| `artifacts/mobile/components/lab/LabLever.tsx` | Create | The lever tool |
| `lib/curriculum/src/lab.ts`, `data/lab_items.json`, `__tests__/lab.test.ts` | Modify | Three ids, four items, test wording |
| `artifacts/mobile/components/lab/LabInteractive.tsx` | Modify | Three `Record` entries |
| `artifacts/mobile/services/i18n.ts` | Modify | Labels (ar + en), What's New keys |
| `artifacts/mobile/services/whatsNew.ts`, `docs/status-log.md`, the spec | Modify | Entry, log, status |

---

### Task 1: Refraction maths

**Files:**
- Create: `artifacts/mobile/services/labRefraction.ts`
- Test: `artifacts/mobile/services/__tests__/labRefraction.test.ts`

**Interfaces:**
- Produces:
  - `type MediumId = 'air' | 'water' | 'acetone' | 'glycerin' | 'glass' | 'quartz' | 'diamond'`
  - `MEDIA: readonly { id: MediumId; n: number }[]`, in the book's table order
  - `criticalAngle(n1: number, n2: number): number | null`, in degrees; `null` when `n1 <= n2`
  - `refract(n1: number, n2: number, incidenceDeg: number): { kind: 'refracted'; angleDeg: number } | { kind: 'total-internal-reflection'; criticalDeg: number }`

- [ ] **Step 1: Failing tests**

Create `artifacts/mobile/services/__tests__/labRefraction.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA, criticalAngle, refract } from '../labRefraction.ts';

const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const angle = (r: ReturnType<typeof refract>) => {
  assert.equal(r.kind, 'refracted');
  return r.kind === 'refracted' ? r.angleDeg : NaN;
};

describe('the book\'s table (g9-physics-s2 p.38)', () => {
  it('has the seven media in the book\'s order and values', () => {
    assert.deepEqual(MEDIA, [
      { id: 'air', n: 1.0003 }, { id: 'water', n: 1.33 }, { id: 'acetone', n: 1.36 }, { id: 'glycerin', n: 1.47 },
      { id: 'glass', n: 1.52 }, { id: 'quartz', n: 1.55 }, { id: 'diamond', n: 2.42 },
    ]);
  });
});

describe('refract — the book\'s worked examples', () => {
  it('1.33 · sin 45° = 1.53 · sin θ2 gives θ2 ≈ 38° (p.42)', () => {
    near(angle(refract(1.33, 1.53, 45)), 38, 0.1, 'θ2');
  });
  it('at normal incidence the ray goes straight on (p.42)', () => {
    assert.equal(angle(refract(1, 1.33, 0)), 0);
  });
  it('into a denser medium the ray bends toward the normal and never reflects totally', () => {
    for (let a = 0; a <= 89; a++) {
      const r = refract(1.0003, 2.42, a);
      assert.equal(r.kind, 'refracted', `θ1 = ${a}`);
      if (r.kind === 'refracted') assert.ok(r.angleDeg <= a + 1e-9, `θ1 = ${a}`);
    }
  });
});

describe('criticalAngle and total internal reflection', () => {
  it('water to air: 48.6° (p.46; the book rounds 1/1.33 to 0.75)', () => {
    near(criticalAngle(1.33, 1)!, 48.6, 0.2, 'θc');
  });
  it('from 1.8 into 1.3: 46.2° (p.49)', () => {
    near(criticalAngle(1.8, 1.3)!, 46.2, 0.05, 'θc');
  });
  it('there is no critical angle into a denser or equal medium', () => {
    assert.equal(criticalAngle(1.33, 1.52), null);
    assert.equal(criticalAngle(1.33, 1.33), null);
  });
  it('past the critical angle the ray reflects, and says at what angle', () => {
    const r = refract(1.33, 1.0003, 60);
    assert.equal(r.kind, 'total-internal-reflection');
    if (r.kind === 'total-internal-reflection') near(r.criticalDeg, criticalAngle(1.33, 1.0003)!, 1e-12, 'θc');
  });
  it('just below the critical angle it still refracts, close to 90°', () => {
    const c = criticalAngle(1.33, 1)!;
    assert.ok(angle(refract(1.33, 1, c - 0.5)) > 80);
  });
});
```

- [ ] **Step 2: See them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labRefraction.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/labRefraction.ts`:

```ts
/**
 * Refraction for the lab's interactive (Grade 9, «انكسارُ الضوءِ» and
 * «تطبيقاتٌ وظواهرُ بصريّةٌ»): n1 sin θ1 = n2 sin θ2, and sin θc = n2 / n1.
 * Angles in degrees from the normal. Indices are the book's table
 * (g9-physics-s2 p.38). Past θc the ray reflects; there is never a NaN angle.
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §4.
 */
export type MediumId = 'air' | 'water' | 'acetone' | 'glycerin' | 'glass' | 'quartz' | 'diamond';

export const MEDIA: readonly { id: MediumId; n: number }[] = [
  { id: 'air', n: 1.0003 },
  { id: 'water', n: 1.33 },
  { id: 'acetone', n: 1.36 },
  { id: 'glycerin', n: 1.47 },
  { id: 'glass', n: 1.52 },
  { id: 'quartz', n: 1.55 },
  { id: 'diamond', n: 2.42 },
];

const DEG = 180 / Math.PI;

export function criticalAngle(n1: number, n2: number): number | null {
  return n1 > n2 ? Math.asin(n2 / n1) * DEG : null;
}

export function refract(
  n1: number,
  n2: number,
  incidenceDeg: number,
): { kind: 'refracted'; angleDeg: number } | { kind: 'total-internal-reflection'; criticalDeg: number } {
  const s = (n1 / n2) * Math.sin(incidenceDeg / DEG);
  if (s > 1) return { kind: 'total-internal-reflection', criticalDeg: criticalAngle(n1, n2)! };
  return { kind: 'refracted', angleDeg: Math.asin(s) * DEG };
}
```

- [ ] **Step 4: See them pass**

Run the same command. Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labRefraction.ts artifacts/mobile/services/__tests__/labRefraction.test.ts
git commit -m "feat(lab): refraction maths pinned to the Grade 9 book's examples"
```

---

### Task 2: The refraction tool, on two lessons

**Files:**
- Create: `artifacts/mobile/components/lab/LabRefraction.tsx`
- Modify: `lib/curriculum/src/lab.ts`, `lib/curriculum/src/data/lab_items.json`, `lib/curriculum/src/__tests__/lab.test.ts`, `artifacts/mobile/components/lab/LabInteractive.tsx`, `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: `MEDIA`, `MediumId`, `refract`, `criticalAngle` (Task 1); `LabChoice`, `LabStepper`, `LabResultRow`, `stepValues`, `stepIndex` (PR 4).
- Produces: interactive id `refraction`; items `lab-refraction` (u5_l1) and `lab-refraction-critical` (u5_l2).

- [ ] **Step 1: Id, items, Record, test wording**

Append `'refraction'` to `LAB_INTERACTIVE_IDS` in `lib/curriculum/src/lab.ts`. Keep every earlier id, in order.

In `lib/curriculum/src/__tests__/lab.test.ts`, the test that compares interactive ids (named «ships every interactive, once each» since PR 4) must allow one tool on several lessons. Replace that whole `it(…)` with:

```ts
  it('ships every interactive at least once, and no unknown one', () => {
    const ids = new Set(LAB_ITEMS.flatMap(i => (i.kind === 'interactive' ? [i.interactiveId] : [])));
    assert.deepEqual([...ids].sort(), [...LAB_INTERACTIVE_IDS].sort());
  });
```

Append to `lab_items.json`, adding a comma after the previous last row:

```json
    {
      "id": "lab-refraction",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "refraction",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u5_l1",
      "titleAr": "انكسار الضوء تفاعليًا",
      "titleEn": "Interactive Refraction of Light"
    },
    {
      "id": "lab-refraction-critical",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "refraction",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u5_l2",
      "titleAr": "الزاوية الحرجة والانعكاس الكلي تفاعليًا",
      "titleEn": "Interactive Critical Angle and Total Internal Reflection"
    }
```

Add `refraction: LabRefraction,` to `COMPONENTS` in `LabInteractive.tsx`, with its import.

- [ ] **Step 2: Labels**

Add to the `ar` block, after the PR 4 `labBuoy*` keys:

```ts
    labMediumAir: 'الهواء',
    labMediumWater: 'الماء',
    labMediumAcetone: 'الأسيتون',
    labMediumGlycerin: 'الجلسرين',
    labMediumGlass: 'الزجاج',
    labMediumQuartz: 'الكوارتز',
    labMediumDiamond: 'الماس',
    labRefrFrom: 'الوسط الأول (يسقط منه الضوء)',
    labRefrTo: 'الوسط الثاني',
    labRefrIncidence: 'زاوية السقوط θ1 (°)',
    labRefrAngle: 'زاوية الانكسار θ2 (°)',
    labRefrCritical: 'الزاوية الحرجة θc (°)',
    labRefrTir: 'انعكاس كلي داخلي: زاوية السقوط أكبر من الزاوية الحرجة، فلا ينفذ الضوء إلى الوسط الثاني.',
    labRefrNoCritical: 'لا زاوية حرجة: الضوء ينتقل إلى وسط معامل انكساره أكبر أو مساوٍ.',
```

Add to the `en` block:

```ts
    labMediumAir: 'Air',
    labMediumWater: 'Water',
    labMediumAcetone: 'Acetone',
    labMediumGlycerin: 'Glycerin',
    labMediumGlass: 'Glass',
    labMediumQuartz: 'Quartz',
    labMediumDiamond: 'Diamond',
    labRefrFrom: 'First medium (light comes from)',
    labRefrTo: 'Second medium',
    labRefrIncidence: 'Angle of incidence θ1 (°)',
    labRefrAngle: 'Angle of refraction θ2 (°)',
    labRefrCritical: 'Critical angle θc (°)',
    labRefrTir: 'Total internal reflection: the angle of incidence is past the critical angle, so no light passes into the second medium.',
    labRefrNoCritical: 'No critical angle: the light passes into a medium of equal or higher index.',
```

(The medium names are the book's own, from the table on p.38.)

- [ ] **Step 3: The component**

Create `artifacts/mobile/components/lab/LabRefraction.tsx`:

```tsx
/**
 * Refraction (Grade 9): two media from the book's table and the angle of
 * incidence; the incident, refracted or totally reflected ray drawn against
 * the normal; θ2, and θc when there is one. Angles from services/labRefraction.ts.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';
import { MEDIA, criticalAngle, refract, type MediumId } from '@/services/labRefraction';
import { stepIndex, stepValues } from '@/services/labSteps';
import { formatLabNumber } from '@/services/labFormat';
import { LabChoice, LabResultRow, LabStepper } from './LabControls';

const W = 320;
const H = 240;
const CX = W / 2;
const CY = H / 2;
const L = 100;
const RAY = '#F59E0B';
const ANGLES = stepValues(0, 89, 1);
const NAME: Record<MediumId, TranslationKey> = {
  air: 'labMediumAir', water: 'labMediumWater', acetone: 'labMediumAcetone', glycerin: 'labMediumGlycerin',
  glass: 'labMediumGlass', quartz: 'labMediumQuartz', diamond: 'labMediumDiamond',
};
const RAD = Math.PI / 180;

export function LabRefraction() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [from, setFrom] = useState<MediumId>('water');
  const [to, setTo] = useState<MediumId>('glass');
  const [ai, setAi] = useState(45);
  const n1 = MEDIA.find(m => m.id === from)!.n;
  const n2 = MEDIA.find(m => m.id === to)!.n;
  const theta1 = ANGLES[ai];
  const r = refract(n1, n2, theta1);
  const c = criticalAngle(n1, n2);
  const options = MEDIA.map(m => ({ id: m.id, label: t(NAME[m.id]) }));
  const inStart = { x: CX - L * Math.sin(theta1 * RAD), y: CY - L * Math.cos(theta1 * RAD) };
  const out =
    r.kind === 'refracted'
      ? { x: CX + L * Math.sin(r.angleDeg * RAD), y: CY + L * Math.cos(r.angleDeg * RAD) }
      : { x: CX + L * Math.sin(theta1 * RAD), y: CY - L * Math.cos(theta1 * RAD) };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.h, { color: colors.foreground, textAlign: align }]}>{t('labRefrFrom')}</Text>
      <LabChoice options={options} value={from} onChange={id => setFrom(id as MediumId)} colors={colors} isRTL={isRTL} />
      <Text style={[styles.h, { color: colors.foreground, textAlign: align }]}>{t('labRefrTo')}</Text>
      <LabChoice options={options} value={to} onChange={id => setTo(id as MediumId)} colors={colors} isRTL={isRTL} />

      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={0} y={CY} width={W} height={H - CY} fill={colors.primary} opacity={0.12} />
          <Line x1={0} y1={CY} x2={W} y2={CY} stroke={colors.foreground} strokeWidth={2} />
          <Line x1={CX} y1={10} x2={CX} y2={H - 10} stroke={colors.mutedForeground} strokeWidth={1} strokeDasharray="5 5" />
          <Line x1={inStart.x} y1={inStart.y} x2={CX} y2={CY} stroke={RAY} strokeWidth={3} />
          <Line x1={CX} y1={CY} x2={out.x} y2={out.y} stroke={RAY} strokeWidth={3} />
          <SvgText x={12} y={24} fill={colors.foreground} fontSize={14}>{`n1 = ${n1}`}</SvgText>
          <SvgText x={12} y={H - 14} fill={colors.foreground} fontSize={14}>{`n2 = ${n2}`}</SvgText>
        </Svg>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LabStepper label={t('labRefrIncidence')} value={formatLabNumber(theta1, lang, 0)} colors={colors} isRTL={isRTL}
          onMinus={() => setAi(i => stepIndex(i, ANGLES.length, -1))} onPlus={() => setAi(i => stepIndex(i, ANGLES.length, 1))} />
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2 }]}>
        {r.kind === 'refracted' ? (
          <LabResultRow label={t('labRefrAngle')} colors={colors} align={align}>
            <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(r.angleDeg, lang, 1)}</Text>
          </LabResultRow>
        ) : (
          <Text style={{ color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }}>{t('labRefrTir')}</Text>
        )}
        {c === null ? (
          <Text style={{ color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{t('labRefrNoCritical')}</Text>
        ) : (
          <LabResultRow label={t('labRefrCritical')} colors={colors} align={align}>
            <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(c, lang, 1)}</Text>
          </LabResultRow>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  h: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  value: { fontSize: 20, fontFamily: 'ReadexPro_700Bold' },
});
```

The SVG labels `n1 = 1.33` stay in Latin digits on purpose. They name the book's table values in the drawing, which is Latin like every SVG label in the Lab (`A`, `B`, `R`). The results card prints its numbers in Arabic.

- [ ] **Step 4: Tests and typecheck**

Run:
- `pnpm --filter @workspace/curriculum test`. Expected: PASS, including the reworded interactive test and "names a lesson that exists" for both Grade 9 lessons. The known environmental `r2.test.ts` failure is not this task's.
- `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labSlides.test.ts services/__tests__/labLessons.test.ts`.
- Root `pnpm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/lab/LabRefraction.tsx lib/curriculum/src/lab.ts lib/curriculum/src/data/lab_items.json lib/curriculum/src/__tests__/lab.test.ts artifacts/mobile/components/lab/LabInteractive.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(lab): interactive refraction and critical angle for Grade 9"
```

---

### Task 3: Thin-lens geometry

**Files:**
- Create: `artifacts/mobile/services/labLens.ts`
- Test: `artifacts/mobile/services/__tests__/labLens.test.ts`

**Interfaces:**
- Produces:
  - `type LensKind = 'convex' | 'concave'`
  - `type ObjectCase = 'beyond-2f' | 'at-2f' | 'between-f-2f' | 'at-f' | 'inside-f'`
  - `OBJECT_CASES: readonly ObjectCase[]`, in the book's table order (p.59)
  - `OBJECT_DISTANCE: Record<ObjectCase, number>`, in units of the focal length
  - `type LensImage = { kind: 'real' | 'virtual'; orientation: 'inverted' | 'upright'; size: 'larger' | 'smaller' | 'same'; x: number; height: number }`
  - `lensImage(lens: LensKind, c: ObjectCase): LensImage | null`
  - `type Ray = { points: [number, number][]; dashed: boolean }`
  - `lensRays(lens: LensKind, c: ObjectCase, xMax?: number): Ray[]`

  All coordinates are in focal lengths. The lens is at x = 0 and the object at x = −d with height 1. Positive x is the side the light goes to.

- [ ] **Step 1: Failing tests**

Create `artifacts/mobile/services/__tests__/labLens.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OBJECT_CASES, OBJECT_DISTANCE, lensImage, lensRays, type ObjectCase } from '../labLens.ts';

const describeImage = (lens: 'convex' | 'concave', c: ObjectCase) => {
  const i = lensImage(lens, c);
  return i && `${i.size} ${i.orientation} ${i.kind}`;
};

describe('the book\'s cases (g9-physics-s2 p.59)', () => {
  it('in the table\'s order: x > 2F, x = 2F, F < x < 2F, x = F, x < F', () => {
    assert.deepEqual(OBJECT_CASES, ['beyond-2f', 'at-2f', 'between-f-2f', 'at-f', 'inside-f']);
    assert.ok(OBJECT_DISTANCE['beyond-2f'] > 2 && OBJECT_DISTANCE['at-2f'] === 2);
    assert.ok(OBJECT_DISTANCE['between-f-2f'] > 1 && OBJECT_DISTANCE['between-f-2f'] < 2);
    assert.ok(OBJECT_DISTANCE['at-f'] === 1 && OBJECT_DISTANCE['inside-f'] < 1);
  });
});

describe('lensImage — the book\'s descriptions (p.63–65)', () => {
  it('convex, beyond 2F: smaller, inverted, real (مصغّرٌ ومقلوبٌ وحقيقيٌّ), formed between F and 2F', () => {
    assert.equal(describeImage('convex', 'beyond-2f'), 'smaller inverted real');
    const x = lensImage('convex', 'beyond-2f')!.x;
    assert.ok(x > 1 && x < 2);
  });
  it('convex, at 2F: same size, inverted, real, at 2F', () => {
    assert.equal(describeImage('convex', 'at-2f'), 'same inverted real');
    assert.equal(lensImage('convex', 'at-2f')!.x, 2);
  });
  it('convex, between F and 2F: larger, inverted, real (مُكبّرٌ ومقلوبٌ وحقيقيٌّ), beyond 2F', () => {
    assert.equal(describeImage('convex', 'between-f-2f'), 'larger inverted real');
    assert.ok(lensImage('convex', 'between-f-2f')!.x > 2);
  });
  it('convex, at F: no image — the rays leave parallel', () => {
    assert.equal(lensImage('convex', 'at-f'), null);
  });
  it('convex, inside F: larger, upright, virtual (مكبّرٌ ومعتدلٌ ووهميٌّ), on the object\'s side', () => {
    assert.equal(describeImage('convex', 'inside-f'), 'larger upright virtual');
    assert.ok(lensImage('convex', 'inside-f')!.x < 0);
  });
  it('concave, any position: smaller, upright, virtual (مصغّرٌ ومعتدلٌ ووهميٌّ), between F and the lens', () => {
    for (const c of OBJECT_CASES) {
      assert.equal(describeImage('concave', c), 'smaller upright virtual', c);
      const x = lensImage('concave', c)!.x;
      assert.ok(x < 0 && x > -1, c);
    }
  });
});

describe('lensRays — the drawing agrees with the image', () => {
  it('every ray (or its dashed extension) passes through the image point', () => {
    for (const lens of ['convex', 'concave'] as const) {
      for (const c of OBJECT_CASES) {
        const img = lensImage(lens, c);
        if (!img) continue;
        for (const ray of lensRays(lens, c)) {
          const [[x1, y1], [x2, y2]] = ray.points.slice(-2);
          if (x1 === x2) continue;
          if (ray.points[0][0] < 0 && ray.points[ray.points.length - 1][0] === 0) continue; // the incoming half
          const y = y1 + ((y2 - y1) * (img.x - x1)) / (x2 - x1);
          assert.ok(Math.abs(y - img.height) < 1e-9, `${lens} ${c}: ray misses the image (${y} vs ${img.height})`);
        }
      }
    }
  });
  it('a virtual image is drawn with dashed extensions, a real one without', () => {
    assert.ok(lensRays('convex', 'inside-f').some(r => r.dashed));
    assert.ok(!lensRays('convex', 'beyond-2f').some(r => r.dashed));
    assert.ok(lensRays('concave', 'beyond-2f').some(r => r.dashed));
  });
});
```

- [ ] **Step 2: See them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labLens.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/labLens.ts`:

```ts
/**
 * Thin lenses for the lab's ray diagram (Grade 9, «العدساتُ الرقيقةُ»).
 *
 * The book teaches lenses by ray diagram only (g9-physics-s2 p.56–65: the five
 * object positions on p.59, the image words on p.62, the worked cases on
 * p.63–65), so the screen prints the book's description — larger/smaller/same,
 * inverted/upright, real/virtual — and never a lens equation. The equation
 * (1/f = 1/do + 1/di, real-positive) is used here only to put the image where
 * the book's rays meet. Units: focal lengths; lens at x = 0, object at x = −d,
 * height 1, light travelling toward +x.
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §4.
 */
export type LensKind = 'convex' | 'concave';
export type ObjectCase = 'beyond-2f' | 'at-2f' | 'between-f-2f' | 'at-f' | 'inside-f';

export const OBJECT_CASES: readonly ObjectCase[] = ['beyond-2f', 'at-2f', 'between-f-2f', 'at-f', 'inside-f'];
export const OBJECT_DISTANCE: Record<ObjectCase, number> = {
  'beyond-2f': 3,
  'at-2f': 2,
  'between-f-2f': 1.5,
  'at-f': 1,
  'inside-f': 0.5,
};

export type LensImage = {
  kind: 'real' | 'virtual';
  orientation: 'inverted' | 'upright';
  size: 'larger' | 'smaller' | 'same';
  /** Image position: > 0 beyond the lens (real), < 0 on the object's side (virtual). */
  x: number;
  /** Image height: < 0 inverted. */
  height: number;
};

export type Ray = { points: [number, number][]; dashed: boolean };

const EPS = 1e-9;

export function lensImage(lens: LensKind, c: ObjectCase): LensImage | null {
  const d = OBJECT_DISTANCE[c];
  const f = lens === 'convex' ? 1 : -1;
  if (Math.abs(d - f) < EPS) return null; // at F: the rays leave parallel and never meet
  const di = (d * f) / (d - f);
  const m = -di / d;
  return {
    kind: di > 0 ? 'real' : 'virtual',
    orientation: m < 0 ? 'inverted' : 'upright',
    size: Math.abs(Math.abs(m) - 1) < EPS ? 'same' : Math.abs(m) > 1 ? 'larger' : 'smaller',
    x: di,
    height: m,
  };
}

/**
 * Two of the book's standard rays from the top of the object: the one parallel
 * to the axis (then through F2 for a convex lens, or away from F1 for a concave
 * one) and the one through the centre (straight on). A virtual image adds the
 * dashed backward extensions that meet at it.
 */
export function lensRays(lens: LensKind, c: ObjectCase, xMax = 4): Ray[] {
  const d = OBJECT_DISTANCE[c];
  const slope = lens === 'convex' ? -1 : 1; // the parallel ray after the lens: through (1, 0), or as if from (−1, 0)
  const rays: Ray[] = [
    { points: [[-d, 1], [0, 1]], dashed: false },
    { points: [[0, 1], [xMax, 1 + slope * xMax]], dashed: false },
    { points: [[-d, 1], [xMax, -xMax / d]], dashed: false },
  ];
  const img = lensImage(lens, c);
  if (img && img.kind === 'virtual') {
    rays.push({ points: [[0, 1], [img.x, img.height]], dashed: true });
    rays.push({ points: [[0, 0], [img.x, img.height]], dashed: true });
  }
  return rays;
}
```

The test's skip rule leaves out the incoming parallel segment, which ends exactly at the lens (x = 0). It checks every other ray, and the dashed extensions, against the image point. The refracted parallel ray is y = 1 + slope·x and the centre ray is y = −x/d. Both pass through (di, m), since 1 − di = m for convex, 1 + di = m for concave, and −di/d = m.

- [ ] **Step 4: See them pass**

Run the same command. Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labLens.ts artifacts/mobile/services/__tests__/labLens.test.ts
git commit -m "feat(lab): thin-lens images and rays matching the Grade 9 book's cases"
```

---

### Task 4: The thin-lens tool

**Files:**
- Create: `artifacts/mobile/components/lab/LabThinLens.tsx`
- Modify: `lib/curriculum/src/lab.ts`, `lib/curriculum/src/data/lab_items.json`, `artifacts/mobile/components/lab/LabInteractive.tsx`, `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: `OBJECT_CASES`, `OBJECT_DISTANCE`, `lensImage`, `lensRays`, `LensKind`, `ObjectCase` (Task 3); `LabChoice` (PR 4).
- Produces: interactive id `thin-lens`, item `lab-thin-lens` (u5_l3).

- [ ] **Step 1: Id, item, Record**

Append `'thin-lens'` to `LAB_INTERACTIVE_IDS`. Append to `lab_items.json`:

```json
    {
      "id": "lab-thin-lens",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "thin-lens",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u5_l3",
      "titleAr": "العدسات الرقيقة: مخطط الأشعة تفاعليًا",
      "titleEn": "Interactive Thin-Lens Ray Diagram"
    }
```

Add `'thin-lens': LabThinLens,` to `COMPONENTS`.

- [ ] **Step 2: Labels**

Add to the `ar` block:

```ts
    labLensConvex: 'عدسة محدّبة',
    labLensConcave: 'عدسة مقعّرة',
    labLensPosition: 'موقع الجسم x',
    labLensImage: 'صفات الخيال',
    labLensNone: 'لا يتكوّن خيال: تخرج الأشعة من العدسة متوازية.',
    labLensLarger: 'مكبّرٌ',
    labLensSmaller: 'مصغّرٌ',
    labLensSame: 'مساوٍ للجسم في الحجم',
    labLensInverted: 'مقلوبٌ',
    labLensUpright: 'معتدلٌ',
    labLensReal: 'حقيقيٌّ',
    labLensVirtual: 'وهميٌّ',
```

Add to the `en` block:

```ts
    labLensConvex: 'Convex lens',
    labLensConcave: 'Concave lens',
    labLensPosition: 'Object position x',
    labLensImage: 'The image',
    labLensNone: 'No image forms: the rays leave the lens parallel.',
    labLensLarger: 'larger',
    labLensSmaller: 'smaller',
    labLensSame: 'the same size',
    labLensInverted: 'inverted',
    labLensUpright: 'upright',
    labLensReal: 'real',
    labLensVirtual: 'virtual',
```

- [ ] **Step 3: The component**

Create `artifacts/mobile/components/lab/LabThinLens.tsx`:

```tsx
/**
 * The thin-lens ray diagram (Grade 9): convex or concave, the object at one of
 * the book's five positions, two standard rays and the image where they meet.
 * The result is the book's description in words, never numbers (spec §4).
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';
import { OBJECT_CASES, OBJECT_DISTANCE, lensImage, lensRays, type LensKind, type ObjectCase, type LensImage } from '@/services/labLens';
import { LabChoice } from './LabControls';

const W = 320;
const H = 220;
const UNIT = 36; // px per focal length
const CX = W / 2;
const CY = H / 2;
const RAY = '#F59E0B';
const CASE_LABEL: Record<ObjectCase, string> = {
  'beyond-2f': 'x > 2F', 'at-2f': 'x = 2F', 'between-f-2f': 'F < x < 2F', 'at-f': 'x = F', 'inside-f': 'x < F',
};
const SIZE: Record<LensImage['size'], TranslationKey> = { larger: 'labLensLarger', smaller: 'labLensSmaller', same: 'labLensSame' };
const ORIENT: Record<LensImage['orientation'], TranslationKey> = { inverted: 'labLensInverted', upright: 'labLensUpright' };
const KIND: Record<LensImage['kind'], TranslationKey> = { real: 'labLensReal', virtual: 'labLensVirtual' };

const px = (x: number) => CX + x * UNIT;
const py = (y: number) => CY - y * UNIT;

export function LabThinLens() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [lens, setLens] = useState<LensKind>('convex');
  const [pos, setPos] = useState<ObjectCase>('beyond-2f');
  const img = lensImage(lens, pos);
  const rays = lensRays(lens, pos);
  const d = OBJECT_DISTANCE[pos];
  const words = img ? [t(SIZE[img.size]), t(ORIENT[img.orientation]), t(KIND[img.kind])] : [];
  const description = lang === 'ar' ? words.join(' و') : words.length ? `${words[0]}, ${words[1]} and ${words[2]}` : '';

  return (
    <View style={styles.wrap}>
      <LabChoice
        options={[{ id: 'convex', label: t('labLensConvex') }, { id: 'concave', label: t('labLensConcave') }]}
        value={lens}
        onChange={id => setLens(id as LensKind)}
        colors={colors}
        isRTL={isRTL}
      />
      <Text style={[styles.h, { color: colors.foreground, textAlign: align }]}>{t('labLensPosition')}</Text>
      <LabChoice options={OBJECT_CASES.map(c => ({ id: c, label: CASE_LABEL[c] }))} value={pos} onChange={id => setPos(id as ObjectCase)} colors={colors} isRTL={isRTL} />

      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Line x1={0} y1={CY} x2={W} y2={CY} stroke={colors.mutedForeground} strokeWidth={1} />
          <Line x1={CX} y1={CY - 80} x2={CX} y2={CY + 80} stroke={colors.primary} strokeWidth={3} />
          {[-2, -1, 1, 2].map(k => (
            <React.Fragment key={k}>
              <Circle cx={px(k)} cy={CY} r={3} fill={colors.foreground} />
              <SvgText x={px(k)} y={CY + 18} fill={colors.foreground} fontSize={12} textAnchor="middle">{Math.abs(k) === 2 ? '2F' : 'F'}</SvgText>
            </React.Fragment>
          ))}
          {rays.map((r, i) => (
            <Line key={i} x1={px(r.points[0][0])} y1={py(r.points[0][1])} x2={px(r.points[1][0])} y2={py(r.points[1][1])}
              stroke={RAY} strokeWidth={2} strokeDasharray={r.dashed ? '5 5' : undefined} />
          ))}
          <Line x1={px(-d)} y1={CY} x2={px(-d)} y2={py(1)} stroke={colors.foreground} strokeWidth={4} />
          {img ? (
            <Line x1={px(img.x)} y1={CY} x2={px(img.x)} y2={py(img.height)} stroke={colors.foreground} strokeWidth={4}
              strokeDasharray={img.kind === 'virtual' ? '4 3' : undefined} opacity={0.7} />
          ) : null}
        </Svg>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2 }]}>
        <Text style={{ color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{t('labLensImage')}</Text>
        <Text style={{ color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_700Bold', fontSize: 18 }}>
          {img ? description : t('labLensNone')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  h: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
});
```

In Arabic the description reads exactly as the book prints it, e.g. «مصغّرٌ ومقلوبٌ وحقيقيٌّ» and «مكبّرٌ ومعتدلٌ ووهميٌّ». The rays reach x = 4 focal lengths and the canvas shows about ±4.4, so a ray may run off the edge; the canvas clips it (`overflow: 'hidden'`).

- [ ] **Step 4: Tests and typecheck**

Run the curriculum suite, `labSlides` + `labLessons`, and the root typecheck, exactly as in Task 2 Step 4.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/lab/LabThinLens.tsx lib/curriculum/src/lab.ts lib/curriculum/src/data/lab_items.json artifacts/mobile/components/lab/LabInteractive.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(lab): interactive thin-lens ray diagram for Grade 9"
```

---

### Task 5: The lever

**Files:**
- Create: `artifacts/mobile/services/labLever.ts`
- Test: `artifacts/mobile/services/__tests__/labLever.test.ts`
- Create: `artifacts/mobile/components/lab/LabLever.tsx`
- Modify: `lib/curriculum/src/lab.ts`, `lib/curriculum/src/data/lab_items.json`, `artifacts/mobile/components/lab/LabInteractive.tsx`, `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Produces:
  - `type LeverState = 'balanced' | 'load-side-down' | 'effort-side-down'`
  - `lever(l: { loadMass: number; loadArm: number; effortMass: number; effortArm: number }): { state: LeverState; ma: number; effortNeeded: number }`. Masses are in kg, as the book's example writes them (`m1`, `m2`); arms are in cm.
- Produces: interactive id `lever`, item `lab-lever`.

- [ ] **Step 1: Failing tests**

Create `artifacts/mobile/services/__tests__/labLever.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lever } from '../labLever.ts';

describe('lever — the book\'s worked examples (g9-physics-s1 p.81)', () => {
  it('25 kg at a 20 cm load arm balances 10 kg at a 50 cm effort arm; MA = 2.5', () => {
    const l = lever({ loadMass: 25, loadArm: 20, effortMass: 10, effortArm: 50 });
    assert.equal(l.state, 'balanced');
    assert.equal(l.effortNeeded, 10);
    assert.equal(l.ma, 2.5);
  });
  it('arms of 3 cm (load) and 15 cm (effort) give MA = 5', () => {
    assert.equal(lever({ loadMass: 10, loadArm: 3, effortMass: 2, effortArm: 15 }).ma, 5);
  });
});

describe('lever — moments decide the tilt (F1 d1 = F2 d2)', () => {
  it('a heavier effort tips the effort side down, a lighter one the load side', () => {
    assert.equal(lever({ loadMass: 25, loadArm: 20, effortMass: 12, effortArm: 50 }).state, 'effort-side-down');
    assert.equal(lever({ loadMass: 25, loadArm: 20, effortMass: 8, effortArm: 50 }).state, 'load-side-down');
  });
  it('the effort needed does not depend on the effort chosen', () => {
    const a = lever({ loadMass: 30, loadArm: 40, effortMass: 1, effortArm: 60 });
    const b = lever({ loadMass: 30, loadArm: 40, effortMass: 50, effortArm: 60 });
    assert.equal(a.effortNeeded, 20);
    assert.equal(b.effortNeeded, 20);
  });
  it('a longer effort arm means less effort: MA grows with d2', () => {
    assert.ok(lever({ loadMass: 20, loadArm: 20, effortMass: 1, effortArm: 80 }).effortNeeded < lever({ loadMass: 20, loadArm: 20, effortMass: 1, effortArm: 40 }).effortNeeded);
  });
});
```

- [ ] **Step 2: See them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labLever.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the maths**

Create `artifacts/mobile/services/labLever.ts`:

```ts
/**
 * A first-class lever for the lab's interactive (Grade 9, «الآلاتُ البسيطةُ»),
 * in the book's notation (g9-physics-s1 p.79–81): F1 d1 = F2 d2, where F1 and
 * d1 are the load and its arm, F2 and d2 the effort and its arm, and
 * MA = d2 / d1. The book's example weighs both sides as masses (m1 g, m2 g),
 * so g cancels and masses in kg and arms in cm are enough.
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §4.
 */
export type LeverState = 'balanced' | 'load-side-down' | 'effort-side-down';

export function lever({ loadMass, loadArm, effortMass, effortArm }: { loadMass: number; loadArm: number; effortMass: number; effortArm: number }): {
  state: LeverState;
  ma: number;
  effortNeeded: number;
} {
  const load = loadMass * loadArm;
  const effort = effortMass * effortArm;
  const diff = effort - load;
  const state: LeverState = Math.abs(diff) <= 1e-9 * Math.max(load, effort) ? 'balanced' : diff > 0 ? 'effort-side-down' : 'load-side-down';
  return { state, ma: effortArm / loadArm, effortNeeded: load / effortArm };
}
```

Run the test. Expected: PASS (5 tests).

- [ ] **Step 4: Id, item, Record, labels**

Append `'lever'` to `LAB_INTERACTIVE_IDS`. Append to `lab_items.json`:

```json
    {
      "id": "lab-lever",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "lever",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s1-nccd-u3_l2",
      "titleAr": "الرافعة تفاعليًا",
      "titleEn": "Interactive Lever"
    }
```

Add `lever: LabLever,` to `COMPONENTS`.

Add to the `ar` block:

```ts
    labLeverLoad: 'كتلة المقاومة m1 (kg)',
    labLeverLoadArm: 'ذراع المقاومة d1 (cm)',
    labLeverEffort: 'كتلة القوة m2 (kg)',
    labLeverEffortArm: 'ذراع القوة d2 (cm)',
    labLeverMa: 'الفائدة الآلية MA = d2 ÷ d1',
    labLeverNeeded: 'كتلة القوة اللازمة للاتزان (kg)',
    labLeverBalanced: 'الرافعة متزنة: F1 × d1 = F2 × d2.',
    labLeverLoadDown: 'تميل الرافعة نحو المقاومة: القوة غير كافية.',
    labLeverEffortDown: 'تميل الرافعة نحو القوة: القوة أكبر من اللازم.',
```

Add to the `en` block:

```ts
    labLeverLoad: 'Load mass m1 (kg)',
    labLeverLoadArm: 'Load arm d1 (cm)',
    labLeverEffort: 'Effort mass m2 (kg)',
    labLeverEffortArm: 'Effort arm d2 (cm)',
    labLeverMa: 'Mechanical advantage MA = d2 ÷ d1',
    labLeverNeeded: 'Effort mass needed to balance (kg)',
    labLeverBalanced: 'The lever balances: F1 × d1 = F2 × d2.',
    labLeverLoadDown: 'The lever tips toward the load: the effort is not enough.',
    labLeverEffortDown: 'The lever tips toward the effort: the effort is more than needed.',
```

«المقاومة» / «القوة» / «ذراع المقاومة» / «ذراع القوة» / «الفائدة الآلية» are the book's own words (p.79–80).

- [ ] **Step 5: The component**

Create `artifacts/mobile/components/lab/LabLever.tsx`:

```tsx
/**
 * A first-class lever (Grade 9): the load and the effort as masses on their
 * arms, the beam tipping toward the larger moment, the mechanical advantage
 * and the effort that would balance it. Numbers from services/labLever.ts.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Polygon, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';
import { lever, type LeverState } from '@/services/labLever';
import { stepIndex, stepValues } from '@/services/labSteps';
import { formatLabNumber } from '@/services/labFormat';
import { LabResultRow, LabStepper } from './LabControls';

const W = 320;
const H = 180;
const PIVOT = { x: W / 2, y: 110 };
const PX_PER_CM = 1.3; // a 100 cm arm is 130 px
const LOADS = stepValues(5, 50, 5);
const EFFORTS = stepValues(1, 50, 1);
const ARMS = stepValues(5, 100, 5);
const LOAD_COLOR = '#64748B';
const TILT: Record<LeverState, number> = { balanced: 0, 'load-side-down': -8, 'effort-side-down': 8 };
const STATE: Record<LeverState, TranslationKey> = {
  balanced: 'labLeverBalanced', 'load-side-down': 'labLeverLoadDown', 'effort-side-down': 'labLeverEffortDown',
};

export function LabLever() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [li, setLi] = useState(LOADS.indexOf(25));
  const [la, setLa] = useState(ARMS.indexOf(20));
  const [ei, setEi] = useState(EFFORTS.indexOf(8));
  const [ea, setEa] = useState(ARMS.indexOf(50));
  const r = lever({ loadMass: LOADS[li], loadArm: ARMS[la], effortMass: EFFORTS[ei], effortArm: ARMS[ea] });
  const loadX = PIVOT.x - ARMS[la] * PX_PER_CM;
  const effortX = PIVOT.x + ARMS[ea] * PX_PER_CM;
  // Load on the left, effort on the right: a positive SVG rotation turns the right side down.
  const angle = TILT[r.state];
  const box = (x: number, kg: number, fill: string) => {
    const s = 14 + Math.min(kg, 50) * 0.5;
    return <Rect x={x - s / 2} y={PIVOT.y - 6 - s} width={s} height={s} fill={fill} rx={3} />;
  };
  const step = (set: React.Dispatch<React.SetStateAction<number>>, len: number) => ({
    onMinus: () => set(i => stepIndex(i, len, -1)),
    onPlus: () => set(i => stepIndex(i, len, 1)),
  });

  return (
    <View style={styles.wrap}>
      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <G rotation={angle} origin={`${PIVOT.x}, ${PIVOT.y}`}>
            <Line x1={10} y1={PIVOT.y} x2={W - 10} y2={PIVOT.y} stroke={colors.foreground} strokeWidth={5} />
            {box(loadX, LOADS[li], LOAD_COLOR)}
            {box(effortX, EFFORTS[ei], colors.primary)}
          </G>
          <Polygon points={`${PIVOT.x},${PIVOT.y + 3} ${PIVOT.x - 16},${PIVOT.y + 30} ${PIVOT.x + 16},${PIVOT.y + 30}`} fill={colors.mutedForeground} />
          <Line x1={0} y1={PIVOT.y + 30} x2={W} y2={PIVOT.y + 30} stroke={colors.mutedForeground} strokeWidth={2} />
        </Svg>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LabStepper label={t('labLeverLoad')} value={formatLabNumber(LOADS[li], lang, 0)} colors={colors} isRTL={isRTL} {...step(setLi, LOADS.length)} />
        <LabStepper label={t('labLeverLoadArm')} value={formatLabNumber(ARMS[la], lang, 0)} colors={colors} isRTL={isRTL} {...step(setLa, ARMS.length)} />
        <LabStepper label={t('labLeverEffort')} value={formatLabNumber(EFFORTS[ei], lang, 0)} colors={colors} isRTL={isRTL} {...step(setEi, EFFORTS.length)} />
        <LabStepper label={t('labLeverEffortArm')} value={formatLabNumber(ARMS[ea], lang, 0)} colors={colors} isRTL={isRTL} {...step(setEa, ARMS.length)} />
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2 }]}>
        <Text style={{ color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }}>{t(STATE[r.state])}</Text>
        <LabResultRow label={t('labLeverMa')} colors={colors} align={align}>
          <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(r.ma, lang, 2)}</Text>
        </LabResultRow>
        <LabResultRow label={t('labLeverNeeded')} colors={colors} align={align}>
          <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(r.effortNeeded, lang, 2)}</Text>
        </LabResultRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  value: { fontSize: 20, fontFamily: 'ReadexPro_700Bold' },
});
```

`react-native-svg`'s `G` takes `rotation` with an `origin`. Check the installed version's prop names in `node_modules/react-native-svg`: if it wants `transform="rotate(a cx cy)"` instead, use that.

The beam is drawn with the load on the left. It does not mirror in Arabic: a physics diagram is a picture, not text, like the vector tool's axes.

- [ ] **Step 6: Typecheck, suites, browser**

Run root `pnpm run typecheck`, `pnpm --filter @workspace/curriculum test`, and `cd artifacts/mobile && pnpm test` (prints nothing for minutes; not a hang). Expected: PASS, including `cornerTheme`, `iconSystem` and `designScale`.

Browser check: `pnpm run dev:mobile:web` against a throwaway Postgres, as in the PR 1 plan's Task 4; never read `.env`. Use Arabic, a phone at 390 × 844 and a desktop at 1280 × 800, light and dark. From the Lab, open:
- **Refraction, on lesson u5_l1:** water into glass at 45° gives θ2 ≈ ٣٨٫٢. Water into air shows θc ≈ ٤٨٫٨. At 60° the line «انعكاس كلي داخلي…» shows and the drawn ray goes back up.
- **Refraction, on lesson u5_l2:** opens the same tool.
- **Thin lens:** convex, x > 2F reads «مصغّرٌ ومقلوبٌ وحقيقيٌّ». x = F reads «لا يتكوّن خيال…». x < F reads «مكبّرٌ ومعتدلٌ ووهميٌّ», with dashed rays. Concave reads «مصغّرٌ ومعتدلٌ ووهميٌّ» at every position.
- **Lever:** 25 kg, 20 cm, 50 cm. With an effort of 8 kg it tips toward the load; at 10 kg it balances; MA reads ٢٫٥ and the effort needed ١٠.

Take one screenshot per tool at deviceScaleFactor 2 into the scratchpad. Stop every server and the database cluster.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/services/labLever.ts artifacts/mobile/services/__tests__/labLever.test.ts artifacts/mobile/components/lab/LabLever.tsx lib/curriculum/src/lab.ts lib/curriculum/src/data/lab_items.json artifacts/mobile/components/lab/LabInteractive.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(lab): interactive lever for Grade 9"
```

---

### Task 6: «ما الجديد», status log, checks

**Files:**
- Modify: `artifacts/mobile/services/whatsNew.ts`, `artifacts/mobile/services/i18n.ts`, `docs/status-log.md`, the spec

- [ ] **Step 1: The entry**

At the top of `WHATS_NEW`, add the entry below. Set `date` to the output of `TZ=Asia/Amman date +%F`. If `main` has a later-dated entry, put this one directly above the newest entry that is not later.

```ts
  {
    id: 'lab-optics-lever',
    date: '2026-11-28', // replace with the output of: TZ=Asia/Amman date +%F
    roles: ['teacher', 'student'],
    titleKey: 'whatsNewLabOpticsTitle',
    bodyKey: 'whatsNewLabOpticsBody',
    route: '/curriculum/lab',
  },
```

Add to the `ar` block:

```ts
    whatsNewLabOpticsTitle: 'الضوء والرافعة في «المختبر»',
    whatsNewLabOpticsBody: 'أضفنا لفيزياء الصف التاسع ثلاث أدوات تفاعلية: انكسار الضوء والزاوية الحرجة بمعاملات انكسار الكتاب، ومخطط الأشعة في العدسات المحدّبة والمقعّرة بصفات الخيال كما يكتبها الكتاب، والرافعة مع فائدتها الآلية.',
```

Add to the `en` block:

```ts
    whatsNewLabOpticsTitle: 'Light and the lever in the Lab',
    whatsNewLabOpticsBody: 'Three interactive tools for Grade 9 physics: refraction and the critical angle with the book\'s refractive indices, the ray diagram for convex and concave lenses with the image described as the book describes it, and the lever with its mechanical advantage.',
```

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whatsNew.test.ts`. Expected: PASS.

- [ ] **Step 2: Status log and spec**

At the top of `docs/status-log.md`, directly under the header paragraph:

```markdown
## Science Lab: refraction, thin-lens and lever tools — 2026-11-28

PR 5 of `docs/superpowers/specs/2026-11-13-lab-expansion-design.md`, the last of its five.

**What changed.**
- `refraction`, filed on Grade 9 «انكسارُ الضوءِ» and «تطبيقاتٌ وظواهرُ بصريّةٌ». The seven media come from the
  book's table (g9-physics-s2 p.38). It shows θ2, θc where there is one, and total internal reflection past it.
  The test reproduces the book's examples: 1.33·sin 45° = 1.53·sin 38° (p.42), 48.6° for water (p.46) and
  46.2° for 1.8 → 1.3 (p.49).
- `thin-lens`, Grade 9 «العدساتُ الرقيقةُ»: convex or concave, with the book's five object positions (p.59). The
  image is described in the book's words, e.g. «مصغّرٌ ومقلوبٌ وحقيقيٌّ», and never with numbers. The test pins each
  case to p.63–65 and checks that every drawn ray passes through the image.
- `lever`, Grade 9 «الآلاتُ البسيطةُ», in the book's F1 d1 = F2 d2 and MA = d2 ÷ d1. The test pins
  25 kg × 20 cm = 10 kg × 50 cm and MA 2.5, and 3 cm / 15 cm → MA 5 (g9-physics-s1 p.81).
- `lab.test.ts`: every interactive ships at least once, so one tool can sit on two lessons.

**Verified.** Root typecheck; curriculum `test` (N/M — name any failure, e.g. `r2.test.ts` where R2 is configured
locally) and `verify`; mobile `pnpm test` (N tests, 0 failing); api-server build + test (N); math-verifier (ran /
not run and why); browser: each tool shows its book example on screen, phone and desktop, light and dark.

**Not done.** Nothing left from the spec's five PRs. Its *Out of scope* list stands: inclined plane, pulley and
wheel-and-axle; measurement; motion graphs; waves; more biology media; Grades 6–8 science lab rows.
```

Replace each N/M with the counts your runs printed. Correct any clause that did not hold, and use the same date as the What's New entry.

In the spec:
- Change the status line to say all five PRs are built, matching what is merged by then.
- In §4's tool table, Controls column:
  - `lever`: «load mass m1 (kg), load arm d1 (cm), effort mass m2 (kg), effort arm d2 (cm) — the book's example writes masses and centimetres».
  - `refraction`: «medium 1 and 2 from the book's table (p.38), θ1 0–89° (1)».
  - `thin-lens`: «convex / concave; the five positions as chips».

- [ ] **Step 3: Run what CI runs**

```bash
pnpm run typecheck
```

```bash
pnpm --filter @workspace/curriculum test && pnpm --filter @workspace/curriculum run verify
```

```bash
cd artifacts/mobile && pnpm test
```

```bash
cd artifacts/api-server && pnpm build && pnpm test
```

```bash
cd artifacts/math-verifier && python -X utf8 test_equations.py
```

Expected: all PASS. If something cannot run here, report it; do not install system packages.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/services/whatsNew.ts artifacts/mobile/services/i18n.ts docs/status-log.md docs/superpowers/specs/2026-11-13-lab-expansion-design.md
git diff --cached --stat
git commit -m "docs(lab): what's new, status log and spec status for the optics and lever tools"
```

Then push and open a new PR titled «Science Lab: refraction, thin-lens and lever tools». In the body include:
- what changed, with the book example behind each tool;
- the four screenshots;
- the What's New entry and its date note;
- «Deploy: web bundle and API (lib/ changed); no migration, no native change».
