# Grade 10 Mathematics — support pack

Teacher worksheets, quizzes, summaries, and remedial PDFs imported for Iqra.

## Layout

| Path | Role |
|------|------|
| `support-pdfs/` | Binary PDFs (gitignored — too large for the repo) |
| `lib/curriculum/src/data/g10_sources.json` | The single registry — every G10 source, its scope and its use policy (committed) |
| `lib/curriculum/src/bank.ts` | Bank queries + the quotable / reference-only rule |
| `artifacts/mobile/services/mathSupportResources.ts` | The app's search over the bank |

## How chat uses this

When a teacher asks about a unit (e.g. الدائرة, الأسس والمعادلات), Iqra lists matching support titles so they can attach the PDF for a tighter خطة درس / ورقة عمل.

Demo Mode does **not** embed full PDF text in the app bundle. Attach the file in chat (or paste text) for document-grounded generation.

## Re-import

If you add more PDFs to the Calude folder:

```powershell
# From repo root — regenerate catalog + copy unique PDFs
python scripts/import_g10_math_support.py
```

(Or re-run the import snippet used in the session that created this pack.)

## Stats (current)

- Unique PDFs: **38** (from 45 source files; `(1)` duplicates collapsed)
- Types: worksheets, quizzes, answer keys, summaries, remedial/foundations

## Note, 2026-08-25

The per-subject catalog this pack used to own
(`artifacts/mobile/data/g10_math_support_resources.json`) is gone. It described
the same PDFs as `lib/curriculum/src/data/g10_sources.json` under a second id
space and a second type vocabulary, and had drifted; the manifest absorbed its
`unitTags`, `authorAr` and `keywords`. `scripts/import_g10_math_support.py` still
writes the old path and has not been rewritten — do not re-run it without
pointing it at the manifest first, or it will recreate the split.
