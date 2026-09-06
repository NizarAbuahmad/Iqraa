# Unit tag rules

One file per grade + subject: `g<grade>-<subject>.json`.

```json
{
  "grade": 9,
  "subject": "math",
  "rules": [
    { "pattern": "الأسس والمعادلات|أنظمة المعادلات", "tags": ["s1-u1"] },
    { "pattern": "الفصل الثاني", "tags": ["s2"] }
  ]
}
```

`pattern` is a Python regex matched against the filename stem; `tags` are the
unit tags the app searches by. A file matching no rule is catalogued under
`g<grade>-<subject>-general` and reported by the importer, never dropped.

Tags are usually written after reading the teacher guide, since that is where
the real unit names live. Adding rules later only requires re-running the
importer — the PDFs are already in place.

**Keep tags subject-scoped.** Bare `s1-u1` means *mathematics* unit 1; a
financial-literacy unit that emitted the same tag collided with every maths
unit-1 resource and attached three maths files to a finance lesson. See
`STATUS.md`, 2026-08-21.

## Missing rules are refused, not silently applied

`import_support_pdfs.py --root` runs over every grade at once. If a grade's
rules file is absent, every one of its resources falls back to
`g<grade>-<subject>-general` — which, for a grade whose catalog was already
tagged, would quietly erase the tags and take the whole subject out of
unit-scoped search. The importer therefore compares against the catalog on
disk and **refuses to write a catalog with fewer unit-tagged resources than
the one it would replace**, exiting non-zero. Add the rules file, or pass
`--force` if losing the tags is actually what you want.

`g10-math.json` exists for exactly this reason: those rules used to live
inside `scripts/import_g10_math_support.py`, so the generic importer would
have flattened all 37 of that catalog's tags. Replayed against the shipped
catalog, the extracted rules reproduce all 38 types and all 38 tag sets
exactly. Grade 10 chemistry still has its rules inside
`scripts/import_g10_chem_support.py` — it writes a differently-named catalog
(`g10_chem_…`, not `g10_chemistry_…`) with a different fallback tag, so it has
not been folded in yet.
