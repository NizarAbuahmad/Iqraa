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
 * ## A rule spans grades, its words do not
 *
 * The curriculum revisits همزة الوصل والقطع in four different grades, so the
 * *rule* carries `grades: [2, 3, 4, 5]`. The words cannot: «اِجْتَمَعَ» is not a
 * Grade 2 word, and before `grade` existed on each word a Grade 2 worksheet
 * could and did draw it. Each word therefore declares the earliest grade that
 * should meet it, and a request for grade N draws everything tagged N **or
 * lower** — a revision year includes the words already learned, which is what
 * revision means.
 *
 * ## Why the words are vowelled, and fully
 *
 * Two reasons, and both are load-bearing. The grades that learn these rules
 * read fully vowelled text, so a half-vowelled word is not what the child sees.
 * And an unvowelled word cannot be read aloud correctly — «كتب» is كَتَبَ or
 * كُتُب and nothing in the letters says which — so any spoken prompt built from
 * this bank needs the harakat to pronounce the word the question is about.
 *
 * همزة الوصل carries its kasra (`اِسْم`, not `اسْم`). The books print it
 * precisely so the child can see that the alif is وصل and not قطع, which is the
 * whole lesson — dropping it removes the visual cue the exercise depends on.
 *
 * Marking strips all of it by default (`normalizeForDictation`), so a child who
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

/**
 * Which letters a rule's derived distractors may swap.
 *
 * Without this, `orthographicVariants` offered every position-legal swap it
 * knew, so «أَرْجُو» — a واو أصلية word in the الألف الفارقة rule — drew
 * «ارجو» and «إرجو» as distractors and quietly became a hamza question. A
 * distractor has to test the rule being asked about, or the child's wrong
 * answer tells the teacher nothing about the lesson they just taught.
 *
 * Absent means "any" — correct for a future rule whose confusions are mixed.
 */
export type VariantClass = "final-taa" | "initial-hamza" | "final-waw" | "final-alif-layyina";

export interface SpellingWord {
  /** The correct spelling, fully vowelled as the student book prints it. */
  correct: string;
  /** Misspellings a pupil at this grade actually produces. */
  wrong: string[];
  /**
   * The earliest grade that should meet this word. A request for a later grade
   * includes it, so a rule taught across four years does not serve a
   * seven-year-old the vocabulary of a ten-year-old.
   */
  grade: number;
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
  /** Which letter swaps a derived distractor may use. Omit to allow all. */
  variantClass?: VariantClass;
  words: SpellingWord[];
}

/**
 * التاء المربوطة والهاء.
 *
 * The most common spelling error in Jordanian primary Arabic, and the reason
 * this feature cannot reuse the shared grader: `normalizeArabic` folds ة to ه,
 * so every pair below is identical to it.
 *
 * Derived distractors may also offer a final ت. That is not a third letter
 * smuggled in — «التاء المربوطة والمفتوحة والهاء» is one lesson, and children
 * do write it.
 */
const taaMarbutaHaa: SpellingRule = {
  id: "taa-marbuta-haa",
  nameAr: "التاء المربوطة والهاء في آخر الكلمة",
  grades: [2, 4],
  lessonIds: ["g2s1:u5_l4", "g4s1:u2_l4", "g4s2:u6_l4"],
  variantClass: "final-taa",
  ruleAr:
    "التاءُ المربوطةُ (ة) تُنطقُ تاءً عندَ الوصلِ وهاءً عندَ الوقفِ، وعليها نقطتانِ. "
    + "والهاءُ (ه) تبقى هاءً في الحالينِ. للتمييزِ: نَوِّنْ آخرَ الكلمةِ أو صِلْها بما بعدَها.",
  words: [
    { grade: 2, correct: "مَدْرَسَة", wrong: ["مدرسه"], sentenceAr: "ذَهَبَ الوَلَدُ إِلَى المَدْرَسَةِ" },
    { grade: 2, correct: "حَدِيقَة", wrong: ["حديقه"], sentenceAr: "فِي الحَدِيقَةِ أَزْهَارٌ كَثِيرَةٌ" },
    { grade: 2, correct: "شَجَرَة", wrong: ["شجره"], sentenceAr: "الشَّجَرَةُ كَبِيرَةٌ" },
    { grade: 2, correct: "زَهْرَة", wrong: ["زهره"] },
    { grade: 2, correct: "سَيَّارَة", wrong: ["سياره"] },
    { grade: 2, correct: "فَاطِمَة", wrong: ["فاطمه"] },
    { grade: 2, correct: "نَافِذَة", wrong: ["نافذه"] },
    { grade: 4, correct: "مِلْعَقَة", wrong: ["ملعقه"] },
    { grade: 4, correct: "جَمِيلَة", wrong: ["جميله"] },
    { grade: 4, correct: "مِظَلَّة", wrong: ["مظله"] },
    // The other direction. A pupil who has just learned ة writes it everywhere,
    // so a rule tested in one direction only is a rule half taught.
    { grade: 2, correct: "وَجْه", wrong: ["وجة"], sentenceAr: "وَجْهُ أَخِي مُبْتَسِمٌ" },
    // The commonest ه error of the lot, and it doubles as the spelling half of
    // the grade 2 and 3 lesson «أَكْتُبُ (هَذَا، هَذِهِ)».
    { grade: 2, correct: "هَذِهِ", wrong: ["هذة"], sentenceAr: "هَذِهِ حَقِيبَتِي" },
    { grade: 2, correct: "مِيَاه", wrong: ["مياة"] },
    { grade: 4, correct: "فَوَاكِه", wrong: ["فواكة"] },
  ],
};

/**
 * همزة الوصل وهمزة القطع.
 *
 * The spine of Jordanian إملاء — introduced in grade 2 and revisited in three
 * later grades, which is why `grades` here is a list rather than a number.
 * `normalizeArabic` folds أ إ آ ٱ all to ا, so it too cannot mark any of this.
 *
 * The grade split is the point of `grade` on a word: the قطع nouns and the two
 * short وصل nouns are grade 2, while the خماسي verbs a seven-year-old has never
 * met wait for grades 4 and 5.
 */
const hamzaWaslQat: SpellingRule = {
  id: "hamza-wasl-qat",
  nameAr: "همزة الوصل وهمزة القطع",
  grades: [2, 3, 4, 5],
  lessonIds: ["g2s1:u3_l4", "g2s2:u6_l4", "g3s2:u7_l4", "g4s1:u1_l4", "g5s1:u2_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "همزةُ القطعِ تُكتبُ وتُنطقُ في أوَّلِ الكلامِ وفي وسطِهِ، وتُرسمُ (أ) أو (إ). "
    + "وهمزةُ الوصلِ تُنطقُ في أوَّلِ الكلامِ وتسقطُ عندَ وصلِها بما قبلَها، وتُرسمُ ألفًا بلا همزةٍ (ا). "
    + "والاختبارُ: ضَعْ قبلَ الكلمةِ واوًا، فإنْ نطقتَ الهمزةَ فهي قطعٌ.",
  words: [
    { grade: 2, correct: "أَكَلَ", wrong: ["اكل"], sentenceAr: "أَكَلَ الطِّفْلُ تُفَّاحَةً" },
    { grade: 2, correct: "أَرْنَب", wrong: ["ارنب"] },
    { grade: 2, correct: "أُسْرَة", wrong: ["اسرة"], sentenceAr: "أُسْرَةُ خَالِدٍ كَبِيرَةٌ" },
    { grade: 2, correct: "أَحْمَد", wrong: ["احمد"] },
    { grade: 2, correct: "أَخَذَ", wrong: ["اخذ"] },
    { grade: 3, correct: "إِلَى", wrong: ["الى"] },
    { grade: 3, correct: "إِبْرَاهِيم", wrong: ["ابراهيم"] },
    { grade: 4, correct: "إِسْلَام", wrong: ["اسلام"] },
    // همزة وصل: the alif carries a kasra and no hamza at all. The kasra is the
    // visual cue the lesson turns on — see this file's header.
    { grade: 2, correct: "اِسْم", wrong: ["أسم", "إسم"], sentenceAr: "اِسْمِي خَالِدٌ" },
    { grade: 2, correct: "اِبْن", wrong: ["أبن", "إبن"] },
    { grade: 3, correct: "اِثْنَانِ", wrong: ["أثنان", "إثنان"] },
    { grade: 4, correct: "اِمْرَأَة", wrong: ["إمرأة", "أمرأة"] },
    { grade: 4, correct: "اِسْتَمَعَ", wrong: ["إستمع", "أستمع"], sentenceAr: "اِسْتَمَعَ الطَّالِبُ لِلْمُعَلِّمِ" },
    { grade: 5, correct: "اِنْطَلَقَ", wrong: ["إنطلق", "أنطلق"] },
    { grade: 5, correct: "اِجْتَمَعَ", wrong: ["إجتمع", "أجتمع"] },
  ],
};

/**
 * الألف الفارقة.
 *
 * The alif that is written after a plural waw and never pronounced — and its
 * mirror, the root waw that must NOT take one. The pair is the whole lesson:
 * taught in one direction, it produces pupils who write «يدعوا» for «يَدْعُو».
 *
 * The grade split follows the books: grade 3's lesson is
 * «الْأَلِفُ بَعْدَ واوِ الْجَماعَةِ» alone, and the واو أصلية contrast arrives
 * with grade 4's «الْواوُ الأَصْلِيَّةُ وَواوُ الْجَماعَةِ». So a grade 3
 * worksheet draws only the plural verbs, which is exactly what it should.
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
  variantClass: "final-waw",
  ruleAr:
    "تُزادُ ألفٌ بعدَ واوِ الجماعةِ في آخرِ الفعلِ، ولا تُنطقُ، وتُسمّى الألفَ الفارقةَ. "
    + "أمّا الواوُ الأصليَّةُ منْ بِنيةِ الكلمةِ فلا ألفَ بعدَها.",
  words: [
    { grade: 3, correct: "كَتَبُوا", wrong: ["كتبو"], sentenceAr: "كَتَبُوا الدَّرْسَ" },
    { grade: 3, correct: "ذَهَبُوا", wrong: ["ذهبو"], sentenceAr: "ذَهَبُوا إِلَى المَلْعَبِ" },
    { grade: 3, correct: "لَعِبُوا", wrong: ["لعبو"] },
    { grade: 3, correct: "شَرِبُوا", wrong: ["شربو"] },
    { grade: 3, correct: "خَرَجُوا", wrong: ["خرجو"] },
    { grade: 3, correct: "جَلَسُوا", wrong: ["جلسو"] },
    { grade: 4, correct: "سَمِعُوا", wrong: ["سمعو"] },
    { grade: 4, correct: "فَرِحُوا", wrong: ["فرحو"] },
    // الواو الأصلية: no alif. The mirror half, which the books introduce a year
    // after the plural waw.
    { grade: 4, correct: "يَدْعُو", wrong: ["يدعوا"], sentenceAr: "يَدْعُو المُسْلِمُ رَبَّهُ" },
    { grade: 4, correct: "يَنْمُو", wrong: ["ينموا"] },
    { grade: 5, correct: "يَشْكُو", wrong: ["يشكوا"] },
    { grade: 5, correct: "يَرْجُو", wrong: ["يرجوا"] },
    { grade: 5, correct: "يَبْدُو", wrong: ["يبدوا"] },
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

/**
 * The words of a rule a given grade should be asked about.
 *
 * Cumulative, not exact: grade 5 revising همزة الوصل draws the grade 2 nouns
 * too, because that is what revising a rule means. Without a grade it is the
 * whole list — the teacher's own choice stays unfiltered.
 */
export function wordsForGrade(rule: SpellingRule, grade?: number): SpellingWord[] {
  if (grade === undefined) return [...rule.words];
  return rule.words.filter(w => w.grade <= grade);
}
