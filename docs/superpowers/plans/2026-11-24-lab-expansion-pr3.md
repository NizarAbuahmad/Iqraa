# Lab expansion PR 3: reviewing the virtual-lab sheets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a science teacher a way to review the six written virtual-lab sheets, so they can be released, and show released sheets in the Science Lab. Concretely: an admin-only screen that shows each sheet exactly as teachers will get it; a written review checklist; a rule that a recorded review date is a real past date; and a «تجارب افتراضية» section in the Lab.

**Architecture:** Recording a review stays a code change (`reviewedBy`/`reviewedAt` in `lib/curriculum/src/virtualLabs.ts`), as that file requires — no database, no API. A pure module `artifacts/mobile/services/labSheets.ts` joins sheets with their simulations and filters them by grade, subject and release state; the admin screen and the Lab screen both read it. The admin preview reuses `VirtualLabCard` through a new `preview` prop that lets an unreviewed sheet through, exactly as a dev build already does.

**Tech Stack:** TypeScript, `node:test`, Expo / React Native (web build for the visual check), Markdown.

**Spec:** `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` §5 («Reviewing the virtual-lab sheets»), *Scope and order* item 3. Builds on PR 1 (NizarAbuahmad/Iqraa#1447) and PR 2 (`docs/superpowers/plans/2026-11-13-lab-expansion-pr2.md`).

## Global Constraints

- **Prerequisite:** PRs 1 and 2 are merged to `main`; start from the latest `origin/main` in a fresh branch (or restart the session branch from `origin/main` if its previous PR merged). PR 3 is its own pull request.
- Recording a review is a code change by a person who did the review: nothing in this PR sets `reviewedBy`/`reviewedAt` on a shipped sheet, and no screen writes anything (spec §5).
- `releasedVirtualLab(lessonId, { dev })` stays the single gate: a sheet with no `reviewedAt` reaches a teacher only in a dev build or the admin preview.
- The admin screen is `system_admin` only, following `app/admin/artifact-reports.tsx` (role check `ADMIN_ROLES = ['system_admin']`, a lock screen for anyone else, Arabic/English strings inline).
- Corner screens (`app/curriculum/lab/*`) take colours from `useColors()`, never `palette`. Admin screens use the admin accent `#4F46E5` like the other admin screens.
- Every literal `<Ionicons size>` is on the icon scale: 14, 16, 20, 24 (UI) or 32, 40, 48, 64 (display) — `iconSystem.test.ts` fails anything else. No hand-written `shadowColor`.
- Mobile tests live in `artifacts/mobile/services/__tests__/`, import no `react-native`/`expo-*`, and use explicit `.ts` extensions for relative imports.
- Edit with the Edit tool; never `sed -i` / `perl -pi`. Read the `git diff` of `i18n.ts` after editing.
- No «ما الجديد» entry: nothing changes for a teacher until a sheet is reviewed (the Lab section is empty in production, and the screen is admin-only). Say so in the PR body.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `lib/curriculum/src/virtualLabs.ts` | Modify | `validateVirtualLabs` refuses a `reviewedAt` that is not a past `YYYY-MM-DD` |
| `lib/curriculum/src/__tests__/virtualLabs.test.ts` | Modify | Tests for the date rule |
| `artifacts/mobile/services/labSheets.ts` | Create | Pure: sheets joined with their simulation; filtering for the Lab |
| `artifacts/mobile/services/__tests__/labSheets.test.ts` | Create | Tests for it |
| `artifacts/mobile/components/ui/VirtualLabCard.tsx` | Modify | `preview` prop: show an unreviewed sheet (admin review) |
| `artifacts/mobile/app/admin/virtual-labs.tsx` | Create | The review screen |
| `artifacts/mobile/app/admin/dashboard.tsx` | Modify | Link to it, `system_admin` only |
| `artifacts/mobile/app/curriculum/lab/index.tsx` | Modify | «تجارب افتراضية» section |
| `artifacts/mobile/services/i18n.ts` | Modify | Two keys |
| `docs/virtual-lab-review.md` | Create | The reviewer's checklist |
| `docs/status-log.md`, the spec | Modify | Log entry, status line |

---

### Task 1: A review date must be a real, past calendar day

**Files:**
- Modify: `lib/curriculum/src/virtualLabs.ts` (`validateVirtualLabs`)
- Test: `lib/curriculum/src/__tests__/virtualLabs.test.ts`

**Interfaces:**
- Produces: `validateVirtualLabs(labs, resources, now?: Date): string[]` — `now` defaults to `new Date()`; existing two-argument callers (`virtualLabs.test.ts`, `artifacts/mobile/services/__tests__/virtualLabContent.test.ts`) keep working.

- [ ] **Step 1: Write the failing tests**

In `virtualLabs.test.ts`, inside `describe('validateVirtualLabs', …)`, after `it('refuses a reviewer without a review date', …)`, add:

```ts
  const reviewed = (reviewedAt: string): VirtualLabSheet => ({ ...sheet, reviewedBy: 'أ. معلم', reviewedAt });
  const NOW = new Date('2026-11-24T10:00:00Z');

  it('accepts a review dated today or earlier', () => {
    assert.deepEqual(validateVirtualLabs([reviewed('2026-11-24')], [sim], NOW), []);
    assert.deepEqual(validateVirtualLabs([reviewed('2026-10-10')], [sim], NOW), []);
  });
  it('refuses a review date that is not a YYYY-MM-DD day', () => {
    for (const bad of ['24/11/2026', '2026-11-24T10:00:00Z', '2026-13-01', '2026-02-30', 'soon']) {
      assert.ok(
        validateVirtualLabs([reviewed(bad)], [sim], NOW).some(e => /reviewedAt .* is not a YYYY-MM-DD day/.test(e)),
        bad,
      );
    }
  });
  it('refuses a review dated in the future', () => {
    assert.ok(validateVirtualLabs([reviewed('2026-11-25')], [sim], NOW).some(e => /reviewedAt .* is in the future/.test(e)));
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/virtualLabs.test.ts`
Expected: FAIL — the format and future-date tests find no error.

- [ ] **Step 3: Implement**

In `lib/curriculum/src/virtualLabs.ts`, change the signature

```ts
export function validateVirtualLabs(
  labs: readonly VirtualLabSheet[],
  resources: readonly ExternalResource[],
): string[] {
```

to

```ts
export function validateVirtualLabs(
  labs: readonly VirtualLabSheet[],
  resources: readonly ExternalResource[],
  now: Date = new Date(),
): string[] {
```

and directly after the two existing `reviewedAt`/`reviewedBy` checks add:

```ts
    // A review happened on a day: a calendar date that exists, and not one still
    // to come — a future date would release a sheet nobody has read yet.
    if (l.reviewedAt) {
      if (!isCalendarDay(l.reviewedAt)) errors.push(`${l.lessonId}: reviewedAt "${l.reviewedAt}" is not a YYYY-MM-DD day`);
      else if (l.reviewedAt > now.toISOString().slice(0, 10)) errors.push(`${l.lessonId}: reviewedAt "${l.reviewedAt}" is in the future`);
    }
```

and add this helper above `releasedVirtualLab`:

```ts
/** `YYYY-MM-DD` naming a day that exists (no 2026-02-30). */
function isCalendarDay(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s;
}
```

(Comparing `YYYY-MM-DD` strings is a date comparison. `now` is read as a UTC day; a review recorded in Amman just after midnight is at most a few hours "ahead" and the PR that records it is merged later than that.)

- [ ] **Step 4: Run them to see them pass**

Run the same command, then `pnpm --filter @workspace/curriculum test`.
Expected: PASS (apart from `r2.test.ts` where R2 is configured locally); "the shipped sheets are all valid against the shipped catalog" still passes — no shipped sheet has a `reviewedAt`.

- [ ] **Step 5: Commit**

```bash
git add lib/curriculum/src/virtualLabs.ts lib/curriculum/src/__tests__/virtualLabs.test.ts
git commit -m "feat(virtual-lab): a review date must be a real past day"
```

---

### Task 2: Sheets joined with their simulation, and filtered for the Lab

**Files:**
- Create: `artifacts/mobile/services/labSheets.ts`
- Test: `artifacts/mobile/services/__tests__/labSheets.test.ts`

**Interfaces:**
- Consumes: `VirtualLabSheet`, `ExternalResource` types from `@workspace/curriculum`.
- Produces (Tasks 3 and 4 use these):
  ```ts
  export type LabSheetRow = {
    lessonId: string;
    resourceId: string;
    simTitleAr: string;
    simUrl: string;
    gradeIds: readonly string[];
    subjectId: string;
    reviewedBy?: string;
    reviewedAt?: string;
  };
  export function labSheetRows(labs: readonly VirtualLabSheet[], resources: readonly ExternalResource[]): LabSheetRow[];
  export function labSheetsFor(rows: readonly LabSheetRow[], f: { gradeId: string | null; subjectId: string | null; dev: boolean }): LabSheetRow[];
  ```

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/labSheets.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';
import { VIRTUAL_LABS, EXTERNAL_RESOURCES } from '@workspace/curriculum';
import { labSheetRows, labSheetsFor } from '../labSheets.ts';

const sim = (id: string, lessonId: string, subjectId: string, gradeId = 'grade-10'): ExternalResource => ({
  id, lessonIds: [lessonId], gradeIds: [gradeId], subjectId,
  kind: 'simulation', titleEn: id, titleAr: `محاكاة ${id}`, provider: 'phet', license: 'CC-BY-NC-4.0',
  licenseUrl: 'https://phet.colorado.edu/en/licensing', sourceUrl: `https://phet.colorado.edu/sims/${id}`,
  attribution: 'PhET Interactive Simulations', licenseCheckedAt: '2026-10-06', authority: 'third-party',
});
const sheet = (lessonId: string, resourceId: string, review?: { by: string; at: string }): VirtualLabSheet => ({
  lessonId, resourceId, aimAr: 'هدف', predict: ['ت'], procedure: ['خ'], observe: ['ل'], explain: ['ف'],
  teacherKey: { predict: ['ج'], observe: ['ج'], explain: ['ج'] },
  ...(review ? { reviewedBy: review.by, reviewedAt: review.at } : {}),
});

const RESOURCES = [
  sim('chem-a', 'kbl-chem-s1-nccd-u1_lab', 'chemistry'),
  sim('phys-a', 'kbl-phys-s1-nccd-u1_lab', 'physics'),
];
const LABS = [
  sheet('kbl-chem-s1-nccd-u1_lab', 'chem-a', { by: 'أ. معلم', at: '2026-11-20' }),
  sheet('kbl-phys-s1-nccd-u1_lab', 'phys-a'),
  sheet('kbl-chem-s1-nccd-u9_lab', 'gone'),
];

describe('labSheetRows', () => {
  it('joins each sheet with its simulation and drops one whose simulation is missing', () => {
    const rows = labSheetRows(LABS, RESOURCES);
    assert.deepEqual(rows.map(r => r.lessonId), ['kbl-chem-s1-nccd-u1_lab', 'kbl-phys-s1-nccd-u1_lab']);
    assert.equal(rows[0].simTitleAr, 'محاكاة chem-a');
    assert.equal(rows[0].simUrl, 'https://phet.colorado.edu/sims/chem-a');
    assert.deepEqual(rows[0].gradeIds, ['grade-10']);
    assert.equal(rows[0].subjectId, 'chemistry');
    assert.equal(rows[0].reviewedBy, 'أ. معلم');
    assert.equal(rows[1].reviewedAt, undefined);
  });
  it('covers every shipped sheet', () => {
    assert.equal(labSheetRows(VIRTUAL_LABS, EXTERNAL_RESOURCES).length, VIRTUAL_LABS.length);
  });
});

describe('labSheetsFor', () => {
  const rows = labSheetRows(LABS, RESOURCES);
  it('shows only reviewed sheets outside a dev build', () => {
    assert.deepEqual(labSheetsFor(rows, { gradeId: null, subjectId: null, dev: false }).map(r => r.resourceId), ['chem-a']);
  });
  it('shows drafts too in a dev build', () => {
    assert.equal(labSheetsFor(rows, { gradeId: null, subjectId: null, dev: true }).length, 2);
  });
  it('narrows by grade and subject', () => {
    assert.deepEqual(labSheetsFor(rows, { gradeId: 'grade-10', subjectId: 'physics', dev: true }).map(r => r.resourceId), ['phys-a']);
    assert.deepEqual(labSheetsFor(rows, { gradeId: 'grade-9', subjectId: null, dev: true }), []);
  });
  it('shows nothing in production today: no shipped sheet is reviewed yet', () => {
    // When a review is recorded this fails on purpose — update it in that PR.
    assert.deepEqual(labSheetsFor(labSheetRows(VIRTUAL_LABS, EXTERNAL_RESOURCES), { gradeId: null, subjectId: null, dev: false }), []);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labSheets.test.ts`
Expected: FAIL — cannot find module `../labSheets.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/labSheets.ts`:

```ts
/**
 * The virtual-lab sheets as rows: each sheet with the simulation it is written
 * against, for the admin review screen and the Science Lab. Pure, so
 * `node --test` can load it.
 *
 * Release is decided the same way `releasedVirtualLab` decides it — a sheet
 * with a recorded review, or any sheet in a dev build — so the Lab never lists
 * a sheet the lesson page would then refuse to show.
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §5.
 */
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';

export type LabSheetRow = {
  lessonId: string;
  resourceId: string;
  simTitleAr: string;
  simUrl: string;
  gradeIds: readonly string[];
  subjectId: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

/** Every sheet whose simulation is in the catalog, in sheet order. */
export function labSheetRows(labs: readonly VirtualLabSheet[], resources: readonly ExternalResource[]): LabSheetRow[] {
  const out: LabSheetRow[] = [];
  for (const l of labs) {
    const r = resources.find(x => x.id === l.resourceId);
    if (!r) continue; // validateVirtualLabs reports it; a row with no simulation has nothing to open.
    out.push({
      lessonId: l.lessonId,
      resourceId: r.id,
      simTitleAr: r.titleAr,
      simUrl: r.sourceUrl,
      gradeIds: r.gradeIds,
      subjectId: r.subjectId,
      ...(l.reviewedBy ? { reviewedBy: l.reviewedBy } : {}),
      ...(l.reviewedAt ? { reviewedAt: l.reviewedAt } : {}),
    });
  }
  return out;
}

/** The sheets the Lab lists for a grade and subject (`null` = all): released ones, or every one in a dev build. */
export function labSheetsFor(
  rows: readonly LabSheetRow[],
  f: { gradeId: string | null; subjectId: string | null; dev: boolean },
): LabSheetRow[] {
  return rows.filter(
    r =>
      (f.dev || !!r.reviewedAt) &&
      (f.gradeId === null || r.gradeIds.includes(f.gradeId)) &&
      (f.subjectId === null || r.subjectId === f.subjectId),
  );
}
```

- [ ] **Step 4: Run them to see them pass**

Run the same command. Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labSheets.ts artifacts/mobile/services/__tests__/labSheets.test.ts
git commit -m "feat(virtual-lab): sheets as rows with their simulation, filtered for the Lab"
```

---

### Task 3: The admin review screen

**Files:**
- Modify: `artifacts/mobile/components/ui/VirtualLabCard.tsx`
- Create: `artifacts/mobile/app/admin/virtual-labs.tsx`
- Modify: `artifacts/mobile/app/admin/dashboard.tsx`

**Interfaces:**
- Consumes: `labSheetRows` (Task 2); `VIRTUAL_LABS`, `EXTERNAL_RESOURCES` from `@workspace/curriculum`; `getLessonById` from `@/services/knowledgeBase`; `openExternal` from `@/services/externalLinks`; `useAuth` from `@/context/AuthContext`; `BackButton`, `goBack` as in `app/admin/artifact-reports.tsx`.
- Produces: route `/admin/virtual-labs`; `VirtualLabCard` prop `preview?: boolean`.

- [ ] **Step 1: `VirtualLabCard` gains `preview`**

In `components/ui/VirtualLabCard.tsx`, extend `Props`:

```ts
type Props = {
  lessonId: string;
  /** The subject colour the rest of the lesson page is themed with. */
  accent: string;
  /**
   * The admin review screen: show the sheet even before a review is recorded,
   * exactly as a dev build does. Nothing else may set this.
   */
  preview?: boolean;
};
```

change the signature to `export function VirtualLabCard({ lessonId, accent, preview = false }: Props) {`, and change

```ts
  const lab = useMemo(() => virtualLabFor(lessonId, { dev: __DEV__ }), [lessonId]);
```

to

```ts
  const lab = useMemo(() => virtualLabFor(lessonId, { dev: __DEV__ || preview }), [lessonId, preview]);
```

In the same file, where `trackEvent('virtual_lab_opened', { lessonId, surface: 'lesson' })` is called, use `surface: preview ? 'admin-review' : 'lesson'` so review clicks do not count as teacher use. Change nothing else.

- [ ] **Step 2: The screen**

Create `artifacts/mobile/app/admin/virtual-labs.tsx`:

```tsx
/**
 * Virtual-lab review — where a science teacher, sitting with an admin, reads
 * each predict–observe–explain sheet against its running simulation before it
 * is released. system_admin only, like admin/artifact-reports.tsx.
 *
 * Read-only on purpose: a review is recorded as a code change (`reviewedBy`,
 * `reviewedAt` in lib/curriculum/src/virtualLabs.ts), because nothing but a
 * real review may release a sheet. The checklist is docs/virtual-lab-review.md.
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §5.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EXTERNAL_RESOURCES, VIRTUAL_LABS } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { goBack } from '@/services/navigation';
import { openExternal } from '@/services/externalLinks';
import { getLessonById } from '@/services/knowledgeBase';
import { labSheetRows } from '@/services/labSheets';
import { BackButton } from '@/components/ui/BackButton';
import { VirtualLabCard } from '@/components/ui/VirtualLabCard';

const ACCENT = '#4F46E5';
const ADMIN_ROLES = ['system_admin'];
const ROWS = labSheetRows(VIRTUAL_LABS, EXTERNAL_RESOURCES);
const PARTS = [
  ['predict', 'أتوقّع', 'Predict'],
  ['observe', 'ألاحظ', 'Observe'],
  ['explain', 'أفسّر', 'Explain'],
] as const;

export default function VirtualLabReviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const ar = lang === 'ar';
  const align = isRTL ? 'right' : 'left';
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const [open, setOpen] = useState<string | null>(null);
  const sheets = useMemo(() => new Map(VIRTUAL_LABS.map(l => [l.lessonId, l])), []);

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {ar ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => goBack()} hitSlop={10} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'رجوع' : 'Go back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: ACCENT }]}>
        <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} />
        <Text style={[styles.title, { textAlign: align }]}>{ar ? 'مراجعة المختبرات الافتراضية' : 'Virtual-lab review'}</Text>
        <Text style={[styles.subtitle, { textAlign: align }]}>
          {ar
            ? 'اقرأ كل ورقة مع المحاكاة مفتوحة بجانبها، وفق docs/virtual-lab-review.md. تُسجَّل المراجعة في الكود، ولا شيء هنا يحفظ أو ينشر.'
            : 'Read each sheet beside its running simulation, per docs/virtual-lab-review.md. A review is recorded in code; nothing here saves or releases.'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {ROWS.map(row => {
          const lesson = getLessonById(row.lessonId);
          const sheet = sheets.get(row.lessonId)!;
          const expanded = open === row.lessonId;
          return (
            <View key={row.lessonId} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
                accessibilityRole="button"
                aria-expanded={expanded}
                onPress={() => setOpen(expanded ? null : row.lessonId)}
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
              >
                <Ionicons
                  name={row.reviewedAt ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={row.reviewedAt ? colors.success : colors.mutedForeground}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }}>
                    {lesson ? (ar ? lesson.titleAr : lesson.titleEn) : row.lessonId}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                    {row.simTitleAr} ·{' '}
                    {row.reviewedAt
                      ? (ar ? `راجعها ${row.reviewedBy} في ${row.reviewedAt}` : `Reviewed by ${row.reviewedBy} on ${row.reviewedAt}`)
                      : (ar ? 'لم تُراجَع' : 'Not reviewed')}
                  </Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
              </Pressable>

              {expanded ? (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void openExternal(row.simUrl)}
                    style={[styles.simButton, { backgroundColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                  >
                    <Ionicons name="open-outline" size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'افتح المحاكاة' : 'Open the simulation'}</Text>
                  </Pressable>
                  <Text style={[styles.h, { color: colors.foreground, textAlign: align }]}>{ar ? 'الهدف' : 'Aim'}</Text>
                  <Text style={[styles.body, { color: colors.foreground, textAlign: align }]}>{sheet.aimAr}</Text>
                  <Text style={[styles.h, { color: colors.foreground, textAlign: align }]}>{ar ? 'الخطوات' : 'Procedure'}</Text>
                  {sheet.procedure.map((s, i) => (
                    <Text key={`p${i}`} style={[styles.body, { color: colors.foreground, textAlign: align }]}>{`${i + 1}. ${s}`}</Text>
                  ))}
                  {PARTS.map(([part, arTitle, enTitle]) => (
                    <View key={part} style={{ gap: 6 }}>
                      <Text style={[styles.h, { color: colors.foreground, textAlign: align }]}>{ar ? arTitle : enTitle}</Text>
                      {sheet[part].map((q, i) => (
                        <View key={i} style={{ gap: 2 }}>
                          <Text style={[styles.body, { color: colors.foreground, textAlign: align }]}>{`${i + 1}. ${q}`}</Text>
                          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: align }]}>
                            {(ar ? 'الإجابة: ' : 'Key: ') + sheet.teacherKey[part][i]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                  <Text style={[styles.h, { color: colors.foreground, textAlign: align }]}>
                    {ar ? 'كما يراها المعلم' : 'As a teacher gets it'}
                  </Text>
                  <VirtualLabCard lessonId={row.lessonId} accent={ACCENT} preview />
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  title: { color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20 },
  subtitle: { color: '#fff', fontFamily: 'Almarai_400Regular', fontSize: 13, opacity: 0.9 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  simButton: { alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, minHeight: 44, paddingHorizontal: 16 },
  h: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 },
  body: { fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22 },
});
```

`colors.success` exists in both palettes (`constants/colors.ts`: `#067647` light, `#34D399` dark). `BackButton` is used with `color` and `style` exactly as in `artifact-reports.tsx`.

- [ ] **Step 3: Link it from the admin dashboard**

In `app/admin/dashboard.tsx`, add to the link list after the `/admin/ai-costs` entry:

```tsx
                ['/admin/virtual-labs', 'flask-outline', 'مراجعة المختبرات الافتراضية', 'Virtual-lab review'],
```

and change the filter

```tsx
              ] as const).filter(([href]) => href !== '/admin/schools' || user?.role === 'system_admin').map(
```

to

```tsx
              ] as const).filter(([href]) => (href !== '/admin/schools' && href !== '/admin/virtual-labs') || user?.role === 'system_admin').map(
```

(keep the rest of that line as it is).

- [ ] **Step 4: Typecheck and the mobile suite**

Run: root `pnpm run typecheck`, then `cd artifacts/mobile && pnpm test` (prints nothing for minutes; not a hang).
Expected: PASS — including `iconSystem.test.ts` (sizes 20/24/32 only) and `routeGating.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/ui/VirtualLabCard.tsx artifacts/mobile/app/admin/virtual-labs.tsx artifacts/mobile/app/admin/dashboard.tsx
git diff --cached --stat
git commit -m "feat(virtual-lab): admin screen to review each sheet as teachers will get it"
```

---

### Task 4: «تجارب افتراضية» in the Science Lab

**Files:**
- Modify: `artifacts/mobile/app/curriculum/lab/index.tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: `labSheetRows`, `labSheetsFor`, `LabSheetRow` (Task 2); the screen's existing `gradeId`, `subjectId` and `kind` values (PRs 1–2); `getLessonById`.

- [ ] **Step 1: Translation keys**

In `services/i18n.ts`, `ar` block, beside `labAllGrades`:

```ts
    labVirtualSection: 'تجارب افتراضية',
    labVirtualDraft: 'مسودة لم تُراجَع',
```

`en` block, beside `labAllGrades`:

```ts
    labVirtualSection: 'Virtual labs',
    labVirtualDraft: 'Draft, not reviewed',
```

- [ ] **Step 2: The section**

In `app/curriculum/lab/index.tsx`:

1. Imports — add:
```ts
import { EXTERNAL_RESOURCES, VIRTUAL_LABS } from '@workspace/curriculum';
import { labSheetRows, labSheetsFor, type LabSheetRow } from '@/services/labSheets';
```
(If the file already imports from `@workspace/curriculum`, add the two names to that import instead of a second line.)
2. Module constant, after `LAB_GRADE_IDS`:
```ts
const SHEET_ROWS = labSheetRows(VIRTUAL_LABS, EXTERNAL_RESOURCES);
```
3. A row component, after `ItemRow`:
```tsx
function SheetRow({ row, colors, isRTL, lang, t }: { row: LabSheetRow; colors: Colors; isRTL: boolean; lang: string; t: TFn }) {
  const surface = useSurface();
  const lesson = getLessonById(row.lessonId);
  const lessonTitle = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : '';
  return (
    <PressableScale
      onPress={() => {
        Haptics.selectionAsync();
        router.push({ pathname: '/curriculum/lesson-detail', params: { lessonId: row.lessonId } } as never);
      }}
      accessibilityRole="button"
      style={[styles.row, surface, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="beaker-outline" size={24} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'ReadexPro_600SemiBold' }]}>
          {lessonTitle || row.simTitleAr}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}>
          {row.simTitleAr}
          {row.reviewedAt ? '' : ` · ${t('labVirtualDraft')}`}
        </Text>
      </View>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
    </PressableScale>
  );
}
```
4. In `LabShelfScreen`, after `shown` is computed:
```ts
  // Sheets are not a lab-item type, so a type filter hides them; drafts show in dev builds only, as on the lesson page.
  const sheets = kind === null ? labSheetsFor(SHEET_ROWS, { gradeId, subjectId, dev: __DEV__ }) : [];
```
5. In the JSX, after the list block (the `shown.length === 0 ? … : <CornerGrid>…</CornerGrid>` expression) and before `</CornerFrame>`:
```tsx
      {sheets.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'ReadexPro_600SemiBold' }]}>
            {t('labVirtualSection')}
          </Text>
          <CornerGrid>
            {sheets.map(row => <SheetRow key={row.lessonId} row={row} colors={colors} isRTL={isRTL} lang={lang} t={t} />)}
          </CornerGrid>
        </>
      ) : null}
```
6. In `styles`, add `section: { fontSize: 16, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },`.

- [ ] **Step 3: Typecheck, suite, browser**

Run: root `pnpm run typecheck`; `cd artifacts/mobile && pnpm test`. Expected: PASS (`cornerTheme.test.ts` — no `palette`; `iconSystem.test.ts` — sizes 20/24).

Browser (`pnpm run dev:mobile:web` — a dev build, so drafts show; recipe as in the PR 1 plan, Task 4, with a throwaway Postgres; never read `.env`):
- as a Grade 10 teacher, the Lab shows «تجارب افتراضية» with six rows, each tagged «مسودة لم تُراجَع»; choosing «الكيمياء» leaves four, «الفيزياء» two, and choosing a type («قانون») hides the section;
- a row opens the lab lesson's page with the sheet card on it;
- as a `system_admin` (set the role on the throwaway user in the throwaway database), the dashboard shows «مراجعة المختبرات الافتراضية»; the screen lists six sheets «لم تُراجَع», expands to aim, steps, questions with keys, the simulation button, and the teacher card with its export; as a teacher, `/admin/virtual-labs` shows the lock screen.
Screenshots (deviceScaleFactor 2) to the scratchpad: the Lab section (phone, light) and one expanded sheet on the admin screen (desktop, dark). Stop every server and the cluster.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/app/curriculum/lab/index.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(lab): released virtual-lab sheets listed in the Science Lab"
```

---

### Task 5: The reviewer's checklist, status log, checks

**Files:**
- Create: `docs/virtual-lab-review.md`
- Modify: `docs/status-log.md`, `docs/superpowers/specs/2026-11-13-lab-expansion-design.md`

- [ ] **Step 1: The checklist**

Create `docs/virtual-lab-review.md`:

```markdown
# مراجعة أوراق المختبر الافتراضي — Virtual-lab sheet review

For a chemistry or physics teacher reviewing one predict–observe–explain sheet before teachers can use it.
Open **Admin → مراجعة المختبرات الافتراضية** (`/admin/virtual-labs`), expand the sheet, and open its
simulation beside it. Go through the sheet as a student would, then through the key as the teacher would.

## Before you start
- Use the Arabic version of the simulation (the link opens it). Where PhET has no Arabic label for a control,
  the sheet quotes the English label — check that this is what the screen shows.
- One sheet per sitting. Note anything wrong next to its line number below.

## The checklist
1. **الهدف (Aim):** says what this lab lesson in the Grade 10 book asks for, in correct Arabic.
2. **الخطوات (Procedure):** every step names a control, menu or reading that exists in the simulation, by
   the name the student sees on screen; doing the steps in order is possible and reaches the observation.
3. **أتوقّع (Predict):** each question can be answered before using the simulation, and none gives the answer away.
4. **ألاحظ (Observe):** each question is about something the simulation actually shows when the steps are
   followed — numbers, colours, spectra, shapes — and the key states what is really on the screen.
5. **أفسّر (Explain):** each question connects the observation to the lesson's concept, and the key's
   explanation matches the book (terms, symbols, units).
6. **The key:** one answer per question, in order; numbers and units correct; nothing a Grade 10 student
   could not be expected to write.
7. **Arabic:** grammar, spelling and terminology as in the Ministry book; numbers and units written the
   way the book writes them.
8. **Safety and accuracy:** nothing on the sheet is scientifically wrong, even as a simplification.

## Recording the review
If every item holds (after fixes, if any), tell the developer; they add to that sheet in
`lib/curriculum/src/virtualLabs.ts`:

    reviewedBy: '<your name>, <your subject> teacher',
    reviewedAt: '<the date of the review, YYYY-MM-DD>',

and merge it. Only then does the sheet appear for teachers, on the lesson page and in the Lab's
«تجارب افتراضية». A fix to a sheet's text goes in the same pull request. `validateVirtualLabs` refuses a
reviewer without a date, a date without a reviewer, and a date that is not a real past day.
```

- [ ] **Step 2: Status log and spec**

At the top of `docs/status-log.md`, directly under the header paragraph:

```markdown
## Virtual-lab sheets: a review screen, a checklist, and a Lab section for released sheets — <date>

PR 3 of `docs/superpowers/specs/2026-11-13-lab-expansion-design.md`.

**What changed.**
- `/admin/virtual-labs` (system_admin only): each of the six sheets with its review state, aim, steps,
  questions with the key, a button to its PhET simulation, and the sheet card exactly as a teacher gets it
  (`VirtualLabCard` with `preview`). Read-only: a review is still recorded in `virtualLabs.ts`.
- `docs/virtual-lab-review.md`: the reviewer's checklist.
- `validateVirtualLabs` refuses a `reviewedAt` that is not a real `YYYY-MM-DD` day or is in the future.
- The Science Lab lists released sheets under «تجارب افتراضية» for the chosen grade and subject (hidden
  when a type is chosen); a row opens the lab lesson's page. Drafts show in dev builds only, as on the lesson page.

**Verified.** <root typecheck; curriculum test (name any environmental failure) and verify; mobile test
(N tests, 0 failing); api-server build + test; the browser checks of Task 4 and what they showed>.

**Not done.** No sheet is reviewed yet, so teachers see no change in production until someone records a
review. The six physics tools are PR 4–5.
```

Replace `<date>` with `TZ=Asia/Amman date +%F`, and the angle-bracket **Verified** text with what actually ran (counts, and anything that could not run and why). In the spec, change the status line to `Status: written 2026-11-13. PRs 1–3 built (grade filter and media; formula cards and type chips; sheet review); PRs 4–5 not started.` — adjust the wording to what is merged by then.

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

Expected: all PASS; report anything that cannot run here rather than installing system packages.

- [ ] **Step 4: Commit**

```bash
git add docs/virtual-lab-review.md docs/status-log.md docs/superpowers/specs/2026-11-13-lab-expansion-design.md
git diff --cached --stat
git commit -m "docs(virtual-lab): reviewer checklist, status log and spec status"
```

Then push and open a new PR «Virtual-lab sheets: review screen, checklist, and a Lab section», with: what changed, the two screenshots, «No ما الجديد entry: nothing changes for teachers until a sheet is reviewed (the Lab section is empty in production; the screen is admin-only)», the next step (a chemistry and a physics teacher review the six sheets with the checklist), and «Deploy: web bundle and API (lib/ changed); no migration, no native change».
