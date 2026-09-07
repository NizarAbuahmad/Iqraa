/**
 * Every word here was taken from the extracted corpus, not invented, so a
 * change that passes these has been checked against text the pipeline
 * actually produced. The counts in the comments are occurrences on file.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  untransposeWord,
  untransposeText,
  untransposeDocument,
  reattachMarks,
  repairLigatureWord,
  repairNegations,
  repairExtraction,
  countRepairs,
} from '../../scripts/untranspose.ts';

/** Class 1 and 2 never consult the document, so this stands in for it. */
const never = () => false;
const always = () => true;

describe('untransposeWord — class 1, alef + hamza carrier + lam', () => {
  it('repairs without needing any evidence', () => {
    assert.equal(untransposeWord('اإلنسان', never), 'الإنسان');
    assert.equal(untransposeWord('األردنية', never), 'الأردنية');
    assert.equal(untransposeWord('اإليداع', never), 'الإيداع');
    assert.equal(untransposeWord('اآلتية', never), 'الآتية');
  });

  it('carries each letter\'s marks with it through the swap', () => {
    // 211 of the 21,927 unambiguous instances carry a mark inside the three
    // letters the swap touches. A mark belongs to the base it follows, so it
    // travels with that base rather than staying in its slot.
    //
    // Which base a mark belonged to *before* the glyphs were reordered is not
    // recoverable — the reordering moved marks too. Only the base letters are
    // guaranteed correct here; the vowelling of these 211 is best-effort, and
    // that is the right trade when the alternative is leaving the consonants
    // scrambled.
    assert.equal(untransposeWord('اُألُردن', never), 'اُلُأردن');
    assert.equal(untransposeWord('األولُ', never), 'الأولُ');
  });
});

describe('untransposeWord — class 2, alef + alef + lam', () => {
  it('repairs the article before a hamzat-wasl alef', () => {
    assert.equal(untransposeWord('االقتران', never), 'الاقتران');
    assert.equal(untransposeWord('االحتكاك', never), 'الاحتكاك');
    assert.equal(untransposeWord('االستنتاج', never), 'الاستنتاج');
  });
});

describe('untransposeWord — الله', () => {
  it('rotates rather than swapping', () => {
    // The generic swap would give «الهل».
    assert.equal(untransposeWord('اهلل', never), 'الله');
  });

  it('keeps whatever follows', () => {
    assert.equal(untransposeWord('اهللم', never), 'اللهم');
  });
});

describe('untransposeWord — class 3, alef + consonant + lam', () => {
  it('repairs when the stem is attested', () => {
    assert.equal(untransposeWord('املناهج', always), 'المناهج');
    assert.equal(untransposeWord('اململكة', always), 'المملكة');
    assert.equal(untransposeWord('اهلاشمية', always), 'الهاشمية');
  });

  it('leaves the word alone when the stem is not attested', () => {
    assert.equal(untransposeWord('املناهج', never), 'املناهج');
  });

  it('never corrupts a real word that merely matches the shape', () => {
    // «اسلوب» -> «السوب» is the damage a blind rule does. The stem «سوب» is
    // not a word, so no document attests it and the guard holds.
    const attested = (s: string) => s === 'مناهج';
    assert.equal(untransposeWord('اسلوب', attested), 'اسلوب');
    assert.equal(untransposeWord('اعلان', attested), 'اعلان');
    assert.equal(untransposeWord('اطلاق', attested), 'اطلاق');
  });

  it('will not read a proclitic in front of an ambiguous body', () => {
    // Regression. «كامل» (complete) parsed as ك + «امل» became «كالم»
    // (speech): two real words, silently swapped, 10 times in the corpus.
    // Class 3 is word-initial only for exactly this reason.
    assert.equal(untransposeWord('كامل', always), 'كامل');
    assert.equal(untransposeWord('كاملة', always), 'كاملة');
    assert.equal(untransposeWord('بفاعلية', always), 'بفاعلية');
    assert.equal(untransposeWord('كارل', always), 'كارل');
    assert.equal(untransposeWord('فواصل', always), 'فواصل');
  });

  it('will not act on a stem too short to be evidence', () => {
    // Regression. «اطلب» (I request) offers the stem «طب», which occurs in
    // any Arabic document by accident, and became «الطب» (medicine).
    assert.equal(untransposeWord('اطلب', always), 'اطلب');
    assert.equal(untransposeWord('اقل', always), 'اقل');
    assert.equal(untransposeWord('اسل', always), 'اسل');
  });

  it('declines broken-font garbage instead of rewriting it', () => {
    // 52 occurrences. A cmap failure, not a transposition — repairing it here
    // would hide a defect that needs a different fix.
    assert.equal(untransposeWord('ازلبػ', never), 'ازلبػ');
  });
});

describe('untransposeWord — the article behind a proclitic', () => {
  it('repairs after و ف ب ك', () => {
    // 2,612 occurrences sit behind a proclitic, 12% on top of the
    // word-initial ones. و alone accounts for 1,600.
    assert.equal(untransposeWord('واألرض', never), 'والأرض');
    assert.equal(untransposeWord('واإلسرار', never), 'والإسرار');
    assert.equal(untransposeWord('بااللتزام', never), 'بالالتزام');
    assert.equal(untransposeWord('فاألول', never), 'فالأول');
  });

  it('repairs behind two stacked proclitics', () => {
    assert.equal(untransposeWord('وباألرض', never), 'وبالأرض');
  });

  it('refuses a prefix that is not a proclitic', () => {
    // «ناإلنسا» is «الإنسان» with its letters rotated — a different failure.
    // Treating the ن as a prefix would rewrite corruption into text that
    // looks repaired and is not.
    assert.equal(untransposeWord('ناإلنسا', never), 'ناإلنسا');
    assert.equal(untransposeWord('مجاألمر', never), 'مجاألمر');
  });

  it('does not treat ل as a proclitic here', () => {
    // ل assimilates into the article («للإنسان»), so this shape is not the
    // case being repaired.
    assert.equal(untransposeWord('لاألرض', never), 'لاألرض');
  });
});

describe('untransposeWord — leaves everything else alone', () => {
  it('ignores words that are already correct', () => {
    for (const w of ['الإنسان', 'الحركة', 'المناهج', 'الله', 'حركة', 'في']) {
      assert.equal(untransposeWord(w, always), w, w);
    }
  });

  it('ignores words too short to carry an article', () => {
    assert.equal(untransposeWord('ال', always), 'ال');
    assert.equal(untransposeWord('اإل', never), 'الإ');
  });
});

describe('untransposeDocument', () => {
  it('scores class 3 against the whole document, not one page', () => {
    // «مناهج» appears only on the second page; the repair on the first has to
    // see it, or the result depends on where in the book a word falls.
    const [first, second] = untransposeDocument(['املناهج', 'مناهج جديدة']);
    assert.equal(first, 'المناهج');
    assert.equal(second, 'مناهج جديدة');
  });

  it('does not repair class 3 when nothing in the document attests it', () => {
    assert.deepEqual(untransposeDocument(['اسلوب جديد']), ['اسلوب جديد']);
  });

  it('repairs inside running text and keeps the rest byte-for-byte', () => {
    const before = 'صدر اإلعالن العاملي حلقوق اإلنسان عام 1948م.';
    const after = untransposeText(before);
    assert.match(after, /الإعالن/);
    assert.match(after, /الإنسان/);
    assert.match(after, /1948م\./, 'digits and punctuation are untouched');
  });

  it('is a no-op on text that has no defect', () => {
    const clean = 'الحركة الميكانيكية في المستوى المائل.';
    assert.equal(untransposeText(clean), clean);
  });
});

describe('reattachMarks', () => {
  it('puts a detached case ending back on its letter', () => {
    // Verbatim from chem-s1-student-book page 16.
    assert.equal(
      reattachMarks('فرضيات ُ نظرية ِ بور'),
      'فرضياتُ نظريةِ بور',
    );
    assert.equal(
      reattachMarks('أسهمَت ِ القوانين ُ والنظريات ُ الفيزيائية ُ'),
      'أسهمَتِ القوانينُ والنظرياتُ الفيزيائيةُ',
    );
  });

  it('leaves a mark with nothing before it alone', () => {
    // Pulling this onto the previous page's last word would be worse than
    // leaving it where the extractor put it.
    assert.equal(reattachMarks(' ُ نظرية'), ' ُ نظرية');
  });

  it('does not touch marks that are already attached', () => {
    const ok = 'فرضياتُ نظريةِ بور';
    assert.equal(reattachMarks(ok), ok);
  });

  it('does not join across a line break into a different word', () => {
    // The mark still belongs to the word it follows, newline or not.
    assert.equal(reattachMarks('نظرية\n ِ بور'), 'نظريةِ بور');
  });
});

describe('repairLigatureWord', () => {
  it('repairs a لا the wordlist attests', () => {
    assert.equal(repairLigatureWord('الخاليا'), 'الخلايا');
    assert.equal(repairLigatureWord('هؤالء'), 'هؤلاء');
    assert.equal(repairLigatureWord('إال'), 'إلا');
    assert.equal(repairLigatureWord('والصالة'), 'والصلاة');
    assert.equal(repairLigatureWord('الالزمة'), 'اللازمة');
  });

  it('backs off once a book proves the other reading is also a word', () => {
    // «العالقة» was repaired to «العلاقة» (the relationship) while the wordlist
    // was built from eleven OCR books. The earth-science teacher's guide then
    // came in using «المواد العالقة» — suspended matter — 42 times, which is
    // real Arabic and exactly the term that subject needs. Both readings now
    // have evidence, so the rule declines rather than picking the commoner one.
    //
    // It costs yield: ligature repairs across the corpus fell from ~3,741 to
    // 1,189 as the OCR corpus doubled and taught the blocking set more real
    // words. That is the guard working, not degrading.
    assert.equal(repairLigatureWord('العالقة'), 'العالقة');
  });

  it('leaves a word the OCR books also spell that way', () => {
    // The block half of the rule. Every one of these is a word the books
    // meant; without it «مثال» alone is corrupted 651 times.
    assert.equal(repairLigatureWord('مثال'), 'مثال');
    assert.equal(repairLigatureWord('الثالث'), 'الثالث');
    assert.equal(repairLigatureWord('ثالثة'), 'ثالثة');
    assert.equal(repairLigatureWord('قال'), 'قال');
    assert.equal(repairLigatureWord('حال'), 'حال');
  });

  it('leaves a legitimate internal ال alone', () => {
    for (const w of ['العالم', 'العالمية', 'الحالة', 'الرسالة', 'الآلة', 'الطالب', 'معالم']) {
      assert.equal(repairLigatureWord(w), w, w);
    }
  });

  it('finds a form the list only knows without its proclitic', () => {
    // The list has «السلامة» (38 sightings) but never «والسلامة», so the
    // whole-word lookup misses and the و has to come off first.
    assert.equal(repairLigatureWord('والسالمة'), 'والسلامة');
    assert.equal(repairLigatureWord('بداللة'), 'بدلالة');
    assert.equal(repairLigatureWord('بالعالقة'), 'بالعلاقة');
  });

  it('still blocks when the stripped body is itself a real word', () => {
    // «مثال» is attested, so «ومثال» must not be repaired either.
    assert.equal(repairLigatureWord('ومثال'), 'ومثال');
    assert.equal(repairLigatureWord('والثالث'), 'والثالث');
  });

  it('leaves a word neither list has seen', () => {
    // Coverage is bounded by the OCR books' vocabulary, and an unknown word
    // is left alone rather than guessed at.
    assert.equal(repairLigatureWord('زقالمثيل'), 'زقالمثيل');
  });

  it('does not touch the word-initial article, which is not its job', () => {
    assert.equal(repairLigatureWord('الكتاب'), 'الكتاب');
  });
});

describe('repairNegations', () => {
  const fix = (s: string): string => repairNegations([s])[0];

  it('restores the negation before a word the evidence covers', () => {
    assert.equal(fix('ال يمكن قياسه'), 'لا يمكن قياسه');
    assert.equal(fix('ال يجوز'), 'لا يجوز');
    assert.equal(fix('وال يبتعد عنه'), 'ولا يبتعد عنه');
    assert.equal(fix('ال أستنتج'), 'لا أستنتج');
  });

  it('leaves an article that merely came away from its noun', () => {
    // This is the failure the whole design exists to prevent: «ال» here is
    // «الصورة»'s article, and making it «لا» would negate the sentence.
    assert.equal(fix('طول الإطار ال صورة'), 'طول الإطار ال صورة');
    assert.equal(fix('ال تعليم'), 'ال تعليم');
    assert.equal(fix('ال نظام'), 'ال نظام');
    assert.equal(fix('ال أرض'), 'ال أرض');
  });

  it('leaves a word no evidence covers', () => {
    assert.equal(fix('ال زقالمثيل'), 'ال زقالمثيل');
  });

  it('does not touch a correctly attached article', () => {
    const ok = 'الكتاب المدرسي للصف العاشر';
    assert.equal(fix(ok), ok);
  });

  it('needs a following word at all', () => {
    assert.equal(fix('ال'), 'ال');
  });

  it('preserves the surrounding text byte-for-byte', () => {
    assert.equal(fix('يُذكر أنّه ال يمكن ذلك، (٢٠٢٦).'), 'يُذكر أنّه لا يمكن ذلك، (٢٠٢٦).');
  });
});

describe('repairExtraction', () => {
  it('reattaches marks before repairing the article, so words are whole', () => {
    const [out] = repairExtraction(['اإلنسان ُ واألرض']);
    assert.equal(out, 'الإنسانُ والأرض');
  });

  it('repairs the article before the ligature, so a word carrying both is finished', () => {
    // «اإلسالم» needs the article put back to become «الإسالم» before the
    // ligature rule can recognise it. Either step alone leaves it broken.
    assert.deepEqual(repairExtraction(['اإلسالم']), ['الإسلام']);
  });
});

describe('countRepairs', () => {
  it('counts changed words, not changed pages', () => {
    const before = ['اإلنسان واألرض', 'حركة'];
    const after = untransposeDocument(before);
    assert.equal(countRepairs(before, after), 2);
  });

  it('is zero when nothing changed', () => {
    const pages = ['الحركة', 'المناهج'];
    assert.equal(countRepairs(pages, untransposeDocument(pages)), 0);
  });
});
