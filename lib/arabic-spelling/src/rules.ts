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

/** اللام الشمسية واللام القمرية */
const lamShamsiyaQamariya: SpellingRule = {
  id: "lam-shamsiya-qamariya",
  nameAr: "اللام الشمسية واللام القمرية",
  grades: [3, 7],
  lessonIds: ["g3s1:u1_l4", "g7s1:u2_l4"],
  // initial-hamza: orthographicVariants swaps ا → أ/إ, giving two derived distractors
  // (ألشمس, إلشمس) so choose items work even from words with one hand-authored wrong.
  variantClass: "initial-hamza",
  ruleAr:
    "إذا جاءتِ «الـ» قبلَ حروفِ (ت ث د ذ ر ز س ش ص ض ط ظ ع غ ل ن) أُدغمتِ اللامُ فيها وسُمِّيتِ الشمسيَّةَ. "
    + "وإذا جاءتْ قبلَ بقيَّةِ الحروفِ نُطقتِ اللامُ وسُمِّيتِ القمريَّةَ. "
    + "الكتابةُ دائمًا «الـ»، والفرقُ في النُّطقِ فقط.",
  words: [
    // All these start with ا (wasl alif). The real writing error: writing أل (hamza qat)
    // instead of ال (wasl). bare strips harakat so "الشمس" = correct after bare,
    // but "ألشمس" (أ≠ا) and "إلشمس" (إ≠ا) are distinct — derived by variantClass.
    { grade: 3, correct: "الشَّمْس", wrong: ["ألشمس"] },
    { grade: 3, correct: "الطَّالِب", wrong: ["ألطالب"] },
    { grade: 3, correct: "النَّهْر", wrong: ["ألنهر"] },
    { grade: 3, correct: "الدَّرْس", wrong: ["ألدرس"] },
    { grade: 3, correct: "الرَّبِيع", wrong: ["ألربيع"] },
    { grade: 3, correct: "القَمَر", wrong: ["ألقمر"] },
    { grade: 3, correct: "الكِتَاب", wrong: ["ألكتاب"] },
    { grade: 3, correct: "البَيْت", wrong: ["ألبيت"] },
    { grade: 7, correct: "السَّعَادَة", wrong: ["ألسعادة"] },
    { grade: 7, correct: "الصِّدْق", wrong: ["ألصدق"] },
  ],
};

/** هذا، هذه، هؤلاء، ذلك، أولئك، لكن */
const hathaHathihi: SpellingRule = {
  id: "hatha-hathihi",
  nameAr: "هذا وهذه وهؤلاء وذلك وأولئك ولكن",
  grades: [3],
  lessonIds: ["g3s1:u2_l4", "g3s1:u4_l4"],
  ruleAr:
    "هذا وهذه وهؤلاء وذلك وأولئك ولكن كلماتٌ تُحفظُ بصورتِها. "
    + "الهاءُ في (هذا، هذه، هؤلاء) هاءُ التنبيهِ، وتُكتبُ هاءً لا تاءً مربوطةً. "
    + "والذالُ في (هذا، هذه، ذلك، أولئك) تُكتبُ بالذالِ لا بالزاي.",
  words: [
    { grade: 3, correct: "هَذَا", wrong: ["هاذا", "هذأ"], sentenceAr: "هَذَا كِتَابِي" },
    { grade: 3, correct: "هَذِهِ", wrong: ["هذة", "هاذه"], sentenceAr: "هَذِهِ مَدْرَسَتِي" },
    // "هؤلاء" bare = same as correct bare; replace with "هاؤلاء" and "هولاء".
    { grade: 3, correct: "هَؤُلَاء", wrong: ["هاؤلاء", "هولاء"] },
    { grade: 3, correct: "ذَلِك", wrong: ["زلك", "دلك"] },
    { grade: 3, correct: "أُولَئِك", wrong: ["أولائك", "أولأئك"] },
    { grade: 3, correct: "لَكِن", wrong: ["لاكن", "لكنن"] },
  ],
};

/** همزة المد (آ) */
const hamzatAlMadd: SpellingRule = {
  id: "hamzat-al-madd",
  nameAr: "همزة المد (آ)",
  grades: [3, 5],
  lessonIds: ["g3s2:u8_l4", "g5s2:u10_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "إذا جاءتِ الهمزةُ مفتوحةً بعدَها ألفٌ مدٍّ رُسمتِ المدَّةُ فوقَ الألفِ (آ). "
    + "ومثلُها: كلُّ مكانٍ تجتمعُ فيه همزتانِ — الأولى متحرِّكةٌ والثانيةُ ساكنةٌ.",
  words: [
    { grade: 3, correct: "آدَم", wrong: ["أادم", "اادم"], sentenceAr: "آدَمُ أَبُو البَشَرِ" },
    { grade: 3, correct: "آمَن", wrong: ["أأمن", "امن"] },
    { grade: 3, correct: "آكَل", wrong: ["أأكل", "اكل"] },
    { grade: 3, correct: "آخَر", wrong: ["أاخر", "اخر"] },
    // "آنية" bare = same as correct bare; replace with "آنيه" (ة→ه error).
    { grade: 3, correct: "آنِيَة", wrong: ["أانية", "آنيه"] },
    { grade: 5, correct: "آفَاق", wrong: ["أأفاق", "أافاق"] },
    { grade: 5, correct: "آلَام", wrong: ["أألام", "الام"] },
    { grade: 5, correct: "آثَار", wrong: ["أأثار", "اثار"] },
  ],
};

/** الهمزة المتوسطة */
const hamzaMutawassita: SpellingRule = {
  id: "hamza-mutawassita",
  nameAr: "الهمزة المتوسطة",
  grades: [4, 5],
  lessonIds: ["g4s1:u3_l4", "g5s2:u8_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "الهمزةُ المتوسِّطةُ تُرسمُ على حرفٍ يناسبُ أقوى الحركتين: "
    + "فإنْ سبقتِ الكسرةُ أو لحقتِ الهمزةَ كُتبتْ على ياءٍ (ئ)، "
    + "وإنْ سبقتِ الضمَّةُ كُتبتْ على واوٍ (ؤ)، "
    + "وإنْ سبقتِ الفتحةُ كُتبتْ على ألفٍ (أ)، "
    + "وإنْ سكنَ ما قبلَها كُتبتْ على السطرِ.",
  words: [
    { grade: 4, correct: "سُؤَال", wrong: ["سوال", "سئال"], sentenceAr: "سُؤَالٌ جَيِّدٌ" },
    { grade: 4, correct: "مَسْأَلَة", wrong: ["مسالة", "مسئلة"] },
    { grade: 4, correct: "رَأْس", wrong: ["راس", "رئس"] },
    // "بئر" bare = same as correct bare; replace with "بأر" (ئ→أ error).
    { grade: 4, correct: "بِئْر", wrong: ["بأر", "بير"] },
    { grade: 4, correct: "يَسْأَل", wrong: ["يسال", "يسئل"], sentenceAr: "يَسْأَلُ الطَّالِبُ مُعَلِّمَهُ" },
    // "رئيس" bare = same as correct bare; replace with real errors.
    { grade: 4, correct: "رَئِيس", wrong: ["رايس", "رأيس"] },
    { grade: 5, correct: "مَسْؤُول", wrong: ["مسول", "مسئول"] },
    { grade: 5, correct: "تَسَاؤُل", wrong: ["تساول", "تساءل"] },
    { grade: 5, correct: "فُؤَاد", wrong: ["فواد", "فئاد"] },
  ],
};

/** حروف تنطق ولا تكتب */
const hurufTuntaqLaTuktab: SpellingRule = {
  id: "huruf-tuntuq-la-tuktab",
  nameAr: "كلمات فيها حروف تنطق ولا تكتب",
  grades: [4, 5],
  lessonIds: ["g4s1:u5_l4", "g5s1:u4_l4"],
  ruleAr:
    "بعضُ الكلماتِ تُنطقُ فيها حروفٌ لا تُكتبُ، وتُحفظُ بالقراءةِ والكتابةِ. "
    + "مثلُ: (الرَّحْمَن) تُنطقُ بألفٍ (الرَّحْمَان) ولا تُكتبُ، "
    + "و(هَذَا) تُنطقُ بألفٍ (هَاذَا) ولا تُكتبُ.",
  words: [
    // "الرحمن" bare = "الرحمن" = same as correct bare; remove it, keep "الرحمان".
    // Add "الرحمون" as second distractor.
    { grade: 4, correct: "الرَّحْمَن", wrong: ["الرحمان", "الرحمون"], sentenceAr: "بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ" },
    { grade: 4, correct: "لَكِن", wrong: ["لاكن", "لكنن"] },
    { grade: 4, correct: "ذَلِك", wrong: ["ذالك", "زلك"] },
    // "هذا" has only 1 listed wrong. Add "هده" as a second distractor.
    { grade: 4, correct: "هَذَا", wrong: ["هاذا", "هده"] },
    // "ذهب" has only 1 listed wrong. Add "دهب" (ذ→د error) as second.
    { grade: 4, correct: "ذَهَب", wrong: ["ذاهب", "دهب"] },
    // "إبراهيم" bare = "إبراهيم" = same as wrong[0]; fix: wrong[0] adds extra letter.
    { grade: 5, correct: "إِبْرَاهِيم", wrong: ["إبراهييم", "إبرهيم"] },
    { grade: 5, correct: "إِسْمَاعِيل", wrong: ["إسمعيل", "اسماعيل"] },
    // "الله" bare = same as correct; use "اللاه" (adds alif) as second distractor.
    { grade: 5, correct: "اللَّه", wrong: ["إله", "اللاه"] },
  ],
};

/** النون الساكنة والتنوين */
const nunSakinaTanwin: SpellingRule = {
  id: "nun-sakina-tanwin",
  nameAr: "النون الساكنة والتنوين",
  grades: [4, 7],
  lessonIds: ["g4s2:u7_l4", "g7s1:u1_l4"],
  ruleAr:
    "النونُ الساكنةُ والتنوينُ لهما أربعةُ أحكامٍ: "
    + "الإظهارُ (قبلَ الحلقيَّةِ: ء ه ع غ ح خ)، "
    + "والإدغامُ (قبلَ ي ر م ل و ن)، "
    + "والإقلابُ (قبلَ الباءِ: تُقلبُ ميمًا في النطقِ، وتُكتبُ نونًا)، "
    + "والإخفاءُ (قبلَ بقيَّةِ الحروفِ). "
    + "في الكتابةِ: النونُ والتنوينُ يُكتبانِ كما هما دائمًا.",
  words: [
    // الإقلاب: ن before ب is pronounced م but WRITTEN ن. Error: writing م.
    { grade: 4, correct: "يَنْبُع", wrong: ["يمبع", "ينبوع"] },
    { grade: 4, correct: "مَنْبَع", wrong: ["ممبع", "منبوع"] },
    { grade: 4, correct: "يَنْبُت", wrong: ["يمبت", "ينبوت"] },
    { grade: 4, correct: "مُنْبَسِط", wrong: ["ممبسط", "منبساط"] },
    { grade: 4, correct: "اِنْبَهَر", wrong: ["إمبهر", "انباهر"] },
    { grade: 7, correct: "عَنْبَر", wrong: ["عمبر", "عنابر"] },
    { grade: 7, correct: "إِنْبَاء", wrong: ["إمباء", "انباء"] },
    { grade: 7, correct: "مُنْبَثِق", wrong: ["ممبثق", "منبثاق"] },
  ],
};

/** الهمزة المتطرفة */
const hamzaMutarrafa: SpellingRule = {
  id: "hamza-mutarrafa",
  nameAr: "الهمزة المتطرفة",
  grades: [4, 5],
  lessonIds: ["g4s2:u9_l4", "g5s2:u9_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "الهمزةُ المتطرِّفةُ تُرسمُ على حرفٍ يناسبُ حركةَ ما قبلَها: "
    + "إنْ كانَ ما قبلَها مكسورًا كُتبتْ على ياءٍ (ئ) — مثلُ: قارِئ. "
    + "وإنْ كانَ مضمومًا كُتبتْ على واوٍ (ؤ) — مثلُ: تَوَضُّؤ. "
    + "وإنْ كانَ مفتوحًا كُتبتْ على ألفٍ (أ) — مثلُ: يَقْرَأ. "
    + "وإنْ كانَ ساكنًا كُتبتْ على السطرِ (ء) — مثلُ: شَيْء.",
  words: [
    { grade: 4, correct: "قَارِئ", wrong: ["قاري", "قاريء"] },
    { grade: 4, correct: "يَقْرَأ", wrong: ["يقرا", "يقراء"] },
    { grade: 4, correct: "شَيْء", wrong: ["شيئ", "شئ"] },
    // "دفء" bare = same as correct bare; replace with "دفأ" (أ vs ء) and "دفيء".
    { grade: 4, correct: "دُفْء", wrong: ["دفأ", "دفيء"] },
    // "جزء" bare = same as correct bare; replace with "جزأ".
    { grade: 4, correct: "جُزْء", wrong: ["جزأ", "جزي"] },
    // "ملجأ" bare = same as correct bare; replace second with "ملجاء".
    { grade: 5, correct: "مَلْجَأ", wrong: ["ملجا", "ملجاء"] },
    { grade: 5, correct: "تَوَضَّأ", wrong: ["توضا", "توضاء"] },
    { grade: 5, correct: "لَجَأ", wrong: ["لجا", "لجأء"] },
    { grade: 5, correct: "بَطِيء", wrong: ["بطي", "بطيئ"] },
  ],
};

/** تنوين الفتح */
const tanwinAlFath: SpellingRule = {
  id: "tanwin-al-fath",
  nameAr: "تنوين الفتح",
  grades: [5],
  lessonIds: ["g5s1:u1_l4", "g5s1:u5_l4"],
  ruleAr:
    "تنوينُ الفتحِ يُكتبُ على ألفٍ زائدةٍ آخرَ الكلمةِ إلَّا في الحالاتِ الثلاثِ: "
    + "١. إذا انتهتِ الكلمةُ بتاءٍ مربوطةٍ (مدرسةً لا مدرسةًا). "
    + "٢. إذا انتهتِ بهمزةٍ قبلَها ألفٌ (سماءً). "
    + "٣. إذا انتهتِ بألفٍ وصلٍ.",
  words: [
    // For regular words ending in ا after tanwin: bare("كِتَابًا") = "كتابا".
    // Wrong 1: missing the alif — bare("كِتَابً") = "كتاب" ≠ "كتابا" ✓
    // Wrong 2: using ى instead of ا — bare("كِتَابًى") = "كتابى" ≠ "كتابا" ✓
    { grade: 5, correct: "كِتَابًا", wrong: ["كِتَابً", "كِتَابًى"], sentenceAr: "قَرَأْتُ كِتَابًا مُفِيدًا" },
    { grade: 5, correct: "قَلَمًا", wrong: ["قَلَمً", "قَلَمًى"] },
    { grade: 5, correct: "وَلَدًا", wrong: ["وَلَدً", "وَلَدًى"] },
    // ة-ending words: NO alif added (rule exception). Error: adding alif anyway.
    // bare("مَدْرَسَةً") = "مدرسة". Wrong: "مدرسةا" (adds alif) → bare = "مدرسةا" ✓
    { grade: 5, correct: "مَدْرَسَةً", wrong: ["مدرسةا", "مدرستا"] },
    { grade: 5, correct: "نِعْمَةً", wrong: ["نعمةا", "نعمتا"] },
    // ء after ا: bare("سَمَاءً") = "سماء". Wrong: "سماءا" → bare = "سماءا" ≠ "سماء" ✓
    { grade: 5, correct: "سَمَاءً", wrong: ["سماءا", "سمائا"] },
    { grade: 5, correct: "مَاءً", wrong: ["ماءا", "مائا"] },
  ],
};

/** الألف اللينة في الكلمات فوق الثلاثية */
const alifLayyinaFawqThulathiya: SpellingRule = {
  id: "alif-layyina-fawq-thulathiya",
  nameAr: "الألف اللينة في الكلمات فوق الثلاثية",
  grades: [5],
  lessonIds: ["g5s1:u3_l4"],
  variantClass: "final-alif-layyina",
  ruleAr:
    "في الكلماتِ الزائدةِ على ثلاثةِ أحرفٍ تُكتبُ الألفُ اللينةُ ألفًا ممدودةً (ا) إنْ كانَ أصلُها واوًا، "
    + "وتُكتبُ ألفًا مقصورةً (ى) إنْ كانَ أصلُها ياءً. "
    + "لا تُوجدُ قاعدةٌ تنطقيَّةٌ للتمييزِ — تُحفظُ بالقراءةِ.",
  words: [
    { grade: 5, correct: "أَعْطَى", wrong: ["أعطا"] },
    { grade: 5, correct: "اشْتَرَى", wrong: ["اشترا"] },
    { grade: 5, correct: "تَمَنَّى", wrong: ["تمنا"] },
    { grade: 5, correct: "يُصَلِّي", wrong: ["يصلى"] },
    { grade: 5, correct: "الدُّنْيَا", wrong: ["الدنيى"] },
    // "مستشفى" bare = same as correct bare; replace with "مستشفا" (ى→ا error).
    { grade: 5, correct: "مُسْتَشْفَى", wrong: ["مستشفا", "مستشفي"] },
    { grade: 5, correct: "إِلَّا", wrong: ["الا", "إلى"] },
    { grade: 5, correct: "مَتَى", wrong: ["متا"] },
  ],
};

/** اتصال الحروف بـ«الـ» التعريف */
const ittisalHurufBiAl: SpellingRule = {
  id: "ittissal-huruf-bi-al",
  nameAr: "اتصال الحروف بـ«الـ» التعريف",
  grades: [5],
  lessonIds: ["g5s2:u6_l4"],
  ruleAr:
    "حروفُ الجرِّ والعطفِ والاستئنافِ تتَّصلُ بـ«الـ» التعريفِ مباشرةً دونَ فصلٍ: "
    + "كـ(وَالشَّمس) و(فَالعِلم) و(لِلبَيت) و(بِالكِتاب). "
    + "الباءُ والكافُ واللامُ المكسورةُ تتَّصلُ أيضًا، وتُحذفُ همزةُ الوصلِ بعدَها.",
  words: [
    // Second wrong uses همزة قطع on ال (وأل-) — bare differs because أ ≠ ا.
    { grade: 5, correct: "وَالشَّمْس", wrong: ["و الشمس", "وألشمس"] },
    { grade: 5, correct: "بِالكِتَاب", wrong: ["ب الكتاب", "بألكتاب"] },
    { grade: 5, correct: "لِلْبَيْت", wrong: ["ل البيت", "لألبيت"] },
    { grade: 5, correct: "فَالعِلْم", wrong: ["ف العلم", "فألعلم"] },
    { grade: 5, correct: "كَالبَدْر", wrong: ["ك البدر", "كألبدر"] },
    { grade: 5, correct: "لِلطَّالِب", wrong: ["ل الطالب", "لألطالب"] },
  ],
};

/** الألف في نهاية الأفعال الثلاثية */
const alifNihayatAfal: SpellingRule = {
  id: "alif-nihayat-afal-thulathiya",
  nameAr: "الألف في نهاية الأفعال الثلاثية",
  grades: [5],
  lessonIds: ["g5s2:u7_l4"],
  variantClass: "final-alif-layyina",
  ruleAr:
    "الفعلُ الثلاثيُّ المعتلُّ الآخرِ إنْ كانَ أصلُ ألفِهِ واوًا كُتبَ بألفٍ ممدودةٍ (دَعَا، مَشَى لا — دَعَى). "
    + "وإنْ كانَ أصلُها ياءً كُتبَ بألفٍ مقصورةٍ (رَمَى، هَدَى). "
    + "للتمييزِ: طابقْ مضارعَهُ — (يَدْعُو → دَعَا)، (يَرْمِي → رَمَى).",
  words: [
    { grade: 5, correct: "دَعَا", wrong: ["دعى"] },
    { grade: 5, correct: "مَشَى", wrong: ["مشا"] },
    { grade: 5, correct: "رَمَى", wrong: ["رما"] },
    { grade: 5, correct: "هَدَى", wrong: ["هدا"] },
    { grade: 5, correct: "نَجَا", wrong: ["نجى"] },
    { grade: 5, correct: "سَعَى", wrong: ["سعا"] },
    { grade: 5, correct: "بَكَى", wrong: ["بكا"] },
    { grade: 5, correct: "تَلَا", wrong: ["تلى"], sentenceAr: "تَلَا الإمامُ القرآنَ" },
  ],
};

/** الهمزة المتطرفة مع تنوين الفتح */
const hamzaMutarrrafaTanwinFath: SpellingRule = {
  id: "hamza-mutarrafa-tanwin-fath",
  nameAr: "الهمزة المتطرفة مع تنوين الفتح",
  grades: [6],
  lessonIds: ["g6s2:u7_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "إذا نُوِّنَ الاسمُ المنتهي بهمزةٍ متطرِّفةٍ بالفتحِ: "
    + "إنِ انتهى بـ(ء) على الألفِ كُتبَ (ءًا): هواءً. "
    + "وإنِ انتهى بـ(ء) على السطرِ وقبلَها ألفٌ زِيدتِ الألفُ بعدَها: شَيْئًا. "
    + "وإنِ انتهى بـ(ء) وقبلَها غيرُ ألفٍ رُسمتْ الهمزةُ على الألفِ مع التنوينِ: جُزْءًا.",
  words: [
    // bare("هَوَاءً") = "هواء". Wrong needing to be bare-different:
    // "هواءا" → bare = "هواءا" ≠ "هواء" ✓; "هوائا" → bare = "هوائا" ≠ "هواء" ✓
    { grade: 6, correct: "هَوَاءً", wrong: ["هواءا", "هوائا"] },
    { grade: 6, correct: "مَاءً", wrong: ["ماءا", "مائا"] },
    // bare("شَيْئًا") = "شيئا". Wrong: "شيئ" → bare = "شيئ" ≠ "شيئا" ✓; "شيءا" → "شيءا" ≠ "شيئا" ✓
    { grade: 6, correct: "شَيْئًا", wrong: ["شيئ", "شيءا"] },
    // bare("جُزْءًا") = "جزءا". Wrong: "جزء" → bare = "جزء" ≠ "جزءا" ✓; "جزئا" → "جزئا" ≠ "جزءا" ✓
    { grade: 6, correct: "جُزْءًا", wrong: ["جزء", "جزئا"] },
    { grade: 6, correct: "دُفْئًا", wrong: ["دفء", "دفأ"] },
    { grade: 6, correct: "ضَوْءًا", wrong: ["ضوء", "ضوئا"] },
  ],
};

/** ألف التثنية بعد الهمزة المتطرفة */
const alifTathniyaBaadHamza: SpellingRule = {
  id: "alif-tathniya-baad-hamza",
  nameAr: "ألف التثنية بعد الهمزة المتطرفة",
  grades: [6],
  lessonIds: ["g6s2:u9_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "عندَ تثنيةِ الاسمِ المنتهي بهمزةٍ متطرِّفةٍ تُرسمُ الهمزةُ على الألفِ وبعدَها ألفُ التثنيةِ: "
    + "جُزْء → جُزْءَانِ، شَيْء → شَيْآنِ، هَوَاء → هَوَاآنِ.",
  words: [
    { grade: 6, correct: "جُزْءَان", wrong: ["جزآن", "جزيان"] },
    { grade: 6, correct: "شَيْآن", wrong: ["شيئان", "شيان"] },
    { grade: 6, correct: "هَوَاآن", wrong: ["هواءان", "هواءين"] },
    { grade: 6, correct: "ضَوْآن", wrong: ["ضوءان", "ضواءان"] },
    // "داءان" bare == bare(correct); replaced with "دائان" (ئ instead of ء).
    { grade: 6, correct: "دَاءَان", wrong: ["داءآن", "دائان"] },
  ],
};

/** حذف همزة (ابن) وإثباتها */
const hathfHamzatIbn: SpellingRule = {
  id: "hathf-hamzat-ibn",
  nameAr: "حذف همزة (ابن) وإثباتها",
  grades: [6, 7],
  lessonIds: ["g6s2:u10_l4", "g7s1:u4_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "تُحذفُ همزةُ «ابن» في الحالاتِ الثلاثِ: "
    + "١. إذا وقعَ بينَ علَمَيْنِ: مُحَمَّد بن عبد الله. "
    + "٢. إذا جاءَ بعدَ نداءٍ: يا ابنَ عمِّي — خطأٌ: يا ابن (تُحذف). "
    + "٣. في بدايةِ السطرِ بعدَ علَمٍ. "
    + "وتُثبتُ في غيرِ هذه الحالاتِ وفي أوَّلِ الجملةِ.",
  words: [
    // Single-word items cover all kinds (choose/judge/write/tap).
    // Rule: "ابن" keeps its hamza except between two proper names.
    { grade: 6, correct: "اِبْن", wrong: ["أبن", "إبن"], sentenceAr: "الاِبنُ البَارُّ يُطِيعُ وَالِدَيهِ" },
    { grade: 6, correct: "اِبنَة", wrong: ["أبنة", "إبنة"] },
    { grade: 6, correct: "اِبنَهُ", wrong: ["أبنه", "إبنه"] },
    { grade: 6, correct: "اِبنَيهِ", wrong: ["أبنيه", "إبنيه"] },
    { grade: 7, correct: "اِبنَهُمَا", wrong: ["أبنهما", "إبنهما"] },
    // "محمد بن علي" phrase gave partial credit (2/3 words ok). Single word instead.
    // bare("إبن") = "إبن" ≠ bare("بن") = "بن" ✓; not in taken (taken has "ابن" not "إبن")
    { grade: 6, correct: "بن", wrong: ["إبن"], sentenceAr: "مُحَمَّد بن عَلِي" },
  ],
};

/** الأسماء المبدوءة بـ(ال) بعد الباء والكاف واللام المكسورة */
const asmaMabduaBiAl: SpellingRule = {
  id: "asma-mabdua-bi-al",
  nameAr: "الأسماء المبدوءة بـ(ال) بعد الباء والكاف واللام المكسورة",
  grades: [7],
  lessonIds: ["g7s1:u3_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "عندَ اتِّصالِ الباءِ أو الكافِ أو اللامِ المكسورةِ بالاسمِ المبدوءِ بـ«ال»: "
    + "تُحذفُ همزةُ الوصلِ وتُدغمُ اللامُ إنِ اتَّصلتِ بحرفٍ شمسيٍّ: "
    + "(بِالشَّمس، كَالنَّجم، لِلطَّالب).",
  words: [
    // All wrong entries must bare-differ from correct.
    // "بالكتاب" bare = "بالكتاب". "بإلكتاب" ≠ "بالكتاب" ✓; "ب الكتاب" ≠ ✓
    { grade: 7, correct: "بِالكِتَاب", wrong: ["بإلكتاب", "ب الكتاب"] },
    { grade: 7, correct: "كَالبَدْر", wrong: ["كإلبدر", "ك البدر"] },
    { grade: 7, correct: "لِلْعَالِم", wrong: ["لإلعالم", "ل العالم"] },
    // "بالصدق" bare = "بالصدق" = same as correct bare → use "بإلصدق" + "ب الصدق" instead.
    { grade: 7, correct: "بِالصِّدْق", wrong: ["بإلصدق", "ب الصدق"] },
    // "للنجاح" bare = same as correct bare → use "لإلنجاح" + "ل النجاح" instead.
    { grade: 7, correct: "لِلنَّجَاح", wrong: ["لإلنجاح", "ل النجاح"] },
  ],
};

/** همزة الاستفهام على همزة الوصل */
const hamzatIstifhamAlaWasl: SpellingRule = {
  id: "hamzat-istifham-ala-wasl",
  nameAr: "همزة الاستفهام على الكلمات المبدوءة بهمزة الوصل",
  grades: [7],
  lessonIds: ["g7s1:u5_l4"],
  variantClass: "initial-hamza",
  ruleAr:
    "إذا دخلتْ همزةُ الاستفهامِ على كلمةٍ مبدوءةٍ بهمزةِ وصلٍ حُذفتِ همزةُ الوصلِ وكُتبتِ همزةُ الاستفهامِ مفتوحةً: "
    + "أَسْتَاذٌ؟ (همزة قطع) — أَسَّاذٌ؟ (لا تُكتب هكذا). "
    + "مثلُ: أَاسْتَقَامَ → أَاسْتَقَامَ (تُحذفُ همزةُ الوصلِ): آسْتَقَامَ.",
  words: [
    { grade: 7, correct: "آسْتَأْذَنتَ", wrong: ["أأستأذنت", "اأستأذنت"] },
    { grade: 7, correct: "آسْتَقَامَ", wrong: ["أأستقام", "اأستقام"], sentenceAr: "آسْتَقَامَ الوَلَدُ عَلى الصِّدقِ؟" },
    { grade: 7, correct: "آنْقَطَعَ", wrong: ["أأنقطع", "اأنقطع"] },
    { grade: 7, correct: "آتَّفَقَ", wrong: ["أأتفق", "اأتفق"] },
    { grade: 7, correct: "آصْطَفَّ", wrong: ["أأصطف", "اأصطف"] },
  ],
};

/**
 * Every rule, in the order a pupil meets them.
 */
export const SPELLING_RULES: readonly SpellingRule[] = [
  hamzaWaslQat,
  taaMarbutaHaa,
  alifFariqa,
  lamShamsiyaQamariya,
  hathaHathihi,
  hamzatAlMadd,
  hamzaMutawassita,
  hurufTuntaqLaTuktab,
  nunSakinaTanwin,
  hamzaMutarrafa,
  tanwinAlFath,
  alifLayyinaFawqThulathiya,
  ittisalHurufBiAl,
  alifNihayatAfal,
  hamzaMutarrrafaTanwinFath,
  alifTathniyaBaadHamza,
  hathfHamzatIbn,
  asmaMabduaBiAl,
  hamzatIstifhamAlaWasl,
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
