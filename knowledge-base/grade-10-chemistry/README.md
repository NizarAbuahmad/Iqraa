# Grade 10 Chemistry — support pack

Official books (both semesters) + teacher worksheets, quizzes, dossiers, and summaries.

## Layout

| Path | Role |
|------|------|
| `support-pdfs/` | Binary PDFs (gitignored) |
| `lib/curriculum/src/data/g10_sources.json` | The single registry — every G10 source, its scope and its use policy (committed) |
| `artifacts/mobile/services/mathSupportResources.ts` | Shared search (math + chemistry) |

## Re-import

```powershell
$env:PYTHONIOENCODING='utf-8'
python scripts/import_g10_chem_support.py
```

## Notes

- `School Brochure updated.pdf` is skipped (not curriculum content).
- Duplicate `(1)` files are collapsed by content hash.
- Demo Mode lists matching titles in chat; attach a PDF for deeper grounding.

## Note, 2026-08-25

The per-subject catalog this pack used to own
(`artifacts/mobile/data/g10_chem_support_resources.json`) is gone. It described
the same PDFs as `lib/curriculum/src/data/g10_sources.json` under a second id
space and a second type vocabulary, and had drifted; the manifest absorbed its
`unitTags`, `authorAr` and `keywords`. `scripts/import_g10_chem_support.py` still
writes the old path and has not been rewritten — do not re-run it without
pointing it at the manifest first, or it will recreate the split.
