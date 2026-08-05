# Curriculum Quality Validation (CQV) Reports

Internal Teacher Acceptance Testing for **Jordan Curriculum → Grade 10 → Mathematics → Semester 1 & 2**.

This folder is **not** part of the Investor MVP product UI.

## Quick start

```powershell
# 1) Scaffold blank Markdown templates (skips existing files)
pnpm --filter @workspace/mobile run cqv:scaffold

# 2) Run the app
pnpm run dev:api
pnpm run dev:mobile:web

# 3) Sign in, then open the internal CQV console
# http://localhost:8081/dev/cqv
```

Enable explicitly in production-like builds with:

```
EXPO_PUBLIC_ENABLE_CQV=1
```

(`__DEV__` builds enable CQV automatically.)

## Phase 2.1 — Batch TAT workflow

### Test Entire Lesson
1. Open a lesson in `/dev/cqv`
2. Tap **Test Entire Lesson**
3. All 8 artifacts generate in Demo Mode (saved to workspace + CQV storage)
4. Score each artifact (Pass/Fail + 1–10 dimensions)
5. Export MD / checklist as needed

### Progress tracking (per lesson)
```
✓ Lesson Plan
✓ Worksheet
✓ Quiz
○ Homework
○ Assessment
Overall: 5 / 8 Complete
```

- **✓** = reviewed (verdict + all scores entered)
- **◆** = generated, not yet reviewed
- **○** = not started

### Curriculum progress + Quality dashboard
The CQV index shows:
- Semester validated / completed / % completion
- Average scores per dimension (highlights below configured targets)
- Lessons blocked count per metric
- Improvement queue (attention / lowest trust / alignment / quality)

Export with **Export progress MD**.

### Quality thresholds

Configured in `artifacts/mobile/services/cqv/thresholds.ts` (edit there only):

| Dimension | Default |
|-----------|---------|
| Educational Quality | ≥ 8.5 |
| Arabic Language | ≥ 9.0 |
| Curriculum Alignment | ≥ 9.0 |
| Teacher Usability | ≥ 8.5 |
| Formatting | ≥ 9.0 |
| Teacher Trust | ≥ 9.0 |

### Validated criteria
A lesson is **Validated** only when:
1. All 8 artifacts are reviewed
2. Every required score is entered
3. Every score meets or exceeds its configured threshold
4. No artifact is marked Fail

## Evaluating a new lesson later

When a new Grade 10 Math lesson is added to `curriculumData.ts` under an MVP book:

1. Re-run `pnpm --filter @workspace/mobile run cqv:scaffold`
2. It appears automatically in `/dev/cqv`
3. Use **Test Entire Lesson** → score → export

Do **not** add other grades or subjects to CQV without an explicit product decision.

## Example exports

See `examples/` for sample dashboard / progress report Markdown shapes.
