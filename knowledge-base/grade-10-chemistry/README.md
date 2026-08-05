# Grade 10 Chemistry — support pack

Official books (both semesters) + teacher worksheets, quizzes, dossiers, and summaries.

## Layout

| Path | Role |
|------|------|
| `support-pdfs/` | Binary PDFs (gitignored) |
| `artifacts/mobile/data/g10_chem_support_resources.json` | Catalog used by the app |
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
