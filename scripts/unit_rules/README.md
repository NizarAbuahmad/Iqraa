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
