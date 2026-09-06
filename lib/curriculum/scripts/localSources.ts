/**
 * Which source each local file is, stated rather than inferred.
 *
 * Hand-authored for the same reason `g10_sources.json` is: half these
 * filenames carry a machine-appended timestamp and one reads
 * "mather exccersie book". A parser clever enough for that is a parser nobody
 * could trust.
 *
 * Split out of `extract-text.ts` into its own module (no logic, no top-level
 * `await`) so `upload-to-r2.ts` can import just this map without triggering
 * `extract-text.ts`'s own `await main()` as a side effect of the import.
 *
 * Byte counts are checked against the manifest at run time and a mismatch is
 * recorded, not silently accepted — see the note on `math-s1-student-book`.
 */
export const LOCAL_FILES: Record<string, string> = {
  // ⚠ The two student books are mapped ACROSS their filenames, on purpose.
  //
  // `10th_grade,_math,_1st_semester_….pdf` opens «الوحدةُ 5 الاقتراناتُ» and
  // carries unit 7 المتجهات — catalog **Semester 2**. `…,_2nd_semester_….pdf`
  // opens «الوحدةُ 1 المعادلاتُ» and carries unit 3 حساب المثلثات — catalog
  // **Semester 1**. The files are swapped relative to their names, and the
  // manifest inherited the swap when its entries were written from a Drive
  // listing rather than from the documents.
  //
  // Mapped by content, because that is what makes a citation true: a passage
  // offered for الدائرة must come from the book that contains الدائرة. Before
  // this was corrected, retrieval for the circle unit returned a page about
  // vectors and looked like a scoring problem.
  //
  // The teacher guides are *not* affected — the S2 guide really does hold unit
  // 6 المشتقات — so this is the two student books only. It is also very likely
  // true of the Drive copies and the `bytes` recorded against these two ids;
  // see STATUS.md. `bytesDifferFromManifest` fires on both as a result.
  'math-s1-student-book': 'attached_assets/10th_grade,_math,_2nd_semester_1785147978008.pdf',
  'math-s2-student-book': 'attached_assets/10th_grade,_math,_1st_semester_1785071530816.pdf',
  'chem-s1-student-book': 'attached_assets/10th_grade,_alchamy1st_semester_1785071530814.pdf',
  'math-s1-exercise-book': 'attached_assets/2026_MT10_WB1__10th_grade,_math_excersice_book,_semster_one_1785147998882.pdf',
  'math-s2-exercise-book': 'attached_assets/MA_10_WB2_6_11_2025-mather_exccersie_book,_semster_2_1785147998882.pdf',
  'math-s2-teacher-guide': 'attached_assets/Book10_2_Proof3_WEB-teacher_guiede,_10th_grade,_semster_two_1785147998881.pdf',
  // math-s1-teacher-guide is a Git-LFS pointer in this checkout (58 MB
  // unpulled). It is the richest single source — it supplied every math S1
  // objective — so it is named here to be picked up automatically once
  // `git lfs pull` has run, rather than quietly omitted.
  'math-s1-teacher-guide': 'attached_assets/TE010_Book-teacher_guiede,_10th_grade,_semster_one_1785147998881.pdf',

  // The 54 support-pack documents below (out of 60 pending in the
  // manifest) were fetched from the Drive folder the manifest's driveId
  // already pointed at, 2026-08-26 — see STATUS.md. Six remain unfetched:
  // two hit repeated transient MCP session drops, four exceed the 10MB
  // single-call download ceiling of the tool used to fetch them.
  'math-remedial-plan': 'attached_assets/knowledge-base-pending/math-remedial-plan.pdf',
  'math-remedial-part1': 'attached_assets/knowledge-base-pending/math-remedial-part1.pdf',
  'math-remedial-part2': 'attached_assets/knowledge-base-pending/math-remedial-part2.pdf',
  'math-s2-support-worksheets': 'attached_assets/knowledge-base-pending/math-s2-support-worksheets.pdf',
  'math-diagnostic-test': 'attached_assets/knowledge-base-pending/math-diagnostic-test.pdf',
  'math-u2-summary-alkhamayseh': 'attached_assets/knowledge-base-pending/math-u2-summary-alkhamayseh.pdf',
  'math-ws-systems-alhindi': 'attached_assets/knowledge-base-pending/math-ws-systems-alhindi.pdf',
  'math-ws-systems-solved-alkhatib': 'attached_assets/knowledge-base-pending/math-ws-systems-solved-alkhatib.pdf',
  'math-systems-almasri': 'attached_assets/knowledge-base-pending/math-systems-almasri.pdf',
  'math-ws-powers-almasri': 'attached_assets/knowledge-base-pending/math-ws-powers-almasri.pdf',
  'math-ws-polynomials-almasri': 'attached_assets/knowledge-base-pending/math-ws-polynomials-almasri.pdf',
  'math-ws-circle-full-alkhatib': 'attached_assets/knowledge-base-pending/math-ws-circle-full-alkhatib.pdf',
  'math-ws-tangents-alhindi': 'attached_assets/knowledge-base-pending/math-ws-tangents-alhindi.pdf',
  'math-ws-tangent-angle-alhindi': 'attached_assets/knowledge-base-pending/math-ws-tangent-angle-alhindi.pdf',
  'math-ws-cyclic-quad-1-alhindi': 'attached_assets/knowledge-base-pending/math-ws-cyclic-quad-1-alhindi.pdf',
  'math-ws-cyclic-quad-2-alhindi': 'attached_assets/knowledge-base-pending/math-ws-cyclic-quad-2-alhindi.pdf',
  'math-ws-angles-alhindi': 'attached_assets/knowledge-base-pending/math-ws-angles-alhindi.pdf',
  'math-ws-chords-1-alhindi': 'attached_assets/knowledge-base-pending/math-ws-chords-1-alhindi.pdf',
  'math-ws-chords-2-alhindi': 'attached_assets/knowledge-base-pending/math-ws-chords-2-alhindi.pdf',
  'math-mcq-circle-alkhatib': 'attached_assets/knowledge-base-pending/math-mcq-circle-alkhatib.pdf',
  'math-mcq-circle-suggested-alkhatib': 'attached_assets/knowledge-base-pending/math-mcq-circle-suggested-alkhatib.pdf',
  'math-matrices-suggested-alkhatib': 'attached_assets/knowledge-base-pending/math-matrices-suggested-alkhatib.pdf',
  'math-final-alhindi': 'attached_assets/knowledge-base-pending/math-final-alhindi.pdf',
  'math-final-1-alkhatib': 'attached_assets/knowledge-base-pending/math-final-1-alkhatib.pdf',
  'math-final-2-alkhatib': 'attached_assets/knowledge-base-pending/math-final-2-alkhatib.pdf',
  'math-month1-alkhatib': 'attached_assets/knowledge-base-pending/math-month1-alkhatib.pdf',
  'math-month2-alfarakh': 'attached_assets/knowledge-base-pending/math-month2-alfarakh.pdf',
  'math-u6-test-hussein': 'attached_assets/knowledge-base-pending/math-u6-test-hussein.pdf',
  'math-u7-test-hussein': 'attached_assets/knowledge-base-pending/math-u7-test-hussein.pdf',
  'math-foundation-lafi': 'attached_assets/knowledge-base-pending/math-foundation-lafi.pdf',
  'math-foundations-melhem': 'attached_assets/knowledge-base-pending/math-foundations-melhem.pdf',
  'math-geometry-formulas-melhem': 'attached_assets/knowledge-base-pending/math-geometry-formulas-melhem.pdf',
  'chem-s1-activity-book': 'attached_assets/knowledge-base-pending/chem-s1-activity-book.pdf',
  'chem-s2-activity-book': 'attached_assets/knowledge-base-pending/chem-s2-activity-book.pdf',
  'chem-loss-recovery': 'attached_assets/knowledge-base-pending/chem-loss-recovery.pdf',
  'chem-s1-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-pack-sartawi.pdf',
  'chem-s1-u1-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-u1-pack-sartawi.pdf',
  'chem-s1-u2-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-u2-pack-sartawi.pdf',
  'chem-s1-u3-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-u3-pack-sartawi.pdf',
  'chem-s1-pack-almasri': 'attached_assets/knowledge-base-pending/chem-s1-pack-almasri.pdf',
  'chem-s1-summary-shawata': 'attached_assets/knowledge-base-pending/chem-s1-summary-shawata.pdf',
  'chem-s2-pack-sartawi': 'attached_assets/knowledge-base-pending/chem-s2-pack-sartawi.pdf',
  'chem-s2-pack-shawata': 'attached_assets/knowledge-base-pending/chem-s2-pack-shawata.pdf',
  'chem-s2-pack-almasri': 'attached_assets/knowledge-base-pending/chem-s2-pack-almasri.pdf',
  'chem-u4-summary-sartawi': 'attached_assets/knowledge-base-pending/chem-u4-summary-sartawi.pdf',
  'chem-u5-summary-sartawi': 'attached_assets/knowledge-base-pending/chem-u5-summary-sartawi.pdf',
  'chem-s1-question-bank-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-question-bank-sartawi.pdf',
  'chem-s1-mixed-questions-sartawi': 'attached_assets/knowledge-base-pending/chem-s1-mixed-questions-sartawi.pdf',
  'chem-ws-bohr-manhaji': 'attached_assets/knowledge-base-pending/chem-ws-bohr-manhaji.pdf',
  'chem-ws-bohr-tareq': 'attached_assets/knowledge-base-pending/chem-ws-bohr-tareq.pdf',
  'chem-ws-reactions-tareq': 'attached_assets/knowledge-base-pending/chem-ws-reactions-tareq.pdf',
  'chem-ws-planck-almasri': 'attached_assets/knowledge-base-pending/chem-ws-planck-almasri.pdf',
  'chem-u1-test-shawata': 'attached_assets/knowledge-base-pending/chem-u1-test-shawata.pdf',
  'chem-s2-month1-tareq': 'attached_assets/knowledge-base-pending/chem-s2-month1-tareq.pdf',

  // These nine already sat in `knowledge-base/**/support-pdfs/`, which is
  // gitignored (.gitignore:59) — so they were invisible to every audit that
  // walked this map, and were wrongly recorded as never-fetched. They are
  // named here by their real on-disk paths: extraction reads them directly in
  // a checkout that has them, and falls back to R2 as `<sourceId>.pdf` in one
  // that does not. The six `duplicate` files alongside them are deliberately
  // NOT listed — each is an iLovePDF re-compression of a source already
  // mapped above, with downsampled images these page-render extractions need.
  'math-loss-recovery': 'knowledge-base/grade-10-math/support-pdfs/المادة المقررة لتعويض الفاقد التعليمي لمادة الرياضيات الصف العاشر.pdf',
  'math-s1-support-material': 'knowledge-base/grade-10-math/support-pdfs/المادة المساندة لمادة الرياضيات الصف العاشر الفصل الأول.pdf',
  'math-u1-answers-almasri': 'knowledge-base/grade-10-math/support-pdfs/إجابات أول درسين من الوحدة الأولى الرياضيات الصف العاشر أ. أحمد المصري.pdf',
  'math-u1-answers-alkhatib': 'knowledge-base/grade-10-math/support-pdfs/إجابات الوحدة الأولى (الأسس والمعادلات) رياضيات الصف العاشر أ. سلسبيل الخطيب.pdf',
  'math-u2-answers-alkhatib': 'knowledge-base/grade-10-math/support-pdfs/إجابات الوحدة الثانية (الدائرة) رياضيات الصف العاشر أ. سلسبيل الخطيب.pdf',
  'math-u1-summary-alkhamayseh': 'knowledge-base/grade-10-math/support-pdfs/ملخص الوحدة الأولى الاقترانات الرياضيات الصف العاشر أ. رعد الخمايسة.pdf',
  'chem-s2-student-book': 'knowledge-base/grade-10-chemistry/support-pdfs/10th grade, alchamy.2nd semester.pdf',
  'chem-s1-teacher-guide': 'knowledge-base/grade-10-chemistry/support-pdfs/دليل المعلم لمادة الكيمياء الصف العاشر الفصل الأول.pdf',
  'chem-s2-teacher-guide': 'knowledge-base/grade-10-chemistry/support-pdfs/دليل المعلم لمادة الكيمياء الصف العاشر الفصل الثاني.pdf',

  // Grade 10 physics, biology, earth science and Arabic — handed over as a
  // local folder on 2026-09-03, not through Drive, so these carry no driveId.
  // Physics first because it is the subject being built out; the rest are
  // ingested now so the text exists before anyone needs it. Same gitignored
  // support-pdfs/ home as the chemistry set above: read from disk here, from
  // R2 as `<sourceId>.pdf` in a checkout that does not have them.
  'phys-s1-student-book': 'knowledge-base/grade-10-physics/support-pdfs/كتاب الطالب لمادة الفيزياء للصف العاشر الفصل الأول.pdf',
  'phys-s2-student-book': 'knowledge-base/grade-10-physics/support-pdfs/كتاب الطالب لمادة الفيزياء للصف العاشر الفصل الثاني.pdf',
  'phys-s1-teacher-guide': 'knowledge-base/grade-10-physics/support-pdfs/دليل المعلم لمادة الفيزياء الصف العاشر الفصل الأول.pdf',
  'phys-s2-teacher-guide': 'knowledge-base/grade-10-physics/support-pdfs/دليل المعلم لمادة الفيزياء الصف العاشر الفصل الثاني.pdf',
  'phys-s1-activity-book': 'knowledge-base/grade-10-physics/support-pdfs/كتاب الأنشطة لمادة الفيزياء للصف العاشر الفصل الأول.pdf',
  'phys-s2-exercise-book': 'knowledge-base/grade-10-physics/support-pdfs/كتاب التمارين لمادة الفيزياء للصف العاشر الفصل الثاني.pdf',
  'bio-s1-student-book': 'knowledge-base/grade-10-biology/support-pdfs/كتاب الطالب لمادة العلوم الحياتية للصف العاشر الفصل الأول.pdf',
  'bio-s2-student-book': 'knowledge-base/grade-10-biology/support-pdfs/كتاب الطالب لمادة العلوم الحياتية للصف العاشر الفصل الثاني.pdf',
  'bio-s1-teacher-guide': 'knowledge-base/grade-10-biology/support-pdfs/دليل المعلم العلوم الحياتية الصف العاشر الفصل الأول.pdf',
  'bio-s2-teacher-guide': 'knowledge-base/grade-10-biology/support-pdfs/دليل المعلم لمادة العلوم الحياتية الصف العاشر الفصل الثاني.pdf',
  'bio-s1-activity-book': 'knowledge-base/grade-10-biology/support-pdfs/كتاب الأنشطة والتجارب العملية لمادة العلوم الحياتية للصف العاشر الفصل الأول.pdf',
  'bio-s2-activity-book': 'knowledge-base/grade-10-biology/support-pdfs/كتاب الأنشطة والتجارب العملية لمادة العلوم الحياتية للصف العاشر الفصل الثاني.pdf',
  'bio-worksheet-answers': 'knowledge-base/grade-10-biology/support-pdfs/إجابات أسئلة أوراق العمل من دليل المعلم العلوم الحياتية الصف العاشر.pdf',
  'earth-s2-student-book': 'knowledge-base/grade-10-earth-science/support-pdfs/كتاب الطالب لمادة علوم الأرض والبيئة الصف العاشر الفصل الثاني.pdf',
  'earth-s1-teacher-guide': 'knowledge-base/grade-10-earth-science/support-pdfs/دليل المعلم لمادة علوم الأرض والبيئة الصف العاشر الفصل الأول.pdf',
  'earth-s2-teacher-guide': 'knowledge-base/grade-10-earth-science/support-pdfs/دليل المعلم لمادة علوم الأرض والبيئة الصف العاشر الفصل الثاني.pdf',
  'earth-s1-activity-book': 'knowledge-base/grade-10-earth-science/support-pdfs/كتاب الأنشطة والتجارب العملية لمادة علوم الأرض الصف العاشر الفصل الأول.pdf',
  'earth-s2-activity-book': 'knowledge-base/grade-10-earth-science/support-pdfs/كتاب الأنشطة والتجارب العملية لمادة علوم الأرض الصف العاشر الفصل الثاني.pdf',
  'arabic-s1-student-book': 'knowledge-base/grade-10-arabic/support-pdfs/كتاب الطالب لمادة العربية لغتي للصف العاشر الفصل الأول.pdf',
  'arabic-s2-student-book': 'knowledge-base/grade-10-arabic/support-pdfs/كتاب الطالب لمادة اللغة العربية للصف العاشر الفصل الثاني.pdf',
  'arabic-s1-teacher-guide': 'knowledge-base/grade-10-arabic/support-pdfs/دليل المعلم لمادة العربية لغتي الصف العاشر الفصل الأول.pdf',
  'arabic-s1-exercise-book': 'knowledge-base/grade-10-arabic/support-pdfs/كتاب التمارين لمادة اللغة العربية (العربية لغتي) للصف العاشر الفصل الأول.pdf',
  'arabic-s2-exercise-book': 'knowledge-base/grade-10-arabic/support-pdfs/كتاب التمارين لمادة اللغة العربية (العربية لغتي) للصف العاشر الفصل الثاني.pdf',
  'finlit-s1-student-book': 'knowledge-base/grade-10-finlit/support-pdfs/الثقافة المالية 10 ف1 small.pdf',
  'earth-s1-student-book': 'knowledge-base/grade-10-earth-science/support-pdfs/كتاب الطالب لمادة علوم الأرض والبيئة الصف العاشر الفصل الأول.pdf',
  'islamic-s1-teacher-guide': 'knowledge-base/grade-10-islamic/support-pdfs/دليل المعلم لمادة التربية الإسلامية الصف العاشر الفصل الأول.pdf',
  'islamic-s2-teacher-guide': 'knowledge-base/grade-10-islamic/support-pdfs/دليل المعلم لمادة التربية الإسلامية الصف العاشر الفصل الثاني.pdf',
  'islamic-s1-student-book': 'knowledge-base/grade-10-islamic/support-pdfs/كتاب الطالب لمادة التربية الإسلامية الصف العاشر الفصل الأول.pdf',
  'islamic-s2-student-book': 'knowledge-base/grade-10-islamic/support-pdfs/كتاب الطالب لمادة التربية الإسلامية الصف العاشر الفصل الثاني.pdf',
  'history-s1-student-book': 'knowledge-base/grade-10-history/support-pdfs/كتاب الطالب لمادة التاريخ للصف العاشر الفصل الأول.pdf',
  'history-s2-student-book': 'knowledge-base/grade-10-history/support-pdfs/كتاب الطالب لمادة التاريخ للصف العاشر الفصل الثاني.pdf',
  'eng-s1-student-book': 'knowledge-base/grade-10-english/support-pdfs/كتاب الطالب لمادة اللغة الإنجليزية الصف العاشر الفصل الأول.pdf',
  'eng-s1-activity-book': 'knowledge-base/grade-10-english/support-pdfs/كتاب الأنشطة لمادة اللغة الإنجليزية للصف العاشر الفصل الأول.pdf',
  'eng-s2-student-book': 'knowledge-base/grade-10-english/support-pdfs/كتاب الطالب لمادة اللغة الإنجليزية الصف العاشر الفصل الثاني.pdf',
  'eng-s2-activity-book': 'knowledge-base/grade-10-english/support-pdfs/كتاب الأنشطة لمادة اللغة الإنجليزية للصف العاشر الفصل الثاني.pdf',
  'geo-s1-student-book': 'knowledge-base/grade-10-geography/support-pdfs/كتاب الطالب لمادة الجغرافيا للصف العاشر الفصل الأول.pdf',
  'geo-s2-student-book': 'knowledge-base/grade-10-geography/support-pdfs/كتاب الطالب لمادة الجغرافيا للصف العاشر الفصل الثاني.pdf',
  'digital-s1-student-book': 'knowledge-base/grade-10-digital-literacy/support-pdfs/كتاب الطالب لمادة المهارات الرقمية الصف العاشر الفصل الأول.pdf',
  'digital-s2-student-book': 'knowledge-base/grade-10-digital-literacy/support-pdfs/كتاب الطالب لمادة المهارات الرقمية الصف العاشر الفصل الثاني.pdf',
  'civic-s1-student-book': 'knowledge-base/grade-10-civic/support-pdfs/كتاب الطالب لمادة التربية الوطنية والمدنية للصف العاشر الفصل الأول.pdf',
  'civic-s2-student-book': 'knowledge-base/grade-10-civic/support-pdfs/كتاب الطالب لمادة التربية الوطنية والمدنية للصف العاشر الفصل الثاني.pdf',
  'art-teacher-guide': 'knowledge-base/grade-10-art/support-pdfs/دليل المعلم التربية الفنية الصف العاشر.pdf',
  'art-student-book': 'knowledge-base/grade-10-art/support-pdfs/كتاب الطالب لمادة التربية الفنية للصف العاشر.pdf',
  'vocational-p1-student-book': 'knowledge-base/grade-10-vocational/support-pdfs/كتاب الطالب لمادة التربية المهنية الصف العاشر الجزء الأول.pdf',
  'vocational-p2-student-book': 'knowledge-base/grade-10-vocational/support-pdfs/كتاب الطالب لمادة التربية المهنية الصف العاشر الجزء الثاني.pdf',
  // Added 2026-09-05, closing the gap flagged in objectives.test.ts and
  // curriculumIds.test.ts: the Grade 9 maths catalog shipped with 0 sources
  // behind it. Filenames verified against content, not trusted blind — see
  // the note on the Grade 10 math pair above; both books here print their
  // own units in the table of contents and it matches the semester in the
  // filename.
  'g9-math-s1-student-book': 'knowledge-base/grade-9-math/support-pdfs/كتاب الطالب لمادة الرياضيات الصف التاسع الفصل الأول.pdf',
  'g9-math-s2-student-book': 'knowledge-base/grade-9-math/support-pdfs/كتاب الطالب لمادة الرياضيات الصف التاسع الفصل الثاني.pdf',
};
