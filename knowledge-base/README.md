# Knowledge base — source PDFs

Teacher guides, student books, worksheets, answer keys, exams and remedial
material, per grade and subject.

**PDFs are gitignored** (`knowledge-base/**/*.pdf`). A single teacher guide is
~45 MB; the repo holds the *catalog*, not the binaries.

| Path | Committed? | Role |
|---|---|---|
| `knowledge-base/grade-<n>-<subject>/support-pdfs/` | no | the PDFs themselves |
| `artifacts/mobile/data/g<n>_<subject>_support_resources.json` | yes | catalog the app searches |
| `lib/curriculum/src/data/iqra_curriculum_*.json` | yes | units, lessons, objectives |

## Importing a new pack

Run on the machine holding the PDFs:

```bash
python scripts/import_support_pdfs.py --grade 9 --subject math \
    --src "C:\...\Knowledge Base\9th grade\Math" --dry-run   # look first
python scripts/import_support_pdfs.py --grade 9 --subject math --src "..."
```

It collapses Windows `(1)` duplicates by content hash, infers a type from the
Arabic filename, and reports how many files it could not tag to a unit.

## The two halves, and why they are different jobs

**Support catalog** — needs only *filenames*. The importer handles it, and a
pack is usable the moment it lands.

**Curriculum data** — needs the *contents* of the **دليل المعلم**: unit and
lesson titles, official outcomes (النتاجات), period counts, prior knowledge.
This is what `lib/curriculum/src/data/*.json` holds, what
`pnpm --filter @workspace/curriculum run verify` checks, and what decides
whether a lesson generates grounded or generic.

Grade 10 maths is the only subject where this was done from a teacher guide,
and it is the only one whose lessons carry rules and worked examples. That is
the whole difference. **Send the دليل المعلم first.**

### Getting a teacher guide's content out of a 45 MB PDF

Only three page *types* matter — «مُخطَّط الوحدة», the vertical-alignment page,
and «نتاجات الدرس». Everything else in a guide is the student book reproduced
with notes around it.

```bash
pip install pypdf
python scripts/extract_curriculum_pages.py --grade 9 --subject math \
    --src "C:\...\9th grade\Math"
```

Writes a few KB of markdown per guide to `curriculum-extracts/` — **committed**,
unlike the PDFs. On the Grade 9 unit-4 guide that is 5 pages out of 63, 25 KB
out of 25 MB. It also counts pages whose fonts do not map back to Unicode and
says so in the header; those need a human to read the PDF, not a parser.

## Unit tags

`scripts/unit_rules/g<n>-<subject>.json` maps a filename regex to unit tags:

```json
{ "rules": [ { "pattern": "الأسس والمعادلات|أنظمة المعادلات", "tags": ["s1-u1"] } ] }
```

Optional and usually written *after* the teacher guide is read, since that is
where the unit names come from. Untagged files are still catalogued — the
importer prints the count rather than dropping them silently — but they will
not surface in unit-scoped search until a rule exists.
