/**
 * The Jordanian إملاء rules, and the words that test them.
 *
 * Hand-authored, and that is the design. A spelling key is the one thing in
 * this product a model cannot be trusted with: there is no SymPy for Arabic
 * orthography, so a generated «هذة» for «هذه» would reach a whole class
 * unchallenged. `lib/math-practice` exists for the same reason — a self-marking
 * question needs a known answer, and a template can only ever produce a
 * question.
 *
 * ## Where the rules come from
 *
 * The curriculum names them. Every unit of the Arabic book closes with a
 * writing lesson — `أَكْتُبُ (…)` in grades 2–6, `الكتابةُ: …` in grade 7 — and
 * the rule is in the title. So the scope is not a judgement call: it is the
 * ~22 rules those lessons cover, and it stops at grade 7, after which the
 * writing lessons teach genres (مقالة، تقرير، سيرة ذاتية) rather than spelling.
 *
 * `lessonIds` anchors each rule to those lessons by id rather than by matching
 * their titles. The same rule is titled `هَمْزَةُ الْوَصْلِ` in grade 2,
 * `هَمْزَتا الْوَصْلِ` in grade 3 and `همزةِ الوَصلِ` in grade 7 — different
 * tashkeel, different `الْ` forms. A regex over titles fails silently the first
 * time a book is re-typeset.
 *
 * ## Why the words are vowelled
 *
 * Two reasons, and both are load-bearing. The grades that learn these rules
 * read fully vowelled text, so an unvowelled word is not what the child sees.
 * And an unvowelled word cannot be read aloud correctly — «كتب» is كَتَبَ or
 * كُتُب and nothing in the letters says which — so any spoken prompt built from
 * this bank needs the harakat to pronounce the word the question is about.
 *
 * Marking strips them by default (`normalizeForDictation`), so a child who
 * cannot produce a haraka on a phone keyboard is never penalised for it.
 *
 * ## Why `wrong` is a list of real mistakes
 *
 * These are the misspellings Jordanian primary pupils actually write, not
 * random corruptions. That matters twice over: a distractor has to be tempting
 * to measure anything, and a wrong answer a child recognises as their own
 * mistake is the one they learn from. Several rules carry words in **both**
 * directions — «وَجْه» miswritten as «وجة» as well as «مَدْرَسَة» as «مدرسه» —
 * because a pupil who has only met the rule one way writes ة everywhere.
 */

export interface SpellingWord {
  /** The correct spelling, vowelled as the student book prints it. */
  correct: string;
  /** Misspellings a pupil at this grade actually produces. */
  wrong: string[];
  /** A short sentence putting the word in context, for sentence dictation. */
  sentenceAr?: string;
}

export interface SpellingRule {
  id: string;
  /** The rule as a teacher would name it. */
  nameAr: string;
  /** Grades whose books teach or revisit it. */
  grades: number[];
  /**
   * Curriculum lesson ids this rule belongs to, as
   * `g<grade>s<semester>:<lessonId>` — the semester matters because lesson ids
   * repeat across the two books of a grade.
   */
  lessonIds: string[];
  /** The rule itself, in the words a teacher would write on the board. */
  ruleAr: string;
  words: SpellingWord[];
}

/**
 * التاء المربوطة والهاء.
 *
 * The most common spelling error in Jordanian primary Arabic, and the reason
 * this feature cannot reuse the shared grader: `normalizeArabic` folds ة to ه,
 * so every pair below is identical to it.
 */
const taaMarbutaHaa: SpellingRule = {
  id: "taa-marbuta-haa",
  nameAr: "التاء المربوطة والهاء في آخر الكلمة",
  grades: [2, 4],
  lessonIds: ["g2s1:u5_l4", "g4s1:u2_l4", "g4s2:u6_l4"],
  ruleAr:
    "التاءُ المربوطةُ (ة) تُنطقُ تاءً عندَ الوصلِ وهاءً عندَ الوقفِ، وعليها نقطتانِ. "
    + "والهاءُ (ه) تبقى هاءً في الحالينِ. للتمييزِ: نَوِّنْ آخرَ الكلمةِ أو صِلْها بما بعدَها.",
  words: [
    { correct: "مَدْرَسَة", wrong: ["مدرسه"], sentenceAr: "ذَهَبَ الوَلَدُ إِلى المَدْرَسَةِ" },
    { correct: "حَديقَة", wrong: ["حديقه"], sentenceAr: "في الحَديقَةِ أَزْهارٌ كَثيرَةٌ" },
    { correct: "شَجَرَة", wrong: ["شجره"], sentenceAr: "الشَّجَرَةُ كَبيرَةٌ" },
    { correct: "زَهْرَة", wrong: ["زهره"] },
    { correct: "سَيّارَة", wrong: ["سياره"] },
    { correct: "مِلْعَقَة", wrong: ["ملعقه"] },
    { correct: "فاطِمَة", wrong: ["فاطمه"] },
    { correct: "جَميلَة", wrong: ["جميله"] },
    { correct: "مِظَلَّة", wrong: ["مظله"] },
    { correct: "نافِذَة", wrong: ["نافذه"] },
    // The other direction. A pupil who has just learned ة writes it everywhere,
    // so a rule tested in one direction only is a rule half taught.
    { correct: "وَجْه", wrong: ["وجة"], sentenceAr: "وَجْهُ أَخي مُبْتَسِمٌ" },
    { correct: "مِياه", wrong: ["مياة"] },
    { correct: "فَواكِه", wrong: ["فواكة"] },
    { correct: "نَبيه", wrong: ["نبية"] },
  ],
};

/**
 * همزة الوصل وهمزة القطع.
 *
 * The spine of Jordanian إملاء — introduced in grade 2 and revisited in three
 * later grades, which is why `grades` here is a list rather than a number.
 * `normalizeArabic` folds أ إ آ ٱ all to ا, so it too cannot mark any of this.
 */
const hamzaWaslQat: SpellingRule = {
  id: "hamza-wasl-qat",
  nameAr: "همزة الوصل وهمزة القطع",
  grades: [2, 3, 4, 5],
  lessonIds: ["g2s1:u3_l4", "g2s2:u6_l4", "g3s2:u7_l4", "g4s1:u1_l4", "g5s1:u2_l4"],
  ruleAr:
    "همزةُ القطعِ تُكتبُ وتُنطقُ في أوَّلِ الكلامِ وفي وسطِهِ، وتُرسمُ (أ) أو (إ). "
    + "وهمزةُ الوصلِ تُنطقُ في أوَّلِ الكلامِ وتسقطُ عندَ وصلِها بما قبلَها، وتُرسمُ ألفًا بلا همزةٍ (ا). "
    + "والاختبارُ: ضَعْ قبلَ الكلمةِ واوًا، فإنْ نطقتَ الهمزةَ فهي قطعٌ.",
  words: [
    { correct: "أَكَلَ", wrong: ["اكل"], sentenceAr: "أَكَلَ الطِّفْلُ تُفّاحَةً" },
    { correct: "أَرْنَب", wrong: ["ارنب"] },
    // Not «أُسْرَتي»: suffixing turns the ة into ت, so the sentence would stop
    // testing the letter the question is about.
    { correct: "أُسْرَة", wrong: ["اسرة"], sentenceAr: "أُسْرَةُ خالِدٍ كَبيرَةٌ" },
    { correct: "إِبْراهيم", wrong: ["ابراهيم"] },
    { correct: "إِسْلام", wrong: ["اسلام"] },
    { correct: "أَحْمَد", wrong: ["احمد"] },
    { correct: "إِلى", wrong: ["الى"] },
    { correct: "أَخَذَ", wrong: ["اخذ"] },
    // همزة وصل: the alif carries no hamza at all.
    { correct: "اسْم", wrong: ["أسم", "إسم"], sentenceAr: "اسْمي خالِدٌ" },
    { correct: "ابْن", wrong: ["أبن", "إبن"] },
    { correct: "اثْنانِ", wrong: ["أثنان", "إثنان"] },
    { correct: "امْرَأَة", wrong: ["إمرأة", "أمرأة"] },
    { correct: "اسْتَمَعَ", wrong: ["إستمع", "أستمع"], sentenceAr: "اسْتَمَعَ الطّالِبُ لِلْمُعَلِّمِ" },
    { correct: "انْطَلَقَ", wrong: ["إنطلق", "أنطلق"] },
    { correct: "اجْتَمَعَ", wrong: ["إجتمع", "أجتمع"] },
  ],
};

/**
 * الألف الفارقة.
 *
 * The alif that is written after a plural waw and never pronounced — and its
 * mirror, the root waw that must NOT take one. The pair is the whole lesson:
 * taught in one direction, it produces pupils who write «يدعوا» for «يَدْعو».
 *
 * `normalizeArabic` does not fold this one, so unlike the two rules above it is
 * not evidence for the strict comparator — it is here because the curriculum
 * teaches it in four separate units.
 */
const alifFariqa: SpellingRule = {
  id: "alif-fariqa",
  nameAr: "الألف الفارقة بعد واو الجماعة",
  grades: [3, 4, 5],
  lessonIds: ["g3s1:u3_l4", "g3s2:u9_l4", "g4s2:u10_l4", "g5s2:u10_l4"],
  ruleAr:
    "تُزادُ ألفٌ بعدَ واوِ الجماعةِ في آخرِ الفعلِ، ولا تُنطقُ، وتُسمّى الألفَ الفارقةَ. "
    + "أمّا الواوُ الأصليَّةُ منْ بِنيةِ الكلمةِ فلا ألفَ بعدَها.",
  words: [
    { correct: "كَتَبوا", wrong: ["كتبو"], sentenceAr: "كَتَبوا الدَّرْسَ" },
    { correct: "ذَهَبوا", wrong: ["ذهبو"], sentenceAr: "ذَهَبوا إِلى المَلْعَبِ" },
    { correct: "لَعِبوا", wrong: ["لعبو"] },
    { correct: "شَرِبوا", wrong: ["شربو"] },
    { correct: "خَرَجوا", wrong: ["خرجو"] },
    { correct: "سَمِعوا", wrong: ["سمعو"] },
    { correct: "جَلَسوا", wrong: ["جلسو"] },
    { correct: "فَرِحوا", wrong: ["فرحو"] },
    // الواو الأصلية: no alif. The mirror half of the same lesson.
    { correct: "يَدْعو", wrong: ["يدعوا"], sentenceAr: "يَدْعو المُسْلِمُ رَبَّهُ" },
    { correct: "يَشْكو", wrong: ["يشكوا"] },
    { correct: "أَرْجو", wrong: ["أرجوا"] },
    { correct: "يَرْجو", wrong: ["يرجوا"] },
    { correct: "يَنْمو", wrong: ["ينموا"] },
  ],
};

/**
 * Every rule, in the order a pupil meets them.
 *
 * Three so far. The remaining nineteen the curriculum names — اللام الشمسية
 * والقمرية, هذا/هذه/هؤلاء, التنوين, همزة المد, الهمزة المتوسطة, الهمزة
 * المتطرفة, الألف اللينة, النون الساكنة, حذف همزة (ابن), همزة الاستفهام and
 * the rest — follow the same shape. The machinery does not change as they land.
 */
export const SPELLING_RULES: readonly SpellingRule[] = [
  hamzaWaslQat,
  taaMarbutaHaa,
  alifFariqa,
];

export function ruleById(id: string): SpellingRule | undefined {
  return SPELLING_RULES.find(r => r.id === id);
}

/** Rules a grade's books teach or revisit. */
export function rulesForGrade(grade: number): SpellingRule[] {
  return SPELLING_RULES.filter(r => r.grades.includes(grade));
}

/**
 * Rules anchored to one curriculum lesson.
 *
 * `lessonRef` is `g<grade>s<semester>:<lessonId>` — the shape `lessonIds` uses,
 * because a bare `u3_l4` names a different lesson in all eighteen Arabic books.
 */
export function rulesForLesson(lessonRef: string): SpellingRule[] {
  return SPELLING_RULES.filter(r => r.lessonIds.includes(lessonRef));
}
