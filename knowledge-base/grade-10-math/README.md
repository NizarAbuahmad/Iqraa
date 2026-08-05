# Grade 10 Mathematics — support pack

Teacher worksheets, quizzes, summaries, and remedial PDFs imported for Iqra.

## Layout

| Path | Role |
|------|------|
| `support-pdfs/` | Binary PDFs (gitignored — too large for the repo) |
| `artifacts/mobile/data/g10_math_support_resources.json` | Catalog used by the app (committed) |
| `artifacts/mobile/services/mathSupportResources.ts` | Search + chat grounding |

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
