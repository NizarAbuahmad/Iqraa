/**
 * "Where do I find X?" is answered from the app's own map.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/appHelp.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { answerAppHelp, findAppPlaces, isAppHelpQuery } from '../appHelp.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import { toolAskFromQuery } from '../chatToolAsk.ts';

const top = (q: string) => findAppPlaces(q)[0]?.id;

describe('isAppHelpQuery', () => {
  const help = [
    'وين ألاقي الاختبارات؟',
    'أين أجد المواد المحفوظة',
    'كيف أفتح الإعدادات',
    'وين الشعب تبعتي',
    'where can I find my saved materials?',
    'how do I open settings',
    'وين الزر اللي بغير اللغة',
  ];
  for (const q of help) {
    it(`claims «${q}»`, () => assert.equal(isAppHelpQuery(q), true));
  }

  const notHelp = [
    'أين تقع البتراء؟',           // geography, nothing app-shaped
    'اشرح قانون جيب التمام',
    'أنشئ ورقة عمل عن المشتقات',
    'ما هو الجدول الدوري؟',       // «جدول» without a where-phrase
    'where is the vertex of a parabola?',
  ];
  for (const q of notHelp) {
    it(`leaves «${q}» alone`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

describe('findAppPlaces', () => {
  const cases: Array<[string, string]> = [
    ['وين ألاقي الاختبارات؟', 'tool:evaluations'],
    ['أين أجد المواد المحفوظة', 'workspace'],
    ['وين الشعب تبعتي', 'classes'],
    ['وين جدول الحصص', 'schedule'],
    ['وين خطط التدريس', 'teaching-plans'],
    ['كيف أفتح الإعدادات', 'settings'],
    ['وين ألاقي ورقة العمل', 'tool:worksheet'],
    ['وين أعمل عرض شرائح', 'tool:slides'],
    ['وين الرسائل', 'notifications'],
    ['where can I find my saved materials?', 'workspace'],
  ];
  for (const [q, id] of cases) {
    it(`«${q}» → ${id}`, () => assert.equal(top(q), id));
  }

  it('prefers the longer phrase: «اختبار قصير» is the quiz, not a test', () => {
    assert.equal(top('وين الاختبار القصير'), 'tool:quiz');
  });

  it('does not match inside a longer word', () => {
    assert.equal(findAppPlaces('وين الجداول الإحصائية').some(p => p.id === 'schedule'), false);
  });
});

describe('answerAppHelp', () => {
  const t = (k: string) => `<${k}>`;

  it('names the path to the place and offers it as a button', () => {
    const a = answerAppHelp('وين ألاقي الاختبارات؟', 'ar', t);
    assert.equal(a.places[0]!.id, 'tool:evaluations');
    assert.match(a.text, /<tabTools> ← <toolsAfterClass> ← <evaluations>/);
  });

  it('falls back to the FAQ when nothing matched', () => {
    const a = answerAppHelp('وين الزر اللي بغير اللغة يا ترى في التطبيق', 'ar', t);
    // «اللغة» is a settings keyword; drop it to exercise the fallback.
    const b = answerAppHelp('وين الزر في التطبيق', 'ar', t);
    assert.equal(a.places[0]!.id, 'settings');
    assert.deepEqual(b.places.map(p => p.id), ['faq']);
  });
});

describe('"how do I" questions about the app', () => {
  const t = (k: string) => `<${k}>`;

  const how = [
    'how to add more clases',                        // the typo that was actually typed
    'now i teach grade 10 how to add grade 8',
    'كيف أضيف شعبة جديدة؟',
    'كيف أضيف صف ثامن',
    'how do I export my lesson plan',
    'how do I start the class on the projector',
    'كيف أغيّر الدرس',
    'كيف أستخدم التطبيق؟',
  ];
  for (const q of how) {
    it(`claims «${q}»`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q).intent, 'app_help');
    });
  }

  const teaching = [
    'كيف أجمع الكسور',
    'how to add fractions',
    'كيف أشرح الاقترانات',
    'كيف أبسّط الكسر',
    'how do I use the quadratic formula',
    'how can I explain grade 10 functions',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => assert.equal(isAppHelpQuery(q), false));
  }

  it('«how to add more clases» gives the add-class steps and opens /classes', () => {
    const a = answerAppHelp('how to add more clases', 'en', t);
    assert.equal(a.text, '<howAddClass>');
    assert.deepEqual(a.places.map(p => [p.id, p.route]), [['classes', '/classes']]);
  });

  it('«how to add grade 8» gives the add-grade steps and opens the subject editor', () => {
    const a = answerAppHelp('now i teach grade 10 how to add grade 8', 'en', t);
    assert.equal(a.text, '<howAddGrade>');
    assert.deepEqual(a.places.map(p => [p.id, p.route, p.routeParams?.mode]), [['subjects', '/setup-subjects', 'edit']]);
  });

  it('reuses the FAQ answers for start-class, change-lesson and export', () => {
    assert.equal(answerAppHelp('how do I start the class on the projector', 'en', t).text, '<faqA7>');
    assert.equal(answerAppHelp('كيف أغيّر الدرس', 'ar', t).text, '<faqA2>');
    assert.equal(answerAppHelp('how do I export to pdf', 'en', t).text, '<faqA4>');
  });

  it('a "where" question about the same place still lists the path, not the steps', () => {
    const a = answerAppHelp('وين الشعب تبعتي', 'ar', t);
    assert.match(a.text, /<tabProfile> ← <myClasses>/);
  });

  it('a grade named inside another ask does not turn into the subject editor', () => {
    assert.notEqual(top('how do I export a grade 10 quiz'), 'subjects');
  });
});

// Reported 2026-10-10 from the web chat: «where i can add more classes to my
// account» came back as «سؤالك قد يخص أكثر من مادة. أيّ مادة تقصد؟». The gate
// only knew «where can / is / are / do», so the order people actually type
// («where i can …», «where to …») and the plain yes/no form («can i add …»)
// never reached the app map, fell through to the teaching pipeline, and ended
// in a subject question about a sentence that had no subject in it.
describe('natural English phrasings of a where / can-I question', () => {
  const help = [
    'where i can add more classes to my account',   // the one that was reported
    'where i can find my saved materials',
    'where we can change the language',
    'where to change the language',
    'where should i go to add a class',
    'can i add more classes to my account',
    'can I export my lesson plan',
  ];
  for (const q of help) {
    it(`claims «${q}»`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, 'en').intent, 'app_help');
    });
  }

  it('«where i can add more classes to my account» points at My classes', () => {
    const t = (k: string) => `<${k}>`;
    const ans = answerAppHelp('where i can add more classes to my account', 'en', t);
    assert.equal(ans.places[0]?.id, 'classes');
    assert.equal(ans.places[0]?.route, '/classes');
  });

  // The same words with a teaching object name no place and no app noun. The
  // «can we create a quiz …» line is a request to the assistant, not a question
  // about the app, even though «quiz» and «students» are both place keywords.
  const teaching = [
    'where i can use the quadratic formula',
    'where to find the vertex of a parabola',
    'where should i start with fractions',
    'can i add fractions with different denominators',
    'can we create a quiz for the students to solve',
    'can I save time by factoring first',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

// The phrasings #978 left out: plain statements («add more classes to my
// account», «i want to add another class») and the other ways of asking
// («is there a way to…», «ممكن اضيف…»). A statement names no where/how word,
// so it is claimed only for the account's own two lists, classes and grades or
// subjects, and only when the message ends on that object: «add a class of
// compounds to the table» and «add a class activity on fractions» are teaching.
describe('statements and other openers about the account', () => {
  const t = (k: string) => `<${k}>`;

  const claims = [
    'add more classes to my account',
    'add a new class to my account',
    'add a class',
    'please add a class',
    'i want to add another class',
    'i want to add more classes to my account',
    'i need to add a new class',
    'let me add a class',
    'help me add a class',
    'i want to add grade 8',
    'i need to add another subject',
    'is there a way to add more classes',
    'is it possible to add another class',
    'any way to add a grade',
    'اريد اضافة شعبة جديدة',
    'بدي اضيف شعبة',
    'ابغى اضيف صف ثامن',
    'اضف شعبة',
    'لازم اضيف شعبة اخرى',
    'عاوز اضيف شعبة',
    'هل يمكنني اضافة شعبة؟',
    'ممكن اضيف شعبة جديدة',
    'هل اقدر اضيف صف',
  ];
  for (const q of claims) {
    it(`claims «${q}»`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, /[؀-ۿ]/.test(q) ? 'ar' : 'en').intent, 'app_help');
    });
  }

  it('answers an add-a-class statement with the steps and opens /classes', () => {
    for (const q of ['add more classes to my account', 'i want to add another class', 'بدي اضيف شعبة']) {
      const a = answerAppHelp(q, /[؀-ۿ]/.test(q) ? 'ar' : 'en', t);
      assert.equal(a.text, '<howAddClass>', q);
      assert.equal(a.places[0]?.route, '/classes', q);
    }
  });

  it('answers an add-a-grade statement with the grade steps', () => {
    for (const q of ['i want to add grade 8', 'i need to add another subject', 'ابغى اضيف صف ثامن']) {
      const a = answerAppHelp(q, /[؀-ۿ]/.test(q) ? 'ar' : 'en', t);
      assert.equal(a.text, '<howAddGrade>', q);
    }
  });

  // Real teaching requests built from the same words. None may become app help,
  // and the ones that generate material must still reach the generator.
  const teaching = [
    'add fractions with different denominators',
    'i want to add fractions',
    'i want to add a class activity on fractions',
    'add a class of compounds to the table',
    'i need to add another class of organic compounds',
    'please add three more questions to the quiz',
    'i want to add grade 8 questions to the quiz',
    'i want to add a subject heading to the worksheet',
    'is it possible to add fractions with different denominators',
    'any way to add these fractions quickly',
    'is it possible to create a quiz about fractions',
    'اريد اضافة سؤال الى الاختبار',
    'اضف سؤالا عن الكسور',
    'بدي اضيف نشاط صفي عن الكسور',
    'ممكن انشئ اختبار عن الكسور',
    'هل يمكنني جمع الكسور بدون توحيد المقامات',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, /[؀-ۿ]/.test(q) ? 'ar' : 'en').intent, 'app_help');
    });
  }

  it('«class of compounds» and «class activity» are not the Classes screen', () => {
    assert.notEqual(top('where can i find classes of compounds'), 'classes');
    assert.notEqual(top('where can i find the class activity'), 'classes');
    assert.equal(top('where can i find my classes'), 'classes');
  });
});

// The four things #980 listed as still not claimed. Each is claimed on a rule
// as narrow as the one before it, because none of them has a where/how word:
//  - a problem («i can't find my classes») only when it names an account screen,
//    never a generator, since «i can't find a good worksheet» asks for one;
//  - a longer add («add a class for grade 9») only with a grade, name or count;
//  - a bare «i want to add a grade» only with first-person intent;
//  - another screen («i want to change the language») only when the message ends
//    on the place it names, so «change the lesson to be shorter» stays teaching.
describe('problems, longer adds, bare grades and other screens', () => {
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');

  const claims = [
    // problems
    "i can't find my classes",
    'i cannot see my saved materials',
    "i don't see my classes",
    'my classes are missing',
    'my class list is empty',
    'where did my classes go',
    "i can't add a class",
    'i am unable to add a class',
    "i can't open settings",
    'ما لقيت شعبتي',
    'ما لقيت المواد المحفوظة',
    'مش لاقي الاعدادات',
    'اختفت شعبي',
    // a longer add
    'add a class for grade 9',
    'i want to add another class for grade 8',
    'add a class called 9A',
    'i want to add a class named Grade 9B',
    'add class 9B',
    'اضف شعبة للصف التاسع',
    'بدي اضيف شعبة باسم تاسع ب',
    // a bare grade or subject
    'i want to add a grade',
    'i need to add a subject',
    'add a grade to my account',
    'add a subject to my profile',
    'بدي اضيف صف',
    'اريد اضافة مادة',
    // other screens
    'i want to export my worksheet',
    'i want to change the language',
    'i want to change the lesson',
    'i need to open settings',
    'i want to see my saved materials',
    'i want to start the class',
    'بدي اغير اللغة',
    'اريد تصدير ورقة العمل',
    'بدي افتح الاعدادات',
  ];
  for (const q of claims) {
    it(`claims «${q}»`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }

  it('a problem finding something lists where it is; a problem adding gives the steps', () => {
    const find = answerAppHelp("i can't find my classes", 'en', t);
    assert.equal(find.places[0]?.id, 'classes');
    assert.match(find.text, /<tabProfile> → <myClasses>/);
    assert.equal(answerAppHelp("i can't add a class", 'en', t).text, '<howAddClass>');
  });

  it('a longer add gets the add-a-class steps', () => {
    for (const q of ['add a class for grade 9', 'add class 9B', 'اضف شعبة للصف التاسع']) {
      assert.equal(answerAppHelp(q, lang(q), t).text, '<howAddClass>', q);
    }
  });

  it('a bare grade or subject gets the add-a-grade steps', () => {
    for (const q of ['i want to add a grade', 'add a subject to my profile', 'بدي اضيف صف', 'اريد اضافة مادة']) {
      assert.equal(answerAppHelp(q, lang(q), t).text, '<howAddGrade>', q);
    }
  });

  it('a statement about another screen gets that screen’s steps, or its path', () => {
    assert.equal(answerAppHelp('i want to export my worksheet', 'en', t).text, '<faqA4>');
    assert.equal(answerAppHelp('اريد تصدير ورقة العمل', 'ar', t).text, '<faqA4>');
    assert.equal(answerAppHelp('i want to change the lesson', 'en', t).text, '<faqA2>');
    assert.equal(answerAppHelp('i want to start the class', 'en', t).text, '<faqA7>');
    // The language got the path to Settings until 2026-10-18; it has steps now.
    const lang1 = answerAppHelp('i want to change the language', 'en', t);
    assert.equal(lang1.places[0]?.id, 'language');
    assert.equal(lang1.text, '<faqA16>');
  });

  it('«how do I export my lesson plan» now gets the export steps, not the lesson-plan tool path', () => {
    assert.equal(answerAppHelp('how do I export my lesson plan', 'en', t).text, '<faqA4>');
    // …and a how-question about a tool that is not an export is unchanged.
    assert.notEqual(answerAppHelp('how do I add a worksheet for my class', 'en', t).text, '<faqA4>');
  });

  // Look-alikes built from the same words. None may become app help.
  const teaching = [
    "i can't find a good worksheet on fractions",
    "i can't find a good activity for fractions",
    "i don't see how to add fractions",
    "i can't add these fractions",
    "i can't see the pattern in this sequence",
    'my classes are noisy, give me a calming activity',
    "i can't find the roots of this equation",
    'where did the Romans go after Carthage',
    'add a class for fractions',
    'i want to add a class discussion about fractions',
    'add class notes to the lesson plan',
    'i want to add a grade column to the worksheet',
    'i need to add a subject line to the email',
    'add a grade to each student',
    'i want to add a grade to this student',
    'i want to export the data to a table',
    'i want to change the quiz language to english',
    'i want to change the lesson to be shorter',
    'i want to save time on marking',
    'i want to open with a question',
    'i want to see how fractions are added',
    'i want to start the lesson with a game',
    'i want to find the best game for students',
    'i want to check the answers of the students',
    'ما لقيت حل المعادلة',
    'ما اقدر اجمع الكسور',
    'بدي اغير نشاط الدرس',
    'اريد تصدير البيانات الى جدول',
    'اريد اضافة صف الى الجدول',
    'بدي افتح الدرس بسؤال',
    // Found by the adversarial run, not by guessing: the first version of the
    // problem rule took «a problem phrase + any screen word» and claimed all ten.
    "i can't find the settings of the equation",
    "i don't see the schedule of the reaction",
    'my students are missing the point of fractions',
    'my class is empty of ideas for this lesson',
    'the schedule is missing a break',
    'my account of the war is missing detail',
    'my saved time is gone',
    'where did the settings of the experiment go wrong',
    'ما لقيت الجدول الدوري في الكتاب',
    'ما لقيت المحفوظات في الدرس',
    // …and statements that held, kept so they keep holding.
    'i want to change the settings of the experiment',
    'i want to start the class with a quiz',
    'i want to edit the schedule of the lesson',
    'بدي اشوف طلابي يحلون المسالة',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }
});

describe('a grade to change and a lesson to add', () => {
  // Reported from the web chat (2026-10-11): «اريد ان اغير الصف» and «i need to
  // add lesson» both came back as lesson replies about an unrelated topic. Neither
  // names a screen: the grades a teacher teaches live under «المواد التي أُدرّسها»,
  // and a lesson is picked from the bar above the chat rather than added.
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');

  const grade = [
    'i want to change the grade',
    'i need to change my grade',
    'i want to switch grade',
    'i would like to change the grade please',
    'اريد ان اغير الصف',
    'اريد تغيير الصف',
    'بدي اغير صفي',
    'ابغى اعدل الصفوف',
  ];
  const lesson = [
    'i need to add lesson',
    'i want to add a lesson',
    'i want to pick a lesson',
    'let me choose a lesson',
    'help me add a lesson',
    'اريد اضافة درس',
    'بدي اضيف درس جديد',
    'اريد اختيار الدرس',
    'محتاج اضيف درس',
  ];
  for (const q of grade) {
    it(`«${q}» gets the grade steps`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.deepEqual(findAppPlaces(q).map(p => p.id), ['subjects']);
      const a = answerAppHelp(q, lang(q), t);
      assert.equal(a.text, '<howAddGrade>');
      assert.equal(a.places[0]!.id, 'subjects');
    });
  }
  for (const q of lesson) {
    it(`«${q}» gets the change-lesson steps`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.deepEqual(findAppPlaces(q).map(p => p.id), ['change-lesson']);
      assert.equal(answerAppHelp(q, lang(q), t).text, '<faqA2>');
    });
  }

  const teaching = [
    // «grade» as a mark, a level or a boundary, with something after it
    'i want to change the grade of the quiz',
    'i want to change the grade on this worksheet to grade 8',
    'i want to change the grade boundaries',
    'i want to change the grade level of the worksheet',
    'change the grade',
    'change the grade of the exam',
    'how do i change the grade of a student',
    'i want to change the year of the exam',
    'اريد ان اغير الصف في ورقة العمل',
    'اريد تغيير الصف الى العاشر في الاختبار',
    'بدي اغير صف الطالب',
    // «lesson» as the thing to teach, not the one to pick
    'i need to add lesson plan',
    'i want to add a lesson plan for grade 9',
    'i want to add a lesson to the worksheet',
    'i want to add a lesson about fractions',
    'i want to add a lesson on photosynthesis',
    'i need to pick a lesson on fractions',
    'i want to choose a lesson for tomorrow',
    'i want to add the lesson to my plan',
    'i want to add lessons to the schedule',
    'اريد اضافة درس عن الكسور',
    'اريد اضافة درس الى الخطة',
    'اريد اختيار درس عن الاقترانات',
    'اريد اضافة درس جديد عن الجبر',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }

  it('does not fix a typo: «langute» is not «language»', () => {
    // Matching misspellings would also match real requests; the sentence works
    // when typed correctly, which is what the first screenshot showed.
    assert.equal(isAppHelpQuery('i want to change the langute'), false);
    assert.equal(isAppHelpQuery('i want to change the language'), true);
  });
});

describe('a matrix row is not a grade', () => {
  // «كيف أضيف صفاً إلى المصفوفة» got the add-a-grade steps through «اضيف صف».
  for (const q of [
    'كيف أضيف صفاً إلى المصفوفة؟',
    'كيف اضيف صف الى المصفوفة',
    'كيف أضيف صفاً جديداً للمصفوفة؟',
    'كيف أحذف صفاً من المصفوفة؟',
    'كيف أضيف صفوفاً في المصفوفة',
  ]) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, 'ar').intent, 'app_help');
    });
  }
  for (const q of ['كيف أضيف صفاً جديداً؟', 'كيف اضيف صف', 'بدي اضيف صف ثامن']) {
    it(`«${q}» still gets the grade steps`, () => {
      assert.equal(top(q), 'subjects');
    });
  }
});

describe('homework, exam date, scan, class chat, block, name, account, feedback, results actions', () => {
  // The second live pass (2026-10-17): each of these went to the model, which
  // invented menus («تبويب أدوات الذكاء الاصطناعي») or refused («كيف أحظر ولي
  // أمر» read as harmful). The steps come from the screens they name.
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');
  const steps: Array<[string, string]> = [
    ['كيف أرسل واجباً لطلابي؟', 'howAddHomework'],
    ['بدي اضيف واجب للشعبة', 'howAddHomework'],
    ['how do i add homework', 'howAddHomework'],
    ['كيف أضع موعداً لامتحان؟', 'howExamDate'],
    ['how do i set an exam date', 'howExamDate'],
    ['كيف أفعّل الوضع الليلي؟', 'howDarkMode'],
    ['وين الوضع الليلي؟', 'howDarkMode'],
    ['how do i enable dark mode', 'howDarkMode'],
    ['كيف أمسح ورقة الإجابة بالكاميرا؟', 'howClassScan'],
    ['how do i scan the answer sheets', 'howClassScan'],
    ['كيف أرسل رسالة لكل الشعبة؟', 'howClassChat'],
    ['how do i send a message to the whole class', 'howClassChat'],
    ['كيف أحظر ولي أمر؟', 'howBlock'],
    ['how do i block a parent', 'howBlock'],
    ['كيف أغير اسمي؟', 'howChangeName'],
    ['how do i change my name', 'howChangeName'],
    ['كيف أحذف حسابي؟', 'howDeleteAccount'],
    ['how do i delete my account', 'howDeleteAccount'],
    ['كيف أقترح ميزة جديدة؟', 'howSuggestFeature'],
    ['how do i suggest a feature', 'howSuggestFeature'],
    ['كيف أبلغ عن خطأ في ورقة العمل؟', 'howReportProblem'],
    ['how do i report a problem with the worksheet', 'howReportProblem'],
    ['كيف أعيد توليد ورقة العمل؟', 'howRegenerate'],
    ['how do i regenerate the quiz', 'howRegenerate'],
    ['كيف أحفظ خطة الدرس؟', 'howSaveMaterial'],
    ['how do i save the worksheet', 'howSaveMaterial'],
    ['كيف أختار درساً آخر؟', 'faqA2'],
    ['how do i choose another lesson', 'faqA2'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» gets ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.equal(answerAppHelp(q, lang(q), t).text, `<${key}>`);
    });
  }

  for (const q of ['وين ألاقي خطة الدرس اللي حفظتها؟', 'where are my saved worksheets']) {
    it(`«${q}» points at My files, not the generator`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.deepEqual(findAppPlaces(q).map(p => p.id), ['workspace']);
    });
  }

  it('dark mode no longer points at a Settings switch that does not exist', () => {
    assert.ok(!findAppPlaces('وين الوضع الليلي؟').some(p => p.id === 'settings'));
  });

  const teaching = [
    'أريد واجباً عن الكسور',
    'اعطني واجب منزلي عن الجبر',
    'how do i make homework more engaging',
    'كيف أكتب رسالة للطلاب عن القراءة؟',
    'كيف أحفظ جدول الضرب؟',
    'كيف أحفظ القصيدة؟',
    'كيف أختار درساً مناسباً لطلابي؟',
    'كيف أغير اسم المتغير؟',
    'كيف أحذف الحساب من المعادلة؟',
    'كيف أمسح السبورة؟',
    'كيف أعيد صياغة السؤال؟',
    'كيف أفعّل التعلم النشط في صفي؟',
    'كيف أبلغ الطلاب بموعد الامتحان؟',
    'how do i block distractions in class',
    'ما هو الوضع الليلي في الفيزياء؟',
    'how do i save time when marking',
    'كيف أصحح أوراق الطلاب؟',
    'how do i grade the exams',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }
});

describe('archive, link code, print, sign out, password and results', () => {
  // Found on app.iqrra.com (2026-10-17), with live AI on: «كيف أحذف شعبة؟» got the
  // add-a-class steps, «كيف أشارك رمز الربط مع أولياء الأمور؟» opened Messages, and
  // the other four went to the model, which guessed at menus or asked which app.
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');
  const steps: Array<[string, string, string]> = [
    ['كيف أحذف شعبة؟', 'howArchiveClass', '/classes'],
    ['كيف أحذف الشعبة القديمة', 'howArchiveClass', '/classes'],
    ['بدي امسح شعبة', 'howArchiveClass', '/classes'],
    ['how do i delete a class', 'howArchiveClass', '/classes'],
    ['كيف أشارك رمز الربط مع أولياء الأمور؟', 'howShareLinkCode', '/classes'],
    ['وين رمز الربط؟', 'howShareLinkCode', '/classes'],
    ['how do i share the link code with parents', 'howShareLinkCode', '/classes'],
    ['where is the join code', 'howShareLinkCode', '/classes'],
    ['كيف أطبع ورقة العمل؟', 'faqA4', '/ai-tools/worksheet'],
    ['how do i print a worksheet', 'faqA4', '/ai-tools/worksheet'],
    ['كيف أسجل الخروج؟', 'howSignOut', '/profile'],
    ['كيف اخرج من حسابي', 'howSignOut', '/profile'],
    ['how do i sign out', 'howSignOut', '/profile'],
    ['how do i log out', 'howSignOut', '/profile'],
    ['كيف أغير كلمة المرور؟', 'howChangePassword', '/profile'],
    ['نسيت كلمة المرور', 'howChangePassword', '/profile'],
    ['how do i change my password', 'howChangePassword', '/profile'],
    ['i forgot my password', 'howChangePassword', '/profile'],
  ];
  for (const [q, key, route] of steps) {
    it(`«${q}» gets ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      const a = answerAppHelp(q, lang(q), t);
      assert.equal(a.text, `<${key}>`);
      assert.equal(a.places[0]!.route, route);
    });
  }

  for (const q of ['كيف أشوف نتائج الطلاب؟', 'وين اشوف علامات الطلاب', 'how do i see my students results', 'where can i see the exam results']) {
    it(`«${q}» gets the path to the evaluations`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.deepEqual(findAppPlaces(q).map(p => p.id), ['tool:evaluations']);
    });
  }

  it('steps for adding never answer a question about removing', () => {
    // «كيف أحذف شعبة» had «اضغط شعبة جديدة» for an answer.
    assert.notEqual(answerAppHelp('كيف أحذف شعبتي من حسابي', 'ar', t).text, '<howAddClass>');
    assert.notEqual(answerAppHelp('كيف احذف الصفوف', 'ar', t).text, '<howAddGrade>');
  });

  const teaching = [
    'how do i delete a class of compounds from the table',
    'كيف أحذف الكسور من المعادلة؟',
    'كيف أطبع الحروف بشكل صحيح؟',
    'how do i create a strong password',
    'how do i change a password in excel',
    'كيف أختار كلمة مرور قوية؟',
    'كيف أعرف نتائج التجربة؟',
    'how do i check the results of the experiment',
    'كيف أخرج من المتاهة؟',
    'ما هو رمز الربط في الكيمياء؟',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }
});

describe('a student to add', () => {
  // Found on app.iqrra.com (2026-10-17): with live AI on, «كيف أضيف طالباً
  // جديداً؟» went to the model, which said it was about the app and gave no
  // steps. A student is added inside a class that exists, so it is not the
  // add-a-class answer either.
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');
  const asks = [
    'كيف أضيف طالباً جديداً؟',
    'كيف اضيف طالب جديد',
    'كيف أضيف طالب',
    'كيف أضيف طلاباً إلى الشعبة؟',
    'كيف اضيف طلاب للشعبة',
    'بدي اضيف طالب',
    'اريد اضافة اسماء الطلاب',
    'هل يمكنني اضافة طالب اخر؟',
    'كيف أسجل طالبة جديدة؟',
    'وين اضيف الطلاب؟',
    'how do i add a student',
    'how do i add students to my class',
    'i want to add a new student',
    'can i add another student',
    'where can i add students',
  ];
  for (const q of asks) {
    it(`«${q}» gets the add-a-student steps and opens My classes`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      const a = answerAppHelp(q, lang(q), t);
      assert.equal(a.text, '<howAddStudent>');
      assert.equal(a.places[0]!.route, '/classes');
    });
  }

  it('a new class still gets the add-a-class steps', () => {
    assert.equal(answerAppHelp('how do i add a new class', 'en', t).text, '<howAddClass>');
    assert.equal(answerAppHelp('كيف أضيف شعبة جديدة؟', 'ar', t).text, '<howAddClass>');
  });

  const teaching = [
    'كيف أضيف طالباً إلى مجموعة النقاش؟',
    'اريد اضافة طالب متفوق الى المسابقة',
    'كيف ادخل الطلاب في النقاش',
    'add a student to the group work',
    'how do i add a student character to the story',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }
});

describe('a grade written with its accusative ending («صفاً جديداً»)', () => {
  // Found on app.iqrra.com (2026-10-16): «كيف أضيف صفاً جديداً؟» was asked which
  // subject it meant, while «كيف اضيف صف جديد» got the steps. The ending is the
  // correct spelling, so each form must get exactly what its plain twin gets.
  const t = (k: string) => `<${k}>`;
  const twins: Array<[string, string]> = [
    ['كيف أضيف صفاً جديداً؟', 'كيف اضيف صف جديد'],
    ['كيف أضيف صفًا جديدًا؟', 'كيف اضيف صف جديد'],
    ['كيف اضيف صفا جديدا', 'كيف اضيف صف جديد'],
    ['كيف أضيف صفاً؟', 'كيف اضيف صف'],
    ['كيف أضيف صفاً إضافياً؟', 'كيف اضيف صف اضافي'],
    ['اريد ان اضيف صفاً جديداً', 'اريد ان اضيف صف جديد'],
    ['بدي أضيف صفاً ثامناً', 'بدي اضيف صف ثامن'],
    ['بدي اضيف صفا ثامنا', 'بدي اضيف صف ثامن'],
  ];
  for (const [q, twin] of twins) {
    it(`«${q}» gets the grade steps, as «${twin}» does`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, 'ar').intent, 'app_help');
      assert.equal(top(q), 'subjects');
      assert.deepEqual(answerAppHelp(q, 'ar', t), answerAppHelp(twin, 'ar', t));
    });
  }

  const teaching = [
    // An alif ending typed without its mark is part of the word, except on the
    // few words a grade is added with.
    'أين يقع جبل الصفا؟',
    'ما معنى كلمة صفا؟',
    'كيف أضيف عدداً جديداً إلى المتسلسلة؟',
    'أضف صفاً جديداً إلى الجدول',
    'ثانياً، كيف أحل المعادلة؟',
    'أريد مثالاً جديداً',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, 'ar').intent, 'app_help');
    });
  }
});

describe('sharing an exam, sending a worksheet, notifications, support, and what the app cannot do', () => {
  // The fourth live pass (2026-10-18): every one of these went to the model,
  // which invented menus or refused («how do i upload a pdf», «هل التطبيق
  // مجاني؟»), except the exam share, which got the add-a-class steps, and the
  // marks export, which got the PDF/Word export steps. Six ask for something
  // the app does not have, and their answer says so instead of inventing it.
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');
  const steps: Array<[string, string]> = [
    ['كيف أنشر الامتحان للطلاب؟', 'howShareExam'],
    ['كيف أشارك الاختبار مع طلابي؟', 'howShareExam'],
    ['how do i share an exam with my students', 'howShareExam'],
    ['how do i publish the exam', 'howShareExam'],
    ['كيف يدخل الطالب على الامتحان؟', 'howShareExam'],
    ['how do students open the exam', 'howShareExam'],
    ['كيف أعرف مين سلّم الامتحان؟', 'howExamSubmissions'],
    ['how do i see who submitted the exam', 'howExamSubmissions'],
    ['كيف أرسل ورقة العمل للطلاب ليحلوها على التطبيق؟', 'howSendWorksheet'],
    ['how do i send a worksheet to my students', 'howSendWorksheet'],
    ['كيف أوقف الإشعارات؟', 'howNotifications'],
    ['how do i turn off notifications', 'howNotifications'],
    ['كيف أتواصل مع الدعم الفني؟', 'howContactSupport'],
    ['how do i contact support', 'howContactSupport'],
    ['كيف أرفع ملف PDF من الكتاب؟', 'howUploadFile'],
    ['how do i upload a pdf', 'howUploadFile'],
    ['كيف أصدّر العلامات إلى إكسل؟', 'howExportMarks'],
    ['how do i export marks to excel', 'howExportMarks'],
    ['كيف أنسخ الامتحان لشعبة ثانية؟', 'howCopyExam'],
    ['how do i copy an exam to another class', 'howCopyExam'],
    ['كيف أدعو معلماً آخر؟', 'howInviteTeacher'],
    ['how do i invite another teacher', 'howInviteTeacher'],
    ['كيف أحمّل التطبيق على الجوال؟', 'howInstallApp'],
    ['how do i download the app on my phone', 'howInstallApp'],
    ['هل التطبيق مجاني؟', 'howPricing'],
    ['is the app free', 'howPricing'],
    ['كيف أضيف صورة للسؤال؟', 'howQuestionImage'],
    ['how do i add a picture to a question', 'howQuestionImage'],
    // Inviting the class is the link code, not a teacher invite.
    ['كيف أدعو أولياء الأمور؟', 'howShareLinkCode'],
    ['how do i invite parents', 'howShareLinkCode'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» gets ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.equal(answerAppHelp(q, lang(q), t).text, `<${key}>`);
    });
  }

  it('sharing an exam no longer opens My classes', () => {
    assert.notEqual(top('how do i share an exam with my students'), 'classes');
  });

  const teaching = [
    'كيف أرفع مستوى الطلاب؟',
    'كيف أرفع الروح المعنوية في الصف؟',
    'كيف أنشر الوعي البيئي بين الطلاب؟',
    'كيف أشارك الطلاب في الحصة؟',
    'كيف أعرف مين فهم الدرس؟',
    'how do i see who understood the lesson',
    'كيف أوقف الشغب في الصف؟',
    'how do i stop students talking',
    'كيف أتواصل مع الطلاب الخجولين؟',
    'how do i support struggling students',
    'كيف أحمّل الطلاب المسؤولية؟',
    'كيف أدعو الطلاب للمشاركة؟',
    'how do i invite students to participate',
    // A how-verb plus «students» used to be enough for My classes.
    'how do i make students listen',
    'كيف أشارك طلابي في النقاش؟',
    'كيف أنسخ المعادلة على السبورة؟',
    'هل الإلكترون حر في الفلز؟',
    'is the reaction spontaneous',
    'كيف أصف الصورة في السؤال؟',
    'كيف أحسب العلامات النهائية؟',
    'كيف أكتب سؤالاً عن الصورة؟',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }
});

describe('editing an exam, marks, results, printing, homework, one-to-one messages', () => {
  // The fifth live pass (2026-10-18): the exam's own buttons got a bare path
  // («تجده هنا: التقييمات»), «كيف أغلق الامتحان؟» got the make-an-exam line,
  // «كيف أعدّل علامة طالب؟» was asked which subject, and the rest went to the
  // model, which gave classroom advice, asked which app, or refused.
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');
  const steps: Array<[string, string]> = [
    ['كيف أحذف سؤالاً من الامتحان؟', 'howEditExamQuestions'],
    ['how do i delete a question from the exam', 'howEditExamQuestions'],
    ['how do i add my own question to the exam', 'howEditExamQuestions'],
    ['كيف أكتب أسئلة الامتحان بنفسي؟', 'howEditExamQuestions'],
    ['كيف أعدل سؤالاً في الامتحان؟', 'howEditExamQuestions'],
    ['كيف أغلق الامتحان؟', 'howCloseExam'],
    ['how do i close the exam', 'howCloseExam'],
    ['كيف أعدّل علامة طالب؟', 'howEditMark'],
    ["how do i change a student's mark", 'howEditMark'],
    ['كيف أعلن النتائج للطلاب؟', 'howReleaseResults'],
    ['how do i release the results to students', 'howReleaseResults'],
    ['كيف أطبع الامتحان؟', 'howPrintExam'],
    ['how do i print the exam', 'howPrintExam'],
    ['how do i print the worksheet without answers', 'howPrintStudentCopy'],
    ['كيف أطبع ورقة العمل بدون إجابات؟', 'howPrintStudentCopy'],
    ['كيف أعرض الدرس على السبورة الذكية؟', 'faqA7'],
    ['how do i show the lesson on the projector', 'faqA7'],
    ['كيف أغير موعد تسليم الواجب؟', 'howHomeworkDueDate'],
    ['how do i change the homework due date', 'howHomeworkDueDate'],
    ['how do i see my students homework', 'howHomeworkDone'],
    ['كيف أعرف مين أنجز الواجب؟', 'howHomeworkDone'],
    ['كيف أرسل رسالة لطالب واحد؟', 'howMessageOne'],
    ['كيف أراسل ولي أمر طالب؟', 'howMessageOne'],
    ['how do i message one student', 'howMessageOne'],
    ['كيف أغير لغة التطبيق إلى الإنجليزية؟', 'faqA16'],
    ['how do i change the app language', 'faqA16'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» gets ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.equal(answerAppHelp(q, lang(q), t).text, `<${key}>`);
    });
  }

  it('printing a worksheet still gets the export steps', () => {
    assert.equal(answerAppHelp('كيف أطبع ورقة العمل؟', 'ar', t).text, '<faqA4>');
  });

  const teaching = [
    'كيف أكتب سؤالاً جيداً؟',
    'كيف أكتب أسئلة تفكير ناقد؟',
    'كيف أغلق الحصة بنشاط ممتع؟',
    'how do i close the lesson',
    'كيف أعلن النتائج للطلاب بطريقة لطيفة؟',
    'كيف أعرض الفكرة على الطلاب؟',
    'كيف أرفع علامات الطلاب؟',
    'كيف أشجع الطلاب على حل الواجب؟',
    'كيف أتحدث مع طالب خجول؟',
    'how do i talk to a student about behaviour',
    'كيف أغير طريقة تدريسي؟',
    'كيف أنهي الاختبار في الوقت المحدد؟',
    'how do i write good exam questions',
    'كيف أحذف الأخطاء الشائعة عند الطلاب؟',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }
});

describe('a tool id that is a word, and new-item steps for a change', () => {
  // The sixth live pass (2026-10-18).
  const t = (k: string) => `<${k}>`;
  it('«how do i create a positive classroom» is a teaching question', () => {
    assert.equal(isAppHelpQuery('how do i create a positive classroom'), false);
    assert.notEqual(classifyChatIntent('how do i create a positive classroom', 'en').intent, 'app_help');
  });
  it('the interactive class is still found by its name', () => {
    assert.equal(top('where is the interactive class'), 'tool:classroom');
    assert.equal(top('وين الحصة التفاعلية؟'), 'tool:classroom');
  });
  const steps: Array<[string, string]> = [
    ['كيف أغير اسم الشعبة؟', 'howRenameClass'],
    ['how do i rename a class', 'howRenameClass'],
    ['كيف أحذف طالباً من الشعبة؟', 'howRemoveStudent'],
    ['how do i delete a student from my class', 'howRemoveStudent'],
    ['كيف أنقل طالباً لشعبة ثانية؟', 'howMoveStudent'],
    ['how do i move a student to another class', 'howMoveStudent'],
    ['كيف أربط ولي أمر بطالب؟', 'howLinkParent'],
    ['how do i link a parent to a student', 'howLinkParent'],
    ['كيف أعيد رمز الدخول لطالب؟', 'howReissueLoginCode'],
    ['الطالب نسي رمز الدخول', 'howReissueLoginCode'],
    ['كيف يسجل الطالب الدخول؟', 'howStudentSignIn'],
    ['how do students sign in', 'howStudentSignIn'],
    ['كيف أنشئ مجموعة دعم؟', 'howSupportGroups'],
    ['وين مجموعات الدعم؟', 'howSupportGroups'],
    ['كيف أرسل إعلاناً لكل أولياء الأمور؟', 'howBroadcast'],
    ['how do i send a message to all parents', 'howBroadcast'],
    ['كيف أشوف رسائل أولياء الأمور؟', 'howReadMessages'],
    ['how do i see messages from parents', 'howReadMessages'],
    ['كيف أنشئ امتحاناً جديداً؟', 'howCreateExam'],
    ['how do i create an exam', 'howCreateExam'],
    ['كيف أحذف ورقة عمل محفوظة؟', 'howDeleteSaved'],
    ['how do i delete a saved worksheet', 'howDeleteSaved'],
    ['كيف أعدّل ورقة العمل قبل الطباعة؟', 'howEditWorksheet'],
    ['how do i edit the worksheet', 'howEditWorksheet'],
    ['كيف أطبع خطة الدرس بنموذج الوزارة؟', 'howMinistryPlan'],
    ['how do i export the lesson plan in the ministry template', 'howMinistryPlan'],
    ['كيف أضيف موعد امتحان للتقويم؟', 'howExamDate'],
  ];
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');
  for (const [q, key] of steps) {
    it(`«${q}» gets ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.equal(answerAppHelp(q, lang(q), t).text, `<${key}>`);
    });
  }

  const teaching = [
    'أنشئ اختباراً عن الكسور',
    'ممكن انشئ اختبار',
    'كيف أنقل الطالب من الحفظ إلى الفهم؟',
    'كيف أربط الدرس بحياة الطالب؟',
    'كيف أتعامل مع رسائل أولياء الأمور الغاضبة؟',
    'how do i support struggling students',
    'كيف أحذف الأخطاء من إجابات الطالب؟',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }

  it('renaming a class never gets the make-a-new-class steps', () => {
    assert.notEqual(answerAppHelp('كيف أغير اسم الشعبة؟', 'ar', t).text, '<howAddClass>');
    assert.notEqual(answerAppHelp('how do i edit my class', 'en', t).text, '<howAddClass>');
  });
});

describe('a purpose, a dialect, a plural (seventh live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const lang = (q: string) => (/[؀-ۿ]/.test(q) ? 'ar' : 'en');
  // A how-question that names a material and then what it is for is teaching.
  const teaching = [
    'كيف أعدّل ورقة العمل لتناسب الطلاب الضعاف؟',
    'كيف أستخدم النشاط لتعزيز التعاون؟',
    'how do i make my slides more engaging',
    'how do i adapt the worksheet for weak students',
    'كيف أجعل الاختبار يناسب كل المستويات؟',
  ];
  for (const q of teaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
      assert.notEqual(classifyChatIntent(q, lang(q)).intent, 'app_help');
    });
  }
  // «شلون», «ازاي», «كيفية» ask what «كيف» asks.
  const steps: Array<[string, string]> = [
    ['شلون اضيف واجب؟', 'howAddHomework'],
    ['ازاي اضيف طالب؟', 'howAddStudent'],
    ['كيفية إضافة شعبة جديدة', 'howAddClass'],
    ['اشلون اغير اسم الشعبة', 'howRenameClass'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» gets ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, lang(q), t).text, `<${key}>`);
    });
  }
  it('"where do i find my exams" finds the evaluations', () => {
    assert.equal(isAppHelpQuery('where do i find my exams'), true);
    assert.equal(top('where do i find my exams'), 'tool:evaluations');
  });
  const features: Array<[string, string]> = [
    ['كيف أعمل خطة فصلية؟', 'howTeachingPlan'],
    ['how do i make a teaching plan', 'howTeachingPlan'],
    ['كيف أضيف درساً للخطة الفصلية؟', 'howPlanLessons'],
    ['كيف أنشئ جدول الحصص؟', 'howTimetable'],
    ['كيف أضيف حصة إلى الجدول؟', 'howTimetable'],
    ['كيف أشوف سجل الطالب؟', 'howStudentRecord'],
    ['how do i see student progress', 'howStudentRecord'],
    ['كيف أكتب ملاحظة عن طالب؟', 'howStudentNote'],
    ['how do i add a note about a student', 'howStudentNote'],
    ['كيف أشارك ورقة العمل على واتساب؟', 'howShareMaterial'],
    ['how do i send the worksheet on whatsapp', 'howShareMaterial'],
    ['كيف أحفظ العرض التقديمي؟', 'howSaveSlides'],
    ['how do i print slides', 'howSaveSlides'],
    ['كيف أعرض الشرائح بشاشة كاملة؟', 'howPresent'],
    ['how do i present the slides full screen', 'howPresent'],
    ['كيف أعمل لعبة للطلاب؟', 'howMakeGame'],
    ['how do i share a game with students', 'howShareGame'],
    ['كيف أرجع للمحادثة السابقة؟', 'howChatHistory'],
    ['كيف أمسح المحادثة؟', 'howChatHistory'],
    ['how do i start a new chat', 'howChatHistory'],
    ['كيف أضيف مورداً من المكتبة للشعبة؟', 'howLibraryToClass'],
    ['how do i add a library resource to my class', 'howLibraryToClass'],
  ];
  for (const [q, key] of features) {
    it(`«${q}» gets ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(classifyChatIntent(q, lang(q)).intent, 'app_help');
      assert.equal(answerAppHelp(q, lang(q), t).text, `<${key}>`);
    });
  }
  it('«وين المكتبة؟» points at the Library tab', () => {
    assert.equal(isAppHelpQuery('وين المكتبة؟'), true);
    assert.equal(top('وين المكتبة؟'), 'library');
  });
  it('saving a lesson plan still gets the save steps', () => {
    assert.equal(answerAppHelp('كيف أحفظ خطة الدرس؟', 'ar', t).text, '<howSaveMaterial>');
  });
  const stillTeaching = [
    'كيف أعرض الفكرة بطريقة ممتعة؟',
    'كيف أكتب ملاحظة جيدة في دفتر الطالب عن سلوكه؟',
    'كيف أجعل اللعبة ممتعة للطلاب؟',
    'كيف أراجع الدرس السابق مع الطلاب؟',
  ];
  for (const q of stillTeaching) {
    it(`leaves «${q}» alone`, () => {
      assert.equal(isAppHelpQuery(q), false);
    });
  }
  it('a tool\'s make-steps never answer sharing it', () => {
    assert.notEqual(answerAppHelp('كيف أشارك ورقة العمل على واتساب؟', 'ar', t).text, '<howMakeWorksheet>');
  });
});

describe('classifyChatIntent routes app questions before artifacts', () => {
  it('«وين ألاقي ورقة العمل» asks for the tool, not a worksheet', () => {
    assert.equal(classifyChatIntent('وين ألاقي ورقة العمل؟').intent, 'app_help');
  });
  it('«أنشئ ورقة عمل» still generates', () => {
    assert.equal(classifyChatIntent('أنشئ ورقة عمل').intent, 'artifact');
  });
});

// "how to generate worksheet" fell through to the generator, which made a
// worksheet titled «how» (app.iqrra.com, 2026-10-17). How a material is made
// is answered with the steps, and the button opens the tool.
describe('how is a material made', () => {
  const t = (k: string) => `<${k}>`;
  const asks: [string, 'ar' | 'en', string][] = [
    ['how to generate worksheet', 'en', 'howMakeWorksheet'],
    ['How do I make a worksheet?', 'en', 'howMakeWorksheet'],
    ['how can I prepare a lesson plan', 'en', 'howMakeLessonPlan'],
    ['how do I build a quiz', 'en', 'howMakeQuiz'],
    ['how to create an activity', 'en', 'howMakeActivity'],
    ['كيف أعمل ورقة عمل؟', 'ar', 'howMakeWorksheet'],
    ['كيف أجهّز ورقة عمل', 'ar', 'howMakeWorksheet'],
    ['طريقة عمل ورقة عمل', 'ar', 'howMakeWorksheet'],
    ['كيف أحضّر خطة درس', 'ar', 'howMakeLessonPlan'],
    ['كيف اسوي اختبار', 'ar', 'howMakeQuiz'],
    ['كيف أنشئ نشاطاً صفياً', 'ar', 'howMakeActivity'],
  ];
  for (const [q, lang, key] of asks) {
    it(`«${q}» gets the steps, not a material`, () => {
      assert.equal(classifyChatIntent(q, lang).intent, 'app_help');
      const answer = answerAppHelp(q, lang, t);
      assert.equal(answer.text, `<${key}>`);
      assert.equal(answer.places[0]?.isTool, true);
    });
  }

  it('exporting one still gets the export steps', () => {
    assert.equal(answerAppHelp('how do I export my worksheet', 'en', t).text, '<faqA4>');
    assert.equal(answerAppHelp('كيف أطبع ورقة العمل', 'ar', t).text, '<faqA4>');
  });

  const stillMade = ['make a worksheet on fractions', 'جهّز ورقة عمل عن الكسور', 'أنشئ اختباراً قصيراً'];
  for (const q of stillMade) {
    it(`«${q}» still generates`, () => assert.equal(classifyChatIntent(q).intent, 'artifact'));
  }

  const teaching = ['how do I prepare students for the exam', 'كيف أحضّر طلابي للامتحان', 'كيف أشرح الكسور لطلابي'];
  for (const q of teaching) {
    it(`«${q}» is not a how-to about the app`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

describe('a purpose reaches the model, not a builder or an edit (eighth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  it('a how-question with a purpose is not an edit of the open paper', () => {
    assert.equal(classifyChatIntent('كيف أعدّل ورقة العمل لتناسب الطلاب الضعاف؟').intent, 'teaching');
    assert.equal(classifyChatIntent('كيف أعمل ورقة عمل لتناسب الطلاب الضعاف؟').intent, 'artifact');
    assert.equal(classifyChatIntent('اجعله أبسط').intent, 'refinement');
  });

  it('advice about slides does not open the slides builder', () => {
    assert.equal(toolAskFromQuery('how do i make my slides more engaging'), null);
    assert.equal(toolAskFromQuery('make slides for this lesson'), 'slides');
  });

  it('a top-level place is listed once, not as «المكتبة: المكتبة»', () => {
    const answer = answerAppHelp('وين المكتبة؟', 'ar', t);
    assert.ok(!answer.text.includes(`**<${answer.places[0]!.labelKey}>**: <${answer.places[0]!.labelKey}>`));
  });
});

describe('features asked about by name, and the ones the app lacks (ninth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أصحح أوراق الامتحان بالكاميرا؟', 'howClassScan'],
    ['how do i grade the exam papers with my camera', 'howClassScan'],
    ['كيف أرسل رسالة لولي أمر؟', 'howParentMessage'],
    ['كيف أكتب رسالة لولي أمر الطالب', 'howParentMessage'],
    ['how do i send a message to a parent', 'howParentMessage'],
    ['how do i write a letter to a student\'s parent', 'howParentMessage'],
    ['how do i see who has not submitted the homework', 'howHomeworkDone'],
    ['كيف أعرف مين ما سلم الواجب', 'howHomeworkDone'],
    ['كيف أنضم لشعبة برمز؟', 'howJoinClass'],
    ['how do i join a class with a code', 'howJoinClass'],
    ['كيف أعرض التقويم؟', 'howCalendar'],
    ['كيف أضيف حدثاً للتقويم؟', 'howCalendar'],
    ['how do i add an event to the calendar', 'howCalendar'],
    ['كيف أستورد الطلاب من ملف إكسل؟', 'howImportStudents'],
    ['how do i import students from an excel file', 'howImportStudents'],
    ['كيف أعرف نسبة حضور الطلاب؟', 'howAttendance'],
    ['how do i take attendance', 'howAttendance'],
    ['هل يعمل التطبيق بدون إنترنت؟', 'howOffline'],
    ['does the app work without internet', 'howOffline'],
    ['كيف أعمل بنك أسئلة؟', 'howQuestionBank'],
    ['how do i make a question bank', 'howQuestionBank'],
    ['كيف أضبط تذكير بموعد الامتحان؟', 'howExamReminder'],
    ['how do i set a reminder for the exam', 'howExamReminder'],
    ['نسيت كلمة المرور شو أعمل؟', 'howChangePassword'],
    ['i forgot my password what do i do', 'howChangePassword'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      const answer = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t);
      assert.equal(answer.text, `<${key}>`);
    });
  }

  it('sending to the whole class is still a broadcast, one student still a thread', () => {
    assert.equal(answerAppHelp('how do i send a message to all parents', 'en', t).text, '<howBroadcast>');
    assert.equal(answerAppHelp('كيف أراسل ولي أمر طالب؟', 'ar', t).text, '<howMessageOne>');
    assert.equal(answerAppHelp('how do i message one student', 'en', t).text, '<howMessageOne>');
  });

  const stayWithModel = [
    'كيف أصحح أوراق الطلاب؟',
    'how do i grade the exams',
    'كيف أجمع علامات الطلاب في جدول',
    'كيف أتعامل مع طالب يتغيب كثيرًا',
    'how do i deal with a student who is often absent',
    'how do i make homework less boring for students',
    'كيف أجعل الواجب أقل مللًا',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not app help`, () => assert.equal(isAppHelpQuery(q), false));
  }

  it('advice about making homework less boring is teaching, not a worksheet to build', () => {
    assert.equal(classifyChatIntent('how do i make homework less boring for students', 'en').intent, 'teaching');
    assert.equal(classifyChatIntent('make a worksheet for weak students', 'en').intent, 'artifact');
  });
});

describe('the lab, the corners, groups, export and the rest (tenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أستخدم السبورة التفاعلية؟', 'howWhiteboard'],
    ['how do i use the whiteboard', 'howWhiteboard'],
    ['كيف أنشئ مجموعة للأهالي؟', 'howParentGroup'],
    ['how do i create a group for parents', 'howParentGroup'],
    ['كيف أحمّل خطة الدرس بصيغة وورد؟', 'faqA4'],
    ['how do i download the lesson plan as word', 'faqA4'],
    ['كيف أنسخ نص خطة الدرس؟', 'faqA4'],
    ['كيف أفتح صفحة المدرسة؟', 'howSchoolTab'],
    ['how do i switch between my classes', 'howOpenClass'],
    ['كيف أعمل نسخة احتياطية من ملفاتي؟', 'howBackup'],
    ['how do i back up my files', 'howBackup'],
    ['كيف أشارك خطة الدرس مع معلم آخر؟', 'howShareMaterial'],
    ['how do i share a lesson plan with another teacher', 'howShareMaterial'],
    ['هل بياناتي آمنة؟', 'howPrivacy'],
    ['is my data safe', 'howPrivacy'],
    ['how do i update the app', 'howUpdateApp'],
    ['كيف أحدّث التطبيق؟', 'howUpdateApp'],
    ['كيف أعرف الدروس التي أنهيتها؟', 'howLessonProgress'],
    ['how do i see which objectives i have covered', 'howLessonProgress'],
    ['كيف أشاهد الفيديوهات التعليمية؟', 'howLibraryVideos'],
    ['how do i watch the educational videos', 'howLibraryVideos'],
    ['كيف أبحث عن درس معين؟', 'howSearchLesson'],
    ['how do i search for a lesson', 'howSearchLesson'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const places: Array<[string, string, string]> = [
    ['كيف أفتح مختبر الكيمياء؟', 'lab', 'labEntryTitle'],
    ['where is the chemistry lab', 'lab', 'labEntryTitle'],
    ['وين ركن الرياضيات؟', 'math-corner', 'mathEntryTitle'],
    ['how do i open the math corner', 'math-corner', 'mathEntryTitle'],
    ['كيف أفتح القرآن الكريم في التطبيق؟', 'quran-corner', 'quranTitle'],
    ['كيف ألعب لعبة الذاكرة؟', 'tool:games', 'toolGamesTitle'],
  ];
  for (const [q, id, label] of places) {
    it(`«${q}» → the ${id} place`, () => {
      assert.equal(isAppHelpQuery(q), true);
      const answer = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t);
      assert.equal(answer.places[0]?.id, id);
      assert.ok(answer.text.includes(`<${label}>`));
    });
  }

  const stayWithModel = [
    'how do i write a chemistry lab report',
    'كيف أشرح درس القرآن الكريم',
    'كيف أنظم المختبر مع الطلاب',
    'how do i organise group work in class',
    'how do i copy a worksheet for each student',
    'كيف أبحث عن معلومات لدرس الأسس',
    'how do i find the main idea of a lesson',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not app help`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

describe('exams and classes: what exists, and what does not (eleventh live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أرى ترتيب الطلاب في الامتحان؟', 'howExamRanking'],
    ['how do i see the ranking of my students', 'howExamRanking'],
    ['كيف أعيد فتح امتحان مغلق؟', 'howCloseExam'],
    ['how do i reopen a closed exam', 'howCloseExam'],
    ['كيف أمدد وقت الامتحان؟', 'howExamTime'],
    ['how do i set a time limit for the exam', 'howExamTime'],
    ['how do i give more time to the exam', 'howExamTime'],
    ['كيف أخلط ترتيب الأسئلة؟', 'howExamShuffle'],
    ['how do i shuffle the exam questions', 'howExamShuffle'],
    ['كيف أحدد علامة كل سؤال؟', 'howQuestionMarks'],
    ['how do i set the marks for each question', 'howQuestionMarks'],
    ['كيف أعرف أي الأسئلة كانت أصعب على الطلاب؟', 'howExamAnalysis'],
    ['how do i see which exam questions were hardest', 'howExamAnalysis'],
    ['كيف أستعيد شعبة مؤرشفة؟', 'howArchivedClasses'],
    ['كيف أرى الشعب المؤرشفة؟', 'howArchivedClasses'],
    ['how do i restore an archived class', 'howArchivedClasses'],
    ['كيف أغير الصف الدراسي للشعبة؟', 'howClassGrade'],
    ['how do i change the grade of a class', 'howClassGrade'],
    ['how do i see a student\'s login code', 'howReissueLoginCode'],
    ['كيف أعرف رمز الربط للشعبة؟', 'howShareLinkCode'],
    ['how do i find the class link code', 'howShareLinkCode'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  it('changing a student\'s mark and renaming a class keep their own answers', () => {
    assert.equal(answerAppHelp('كيف أغير اسم الشعبة؟', 'ar', t).text, '<howRenameClass>');
    assert.equal(answerAppHelp('how do i close an exam', 'en', t).text, '<howCloseExam>');
  });

  const stayWithModel = [
    'كيف أحدد مدة الامتحان؟',
    'كيف أصحح الأسئلة المقالية؟',
    'كيف أمنع الطلاب من الغش في الامتحان؟',
    'كيف أرتب أسئلة الامتحان من السهل إلى الصعب',
    'how do i give students more time to think',
    'how do i rank students fairly',
    'كيف أحلل أسباب ضعف الطلاب في الامتحان',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not app help`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

describe('slides, worksheets, verification and the books (twelfth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أضيف شريحة جديدة للعرض؟', 'howSlideAddReorder'],
    ['كيف أغير ترتيب الشرائح؟', 'howSlideAddReorder'],
    ['how do i reorder the slides', 'howSlideAddReorder'],
    ['كيف أضيف صورة لشريحة؟', 'howSlideEdit'],
    ['كيف أعدل الشريحة', 'howSlideEdit'],
    ['how do i change the theme of my slides', 'howSlideEdit'],
    ['كيف أضيف ملاحظات للمعلم على الشريحة؟', 'howSlideNotes'],
    ['how do i add speaker notes to the slides', 'howSlideNotes'],
    ['كيف أعدل خطة الدرس بعد توليدها؟', 'faqA5'],
    ['how do i update my lesson plan', 'faqA5'],
    ['كيف أحذف قسماً من خطة الدرس؟', 'faqA5'],
    ['how do i edit the lesson plan after it is generated', 'faqA5'],
    ['كيف أعمل مفتاح الإجابة لورقة العمل؟', 'howWorksheetAnswers'],
    ['how do i hide the answers on a worksheet', 'howWorksheetAnswers'],
    ['كيف أضيف شعار المدرسة على الأوراق؟', 'howWorksheetHeader'],
    ['كيف أكتب اسمي على ورقة العمل؟', 'howWorksheetHeader'],
    ['how do i add a header with name and date to a worksheet', 'howWorksheetHeader'],
    ['how do i choose the difficulty of a quiz', 'howDifficulty'],
    ['ما معنى تم التحقق؟', 'howVerified'],
    ['كيف أعمل ورقة علاجية للطلاب الضعاف؟', 'howRemedial'],
    ['كيف أنقل ورقة العمل إلى شعبة ثانية؟', 'howSendWorksheet'],
    ['كيف أستخدم نماذج وزارة التربية؟', 'howMinistryPlan'],
    ['كيف أحمل الكتاب المدرسي؟', 'howBookDownload'],
    ['كيف أحمل دليل المعلم؟', 'howBookDownload'],
    ['where is the teacher\'s guide', 'howBookDownload'],
    ['كم ورقة عمل أستطيع توليدها في اليوم؟', 'howPricing'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'how do i make my slides more interactive',
    'كيف أرتب الأفكار في الشرائح',
    'كيف أعدل خطتي الأسبوعية',
    'how do i edit my teaching approach',
    'كيف أحمل الطلاب مسؤولية تعلمهم',
    'how do i download a movie for class',
    'what does verified mean on instagram',
    'how do i choose a difficulty level for weak students',
    'كيف أكتب اسمي بالإنجليزية',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not app help`, () => assert.equal(isAppHelpQuery(q), false));
  }
});


describe('account, classes, exams and games (thirteenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أغير صورتي الشخصية؟', 'howChangePhoto'],
    ['how do i change my profile picture', 'howChangePhoto'],
    ['كيف أغير رقم هاتفي؟', 'howChangePhone'],
    ['how do i change my phone number', 'howChangePhone'],
    ['كيف أضبط الإشعارات؟', 'howNotifications'],
    ['where do i find the english corner', 'howEnglishCorner'],
    ['وين ركن الإنجليزية', 'howEnglishCorner'],
    ['how do i duplicate a class', 'howDuplicateClass'],
    ['كيف أنسخ الشعبة؟', 'howDuplicateClass'],
    ['كيف أعرف من فتح التقييم من الطلبة؟', 'howExamSubmissions'],
    ['how do i see which students opened the exam', 'howExamSubmissions'],
    ['كيف أنقل طالباً من شعبة إلى أخرى؟', 'howMoveStudent'],
    ['how do i move a student from one class to another', 'howMoveStudent'],
    ['كيف أعطي علامة لواجب؟', 'howHomeworkGrade'],
    ['how do i give a grade to a homework', 'howHomeworkGrade'],
    ['كيف أرسل ملاحظات أو اقتراحات للتطبيق؟', 'howSuggestFeature'],
    ['how do i send feedback or suggestions to the app', 'howSuggestFeature'],
    ['ما هي الألعاب التعليمية في التطبيق؟', 'howGamesList'],
    ['what games are there in the app', 'howGamesList'],
    ['كيف أرسل تذكير للأهل بموعد الاختبار؟', 'howExamParents'],
    ['how do i remind parents about the exam', 'howExamParents'],
    ['كيف أطبع رمز QR للتقييم؟', 'howExamQr'],
    ['how do i print a qr code for the exam', 'howExamQr'],
    ['ما الفرق بين الاختبار القصير والتقييم؟', 'howQuizVsEvaluation'],
    ['what is the difference between a quiz and an evaluation', 'howQuizVsEvaluation'],
    ['كيف أشارك كود الشعبة مع الطلبة؟', 'howShareLinkCode'],
    ['how do i share the class code with my students', 'howShareLinkCode'],
    ['كيف أشارك رابط التقييم عبر واتساب؟', 'howShareExam'],
    ['how do i share the exam link on whatsapp', 'howShareExam'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'how do i change the photo in my slide',
    'how do i copy a class of compounds',
    'what games are good for teaching fractions',
    'ما الفرق بين الاختبار القصير والتقييم التكويني',
    'كيف أرسل تذكيرا للأهل بالواجب',
    'how do i grade essays fairly',
    'what is the english corner',
    'كيف أنقل الطالب الضعيف إلى مجموعة أخرى في الصف',
    'how do i share the exam answers with the class',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howChangePhoto', 'howChangePhone', 'howEnglishCorner', 'howDuplicateClass', 'howHomeworkGrade', 'howGamesList', 'howExamParents', 'howExamQr', 'howQuizVsEvaluation', 'howMoveStudent']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('families, lesson-plan options, schedule and email (fourteenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أدخل كحساب طالب؟', 'howStudentSignIn'],
    ['how do i log in as a student', 'howStudentSignIn'],
    ['كيف يرى ولي الأمر علامات ابنه؟', 'howFamilyView'],
    ['how does a parent see the homework', 'howFamilyView'],
    ['how can i see my child\'s results', 'howFamilyView'],
    ['كيف أربط حسابي بحساب ابني؟', 'howParentLink'],
    ['how do i link my account to my child', 'howParentLink'],
    ['كيف أنسى رمز الدخول وأستعيده؟', 'howLoginCodeLost'],
    ['نسيت رمز الدخول', 'howLoginCodeLost'],
    ['i forgot my login code', 'howLoginCodeLost'],
    ['كيف أختار أسلوب التدريس في خطة الدرس؟', 'howPlanOptions'],
    ['كيف أضيف أهدافاً تعليمية لخطة الدرس؟', 'howPlanOptions'],
    ['how do i set the duration of the lesson plan', 'howPlanOptions'],
    ['كيف أغير لغة خطة الدرس إلى الإنجليزية؟', 'howPlanLanguage'],
    ['how do i make the worksheet in english', 'howPlanLanguage'],
    ['كيف أبحث عن درس معين في المنهاج؟', 'howSearchLesson'],
    ['where can i see the grade 10 chemistry units', 'howSearchLesson'],
    ['كيف أشاهد فيديو شرح الدرس؟', 'howLibraryVideos'],
    ['كيف أرسل ورقة العمل بالبريد الإلكتروني؟', 'howEmailMaterial'],
    ['how do i email the worksheet', 'howEmailMaterial'],
    ['كيف أضيف حصة إلى جدولي الأسبوعي؟', 'howTimetable'],
    ['كيف أحذف حصة من الجدول؟', 'howTimetableRemove'],
    ['how do i delete a class from my timetable', 'howTimetableRemove'],
    ['كيف أغير بريدي الإلكتروني؟', 'howChangeEmail'],
    ['how do i change my email', 'howChangeEmail'],
    ['كيف أتحقق من بريدي الإلكتروني؟', 'howVerifyEmail'],
    ['how do i verify my email', 'howVerifyEmail'],
    ['كيف أحظر مستخدماً في الرسائل؟', 'howBlock'],
    ['كيف أنشئ مجموعة محادثة مع أولياء أمور شعبتي؟', 'howParentGroup'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'what is the best teaching style for weak students',
    'كيف أختار أسلوب التدريس المناسب لطلاب ضعاف',
    'كيف أشرح أسلوب التدريس التعاوني',
    'how do i verify my answer to a math problem',
    'how do i change the email template in marketing',
    'how do i see grade 10 chemistry units in the book',
    'how do i watch a video about photosynthesis',
    'how do i log in as admin',
    'كيف يرى الطالب الخطأ في حله',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not app help`, () => assert.equal(isAppHelpQuery(q), false));
  }
});

describe('chat, homework, results and sign-in (fifteenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أمسح المحادثة مع إقرأ؟', 'howChatHistory'],
    ['كيف أبدأ محادثة جديدة مع المساعد؟', 'howChatHistory'],
    ['how do i start a new chat', 'howChatHistory'],
    ['هل يمكنني إرسال صورة في المحادثة؟', 'howUploadFile'],
    ['كيف أنسخ إجابة المساعد؟', 'faqA4'],
    ['كيف أغير حجم الخط في التطبيق؟', 'howFontSize'],
    ['how do i use voice input in the chat', 'howChatVoice'],
    ['هل يقرأ التطبيق النص بصوت عال؟', 'howChatVoice'],
    ['كيف أعدل خطة التدريس الشهرية؟', 'howEditTeachingPlan'],
    ['كيف أعدل واجباً بعد نشره؟', 'howHomeworkEdit'],
    ['كيف أحذف واجباً؟', 'howHomeworkEdit'],
    ['how do i delete a homework', 'howHomeworkEdit'],
    ['كيف أرسل واجباً لطالب واحد فقط؟', 'howHomeworkOne'],
    ['كيف أطبع كشف علامات الشعبة؟', 'howExportMarks'],
    ['كيف أرى معدل الشعبة في الامتحان؟', 'howClassAverage'],
    ['كيف أسمح للطالب بإعادة الامتحان؟', 'howExamRetake'],
    ['how do i let a student retake the exam', 'howExamRetake'],
    ['how are open-ended answers graded', 'howOpenGrading'],
    ['كيف تُصحَّح الأسئلة المقالية في التطبيق؟', 'howOpenGrading'],
    ['كيف أشارك الدرس مع زميل؟', 'howShareMaterial'],
    ['ما هي اللغات المدعومة في التطبيق؟', 'howLanguages'],
    ['what languages are supported', 'howLanguages'],
    ['كيف أسجل الدخول بحساب جوجل؟', 'howGoogleSignIn'],
    ['how do i sign in with google', 'howGoogleSignIn'],
    ['كيف أعرف كم ولّدت من مواد هذا الشهر؟', 'howAiUsage'],
    ['كيف أبدل صورة الغلاف في العرض؟', 'howSlideEdit'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'how do i grade essays fairly',
    'كيف أصحح الأسئلة المقالية بعدالة',
    'what languages should i teach in class',
    'ما هي اللغات السامية',
    'كيف أحذف واجباً منزلياً من دفتر الطالب',
    'how do i use voice acting in a lesson',
    'كيف أمسح السبورة بعد الحصة',
    'how do i start a new chapter',
    'how do i let students retake the test fairly',
    'كيف أعدل خطة التدريس لتناسب الطلاب الضعاف',
    'how do i sign in with a pen',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howChatHistory', 'howChatVoice', 'howFontSize', 'howHomeworkEdit', 'howHomeworkOne', 'howClassAverage', 'howExamRetake', 'howOpenGrading', 'howLanguages', 'howGoogleSignIn', 'howAiUsage', 'howEditTeachingPlan']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('Today, lesson games, files and the mastery gate (sixteenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['ما هي شاشة اليوم في التطبيق؟', 'howTodayScreen'],
    ['where is the today screen', 'howTodayScreen'],
    ['كيف أجهز كل مواد حصة الغد دفعة واحدة؟', 'howLessonPrep'],
    ['كيف أتخطى تجهيز حصة معينة؟', 'howLessonPrep'],
    ['ما هي ألعاب الدرس؟', 'howLessonGames'],
    ['كيف ألعب لعبة ترتيب الحروف مع الطلبة؟', 'howLessonGames'],
    ['كيف أفتح لعبة الذاكرة لدرس معين؟', 'howLessonGames'],
    ['what are the lesson games', 'howLessonGames'],
    ['كيف أضيف مدرستي إلى حسابي؟', 'howAddSchool'],
    ['من يستطيع أن يرى مواعيد امتحاناتي؟', 'howExamDateWho'],
    ['كيف أرى تقويم المدرسة؟', 'howCalendar'],
    ['كيف أحدد صفي ومادتي من جديد؟', 'howAddGrade'],
    ['كيف أغير الصف الذي أدرّسه؟', 'howAddGrade'],
    ['كيف أعرف الدرس الحالي في المنهاج؟', 'faqA2'],
    ['كيف أثبّت الدرس الذي أدرّسه الآن؟', 'faqA2'],
    ['how do i unpin the current lesson', 'howUnpinLesson'],
    ['how do i see my saved materials', 'howFilesFind'],
    ['كيف أبحث في ملفاتي؟', 'howFilesFind'],
    ['كيف أنظم ملفاتي في مجلدات؟', 'howFilesFind'],
    ['كيف أستعيد ملفاً حذفته؟', 'howFilesRestore'],
    ['كيف أشارك ملفاً من ملفاتي مع شعبة؟', 'howFilesToClass'],
    ['how do i add a saved worksheet to a class', 'howFilesToClass'],
    ['كيف أجعل الطلبة يحلون ورقة العمل على هواتفهم؟', 'howSendWorksheet'],
    ['كيف أرى ما حله الطلبة في التدريب؟', 'howStudentWork'],
    ['what is the mastery gate', 'howMasteryGate'],
    ['كيف يفتح الطالب الدرس التالي؟', 'howMasteryGate'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أثبّت المعلومة في ذاكرة الطلبة',
    'how do i pin down the main idea of a text',
    'كيف ألعب لعبة ترتيب الحروف في حصة اللغة العربية للصف الأول',
    'how do i organize my notes in folders',
    'كيف أرى ما حله الطالب على السبورة',
    'what is the best way to prepare all the materials for a lab',
    'كيف أضيف مدرستي إلى خريطة الأردن',
    'what is the mastery of a skill',
    'كيف أحدد صفي الدراسي في الجامعة',
    'who can see my exam dates in the school year plan',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howTodayScreen', 'howLessonPrep', 'howLessonGames', 'howAddSchool', 'howExamDateWho', 'faqA2', 'howUnpinLesson', 'howFilesFind', 'howFilesRestore', 'howFilesToClass', 'howStudentWork', 'howMasteryGate']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('accounts, messages, evaluation setup and the corners (seventeenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أبدل بين حسابين في التطبيق؟', 'howSwitchAccount'],
    ['how do i switch accounts', 'howSwitchAccount'],
    ['كيف أسجل الخروج من كل الأجهزة؟', 'howLogoutAll'],
    ['كيف أعيد مشاهدة المقدمة التعريفية للتطبيق؟', 'howIntroReplay'],
    ['كيف أقرأ كل الإشعارات دفعة واحدة؟', 'howMarkAllRead'],
    ['how do i mark all notifications as read', 'howMarkAllRead'],
    ['كيف أكتم محادثة معينة؟', 'howMuteChat'],
    ['هل تظهر لي إشعارات القراءة في الرسائل؟', 'howReadReceipts'],
    ['كيف أبحث عن رسالة قديمة؟', 'howSearchMessages'],
    ['كيف أرسل ملفاً في الرسائل؟', 'howSendFileMessage'],
    ['كيف أحدد عدد أسئلة التقييم؟', 'howEvalSetup'],
    ['what question types can an evaluation have', 'howEvalSetup'],
    ['كيف أختار أهداف الدرس للتقييم؟', 'howEvalSetup'],
    ['كيف أضبط علامة النجاح للتقييم؟', 'howEvalPassMark'],
    ['كيف أغير علامة سؤال في التقييم؟', 'howEditExamQuestions'],
    ['كيف أعيد توليد أسئلة التقييم؟', 'howEditExamQuestions'],
    ['how do i regenerate the exam questions', 'howEditExamQuestions'],
    ['كيف أضيف رسماً أو شكلاً إلى سؤال؟', 'howEvalFigures'],
    ['كيف أصدر الشرائح بصيغة بوربوينت؟', 'howSaveSlides'],
    ['how do i export the slides as powerpoint', 'howSaveSlides'],
    ['ما هو المختبر الافتراضي؟', 'howLabAbout'],
    ['what is in the quran corner', 'howQuranAbout'],
    ['كيف أستخدم الآلة الحاسبة في زاوية الرياضيات؟', 'howMathTools'],
    ['كيف أضيف طلاباً دفعة واحدة من قائمة؟', 'howAddStudent'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أبدل بين حسابين في معادلة',
    'how do i switch between two methods of solving equations',
    'كيف أكتم صوت الطلاب في الحصة',
    'how do i search for old exam papers online',
    'كيف أحدد عدد الأسئلة المناسب لاختبار قصير',
    'what question types are best for a chemistry test',
    'كيف أستخدم الآلة الحاسبة في حساب المساحة',
    'what is a virtual lab experiment',
    'كيف أرسل ملاحظة لأهل الطالب',
    'how do i set the passing grade for my class policy',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howSwitchAccount', 'howLogoutAll', 'howIntroReplay', 'howMarkAllRead', 'howMuteChat', 'howReadReceipts', 'howSearchMessages', 'howSendFileMessage', 'howEvalSetup', 'howEvalPassMark', 'howEvalFigures', 'howLabAbout', 'howQuranAbout', 'howMathTools']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('live games, the interactive class, slides, activities, quizzes and worksheets (eighteenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أبدأ لعبة مباشرة يجيب عليها الطلبة من هواتفهم؟', 'howLiveGameStart'],
    ['how do i start a live game', 'howLiveGameStart'],
    ['كيف ينضم الطلبة إلى اللعبة المباشرة؟', 'howLiveGameJoin'],
    ['how do students join the live game', 'howLiveGameJoin'],
    ['كم طالباً يمكنه المشاركة في اللعبة المباشرة؟', 'howLiveGameLimit'],
    ['how many students can play in the live game', 'howLiveGameLimit'],
    ['كيف أرى نتائج اللعبة المباشرة بعد انتهائها؟', 'howLiveGameResults'],
    ['ما هي الحصة التفاعلية؟', 'howClassroomAbout'],
    ['what is the interactive class', 'howClassroomAbout'],
    ['كيف أبني عرضاً تفاعلياً للصف؟', 'howInteractiveDeck'],
    ['كيف أنشئ شرائح من نص أكتبه أنا؟', 'howSlidesOwnText'],
    ['كيف أختار قالب الشرائح؟', 'howSlideTheme'],
    ['how do i choose the slide theme', 'howSlideTheme'],
    ['كيف أستخدم السبورة في الحصة؟', 'howWhiteboard'],
    ['كيف أحفظ ما كتبته على السبورة؟', 'howWhiteboard'],
    ['how do i save what i wrote on the whiteboard', 'howWhiteboard'],
    ['ما أنواع الأنشطة الصفية المتاحة؟', 'howActivityTypes'],
    ['كيف أحدد عدد الطلبة في المجموعة للنشاط؟', 'howActivityGroupSize'],
    ['ما أنواع الأسئلة في الاختبار القصير؟', 'howQuizTypes'],
    ['كيف أضيف سؤال مقالي للاختبار القصير؟', 'howQuizTypes'],
    ['كيف أخلط ترتيب أسئلة الاختبار القصير؟', 'howQuizTypes'],
    ['how do i add an essay question to the quiz', 'howQuizTypes'],
    ['كيف أطلب من إقرأ أسئلة أصعب؟', 'howDifficulty'],
    ['how do i make the questions harder', 'howDifficulty'],
    ['كيف أحدد مستوى ورقة العمل للطلبة المتفوقين؟', 'howWorksheetLevels'],
    ['كيف أضيف مثالاً محلولاً لورقة العمل؟', 'howWorksheetExample'],
    ['how do i add a worked example to the worksheet', 'howWorksheetExample'],
    ['كيف أقلل عدد الأسئلة في ورقة العمل؟', 'howWorksheetCount'],
    ['كيف أرسل رسالة جماعية لأولياء الأمور عن الواجب؟', 'howBroadcast'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أشرح الاحتمال للطلبة',
    'كم طالباً في الصف العاشر',
    'what types of questions are best for a quiz',
    'how do i make a live demo for students',
    'ما هي الحصة الجيدة',
    'كيف أستخدم السبورة التقليدية في شرح المعادلات',
    'كيف أحفظ الطلبة أسماء العناصر',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howLiveGameStart', 'howLiveGameJoin', 'howLiveGameLimit', 'howLiveGameResults', 'howClassroomAbout', 'howInteractiveDeck', 'howSlidesOwnText', 'howSlideTheme', 'howActivityTypes', 'howActivityGroupSize', 'howQuizTypes', 'howWorksheetLevels', 'howWorksheetExample', 'howWorksheetCount']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('exams, marks, slides export and the library — wordings of answers that already existed (nineteenth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أرى من سلّم الاختبار ومن لم يسلّم؟', 'howExamSubmissions'],
    ['كيف أغلق الاختبار قبل انتهاء وقته؟', 'howCloseExam'],
    ['كيف أعطي طالباً وقتاً إضافياً في الاختبار؟', 'howExamTime'],
    ['how do i give a student extra time in the exam', 'howExamTime'],
    ['كيف أصحح إجابة طالب يدوياً؟', 'howOpenGrading'],
    ['كيف أربط حساب ولي الأمر بالطالب؟', 'howLinkParent'],
    ['كيف أصدّر علامات الصف إلى ملف إكسل؟', 'howExportMarks'],
    ['how do i export the class marks to excel', 'howExportMarks'],
    ['كيف أطبع الشرائح كملف PDF؟', 'howSaveSlides'],
    ['how do i save the slides as a pdf', 'howSaveSlides'],
    ['كيف أحدد موعداً لاختبار قادم في الجدول؟', 'howExamDate'],
    ['كيف أفتح كتاب الطالب داخل التطبيق؟', 'howBookDownload'],
    ['كيف أعرف الطلبة الضعفاء في درس معين؟', 'howSupportGroups'],
    ['how do i find the weak students', 'howSupportGroups'],
    ['كيف أحفظ المحتوى لأستخدمه دون إنترنت؟', 'howOffline'],
    ['كيف أستخدم المختبر الافتراضي لتجربة الأحماض؟', 'howLabAbout'],
    ['كيف أضيف صورة إلى ورقة العمل؟', 'howQuestionImage'],
    ['كيف أترجم ورقة العمل إلى الإنجليزية؟', 'howPlanLanguage'],
    ['كيف أحمّل ملف PDF لأسأل عنه إقرأ؟', 'howUploadFile'],
    ['كيف أرى استهلاكي من الرصيد أو الحد اليومي؟', 'howAiUsage'],
    ['كيف أحذف شعبة انتهى العام لها؟', 'howArchiveClass'],
    ['كيف أشارك لعبة من زاوية اللغة الإنجليزية مع الطلبة؟', 'howShareGame'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أصحح الأسئلة المقالية؟',
    'كيف أعطي الطلبة وقتا للتفكير',
    'كيف أربط الأفكار بحياة الطالب',
    'كيف أعرف الطلبة الضعفاء بالملاحظة',
    'كيف أغلق الدرس بنشاط ختامي',
    'كيف أحفظ الدرس في ذاكرة الطلبة',
    'كيف أستخدم المختبر في حصة الكيمياء',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howExamSubmissions', 'howCloseExam', 'howExamTime', 'howOpenGrading', 'howLinkParent', 'howExportMarks', 'howSaveSlides', 'howExamDate', 'howBookDownload', 'howSupportGroups', 'howOffline', 'howLabAbout', 'howQuestionImage', 'howPlanLanguage', 'howUploadFile', 'howAiUsage', 'howArchiveClass', 'howShareGame']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('attendance, class messages, regenerating, the QR code, notifications and the subject average (twentieth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أسجل غياب الطلبة اليوم؟', 'howAttendance'],
    ['how do i take attendance', 'howAttendance'],
    ['كيف أرسل رسالة لشعبة كاملة؟', 'howClassChat'],
    ['how do i send a message to the whole class', 'howClassChat'],
    ['كيف أعيد توليد ورقة العمل بأسئلة مختلفة؟', 'howRegenerate'],
    ['how do i regenerate the worksheet', 'howRegenerate'],
    ['كيف أرسل ورقة العمل إلى بريدي؟', 'howEmailMaterial'],
    ['how do i email the worksheet to my inbox', 'howEmailMaterial'],
    ['كيف أبني امتحاناً من بنك الأسئلة؟', 'howQuestionBank'],
    ['كيف أصحح أوراق الطلبة بكاميرا الهاتف؟', 'howClassScan'],
    ['كيف أعرض رمز QR للامتحان على السبورة؟', 'howExamQr'],
    ['كيف أستخدم الآلة الحاسبة العلمية في الحصة؟', 'howMathTools'],
    ['كيف يتم قفل الدرس التالي قبل إتقان السابق؟', 'howMasteryGate'],
    ['كيف أنقل مادة محفوظة إلى شعبة معينة؟', 'howFilesToClass'],
    ['كيف أرى تقدم طالب عبر الامتحانات؟', 'howStudentRecord'],
    ['كيف أفعل الإشعارات على هاتفي؟', 'howNotifications'],
    ['how do i enable notifications on my phone', 'howNotifications'],
    ['كيف أحذف حسابي نهائياً؟', 'howDeleteAccount'],
    ['how do i delete my account permanently', 'howDeleteAccount'],
    ['كيف أعيد استخدام امتحان سابق لشعبة جديدة؟', 'howCopyExam'],
    ['كيف أرى متوسط علامات الصف في مادة الرياضيات كلها؟', 'howSubjectAverage'],
    ['كيف أرى متوسط علامات الطلبة في مادة؟', 'howSubjectAverage'],
    ['how do i see the average marks in a subject', 'howSubjectAverage'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أرسل رسالة لأولياء الأمور',
    'كيف أنقل المعلومة للطلبة',
    'كيف أفعل دور الطالب في الحصة',
    'كيف أعيد شرح الدرس',
    'كيف أرى تقدم الطالب بالملاحظة',
    'كيف أسجل ملاحظات الحصة',
    'كيف أحسب متوسط درجات الطلاب بنفسي',
    'كيف أبني امتحانا متوازنا',
    'كيف أصحح أوراق الطلبة بسرعة',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howAttendance', 'howClassChat', 'howRegenerate', 'howEmailMaterial', 'howQuestionBank', 'howClassScan', 'howExamQr', 'howMathTools', 'howMasteryGate', 'howFilesToClass', 'howStudentRecord', 'howNotifications', 'howDeleteAccount', 'howCopyExam', 'howSubjectAverage']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('link codes, results, classes, messages and small answers — wordings of answers that already existed (twenty-first live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أعرف رمز الربط الخاص بالطالب؟', 'howLinkParent'],
    ['كيف أعيد إصدار رمز دخول طالب نسي رمزه؟', 'howReissueLoginCode'],
    ['كيف أخفي نتائج الامتحان عن الطلبة بعد نشرها؟', 'howReleaseResults'],
    ['كيف أطبع نسخة الطالب من الامتحان؟', 'howPrintExam'],
    ['كيف أغيّر علامة النجاح في الامتحان بعد نشره؟', 'howEvalPassMark'],
    ['كيف أجدد رابط الامتحان المنتهي؟', 'howExamTime'],
    ['how do i renew the expired exam link', 'howExamTime'],
    ['كيف أحدد موعد تسليم الواجب؟', 'howAddHomework'],
    ['كيف أعيد تسمية الشعبة؟', 'howRenameClass'],
    ['how do i rename a class', 'howRenameClass'],
    ['كيف أنسخ شعبة موجودة؟', 'howDuplicateClass'],
    ['كيف أحجب مستخدماً في الرسائل؟', 'howBlock'],
    ['كيف أعرف من قرأ رسالتي؟', 'howReadReceipts'],
    ['how do i know who read my message', 'howReadReceipts'],
    ['كيف أفتح فيديو الدرس من المكتبة؟', 'howLibraryVideos'],
    ['كيف ألعب لعبة الذاكرة بمصطلحات الدرس؟', 'howLessonGames'],
    ['كيف أستخدم راسم الاقترانات في الحصة؟', 'howMathTools'],
    ['كيف أرى جدول الأسبوع على شاشة اليوم؟', 'howTodayScreen'],
    ['كيف أعرف سعر الاشتراك؟', 'howPricing'],
    ['how do i check the subscription price', 'howPricing'],
    ['كيف أستخدم إقرأ بالصوت بدل الكتابة؟', 'howChatVoice'],
    ['كيف أحدّث التطبيق إلى آخر نسخة؟', 'howUpdateApp'],
    ['كيف أبلّغ عن مشكلة في سؤال مولّد؟', 'howReportProblem'],
    ['how do i report a problem in a generated question', 'howReportProblem'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أغير اسم الطالب في الدفتر',
    'كيف أنسخ الدرس من الكتاب',
    'كيف أحجب الإلهاء عن الطلبة',
    'كيف أعرف من فهم الدرس',
    'كيف أستخدم الفيديو في الحصة بفعالية',
    'كيف أحدد موعد تسليم المشروع للطلبة',
    'كيف أعرف سعر الكتاب',
    'كيف أستخدم الصوت في الشرح',
    'كيف أبلغ الطلبة عن مشكلة في الواجب',
    'كيف أخفي الإجابة عن الطلبة أثناء الشرح',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howLinkParent', 'howReissueLoginCode', 'howReleaseResults', 'howPrintExam', 'howEvalPassMark', 'howExamTime', 'howAddHomework', 'howRenameClass', 'howDuplicateClass', 'howBlock', 'howReadReceipts', 'howLibraryVideos', 'howLessonGames', 'howMathTools', 'howTodayScreen', 'howPricing', 'howChatVoice', 'howUpdateApp', 'howReportProblem']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('lesson readiness, homework, exam follow-ups and slide notes — wordings of answers that already existed (twenty-second live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أجهز درس الغد بسرعة من الصفحة الرئيسية؟', 'howLessonPrep'],
    ['ما معنى جاهزية الدرس؟', 'howLessonPrep'],
    ['what does lesson readiness mean', 'howLessonPrep'],
    ['كيف أرسل واجباً لشعبة واحدة فقط؟', 'howAddHomework'],
    ['كيف أعرف الطلاب الذين لم يسلّموا الواجب؟', 'howHomeworkDone'],
    ['كيف أرى أداء الشعبة في هدف معين؟', 'howExamAnalysis'],
    ['كيف أطلب من الطلبة إعادة الامتحان؟', 'howExamRetake'],
    ['how do i ask the students to retake the exam', 'howExamRetake'],
    ['كيف أمسح ورقة امتحان مكتوبة بخط اليد؟', 'howClassScan'],
    ['كيف أضيف سؤالاً يدوياً إلى امتحان؟', 'howEditExamQuestions'],
    ['how do i add a question manually to an exam', 'howEditExamQuestions'],
    ['كيف أضيف ملاحظات المتحدث للشرائح؟', 'howSlideNotes'],
    ['how do i add speaker notes to the slides', 'howSlideNotes'],
    ['كيف أراجع كلمات كتاب الإنجليزي؟', 'howEnglishCorner'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أجهز الطلبة لامتحان الغد',
    'كيف أعرف الطلاب الذين لم يفهموا الدرس',
    'كيف أرى أداء الطالب في الكتابة',
    'كيف أطلب من الطلبة إعادة كتابة الإجابة',
    'كيف أضيف سؤالاً شفهياً في الحصة',
    'كيف أعرف الطلاب الذين لم يحضروا الحصة',
    'كيف أرسل واجباً ممتعاً للطلبة',
    'ما معنى الجاهزية النفسية للطلبة',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howLessonPrep', 'howAddHomework', 'howHomeworkDone', 'howExamAnalysis', 'howExamRetake', 'howClassScan', 'howEditExamQuestions', 'howSlideNotes', 'howEnglishCorner']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('chat history, plan objectives, books, the Math Corner tools and follow-ups after an exam — wordings of answers that already existed (twenty-third live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أمسح سجل المحادثات؟', 'howChatHistory'],
    ['how do i clear the chat history', 'howChatHistory'],
    ['كيف أضيف أهدافاً تعليمية خاصة بي إلى الخطة؟', 'howPlanOptions'],
    ['كيف أرى خطط التدريس القديمة؟', 'howTeachingPlan'],
    ['كيف أحمّل كتاب المعلم للصف العاشر؟', 'howBookDownload'],
    ['كيف أفتح درساً من كتاب الكيمياء؟', 'howSearchLesson'],
    ['كيف أبحث عن تجربة مخبرية؟', 'howLabAbout'],
    ['كيف أستخدم القوانين والصيغ في زاوية الرياضيات؟', 'howMathTools'],
    ['كيف أستخدم محوّل الوحدات؟', 'howMathTools'],
    ['كيف أفتح ركن القرآن لحفظ السورة؟', 'howQuranAbout'],
    ['كيف أرسل رمز الانضمام لأولياء الأمور؟', 'howShareLinkCode'],
    ['كيف أدخل علامات امتحان ورقي يدوياً؟', 'howEditMark'],
    ['كيف أعرف الطلاب المتعثرين بعد الامتحان؟', 'howSupportGroups'],
    ['كيف أجهز ورقة علاجية للمتعثرين؟', 'howRemedial'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أستخدم القوانين في حل المسائل',
    'كيف أمسح السبورة من الكتابة',
    'كيف أحذف سجل الغياب',
    'كيف أحمل الطلبة مسؤولية التعلم',
    'كيف أحدد الطلاب المتعثرين بالملاحظة',
    'كيف أجهز ورقة علاجية بسرعة',
    'كيف أرسل رمز الشكر للطلبة',
    'كيف أفتح باب النقاش في الحصة',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howChatHistory', 'howPlanOptions', 'howTeachingPlan', 'howBookDownload', 'howSearchLesson', 'howLabAbout', 'howMathTools', 'howQuranAbout', 'howShareLinkCode', 'howEditMark', 'howSupportGroups', 'howRemedial']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('games, the calendar, privacy and terms, library searches — wordings of answers that already existed (twenty-fourth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['ما هي ألعاب إقرأ المتاحة؟', 'howGamesList'],
    ['كيف أرى الدروس المجدولة في التقويم؟', 'howCalendar'],
    ['كيف أرى امتحانات زملائي في المدرسة؟', 'howCalendar'],
    ['how do i view my colleagues exams', 'howCalendar'],
    ['كيف أطّلع على سياسة الخصوصية؟', 'howPrivacy'],
    ['how do i read the privacy policy', 'howPrivacy'],
    ['كيف أشاهد شروط الاستخدام؟', 'howTerms'],
    ['كيف أطّلع على شروط الخدمة؟', 'howTerms'],
    ['كيف أبحث في المكتبة عن فيديو لدرس الذرة؟', 'howLibraryVideos'],
    ['كيف أصفّي موارد المكتبة حسب النوع؟', 'howLibraryVideos'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أطلع الطلبة على شروط الامتحان',
    'كيف أرى الدروس التي لم أدرّسها',
    'كيف أرى امتحانات الطلبة السابقة',
    'كيف أبحث عن فيديو لدرس الذرة في يوتيوب',
    'كيف أصفي الماء من الشوائب',
    'كيف أشاهد شروط تفاعل الاستبدال',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howGamesList', 'howCalendar', 'howPrivacy', 'howTerms', 'howLibraryVideos']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});

describe('students, homework, worksheets, exam reminders, book pictures, slides — wordings of answers that already existed (twenty-fifth live pass)', () => {
  const t = (k: string) => `<${k}>`;
  const steps: Array<[string, string]> = [
    ['كيف أضيف طالباً واحداً إلى الشعبة؟', 'howAddStudent'],
    ['كيف أضيف طالبا جديدا', 'howAddStudent'],
    ['كيف أغيّر اسم طالب كتبته خطأ؟', 'howEditStudent'],
    ['كيف أصحح اسم الطالب', 'howEditStudent'],
    ['how do i correct a student\'s name', 'howEditStudent'],
    ['كيف أنشر واجباً على محادثة الشعبة؟', 'howAddHomework'],
    ['how do i post homework in the class chat', 'howAddHomework'],
    ['كيف أحول ورقة العمل إلى اختبار للطلبة؟', 'howSendWorksheet'],
    ['how do i turn the worksheet into a quiz for my students', 'howSendWorksheet'],
    ['كيف أضبط تذكيراً بموعد الامتحان لأولياء الأمور؟', 'howExamParents'],
    ['how do i set a reminder for the exam for the parents', 'howExamParents'],
    ['كيف أضيف صورة الكتاب إلى سؤال في الامتحان؟', 'howEvalFigures'],
    ['كيف أحفظ شرائحي كملف بوربوينت؟', 'howSaveSlides'],
    // Reopening a closed exam was already answered: howCloseExam ends «لفتحه مجددًا اضغط انشر التقييم».
    ['كيف أعيد فتح امتحان مغلق؟', 'howCloseExam'],
  ];
  for (const [q, key] of steps) {
    it(`«${q}» → ${key}`, () => {
      assert.equal(isAppHelpQuery(q), true);
      assert.equal(answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text, `<${key}>`);
    });
  }

  const stayWithModel = [
    'كيف أحوّل ورقة العمل إلى ملف PDF',
    'كيف أغير اسم الطالب في الاختبار الذي كتبه',
    'كيف أضيف صورة الكتاب إلى الشريحة',
    'كيف أحفظ شرائحي كملف صور',
    'كيف أذكّر الطلبة بموعد الامتحان بأسلوب مشوّق',
    'كيف أشرح اسم الطالب في جملة فعلية',
  ];
  for (const q of stayWithModel) {
    it(`«${q}» is not one of these answers`, () => {
      const ids = new Set(['howEditStudent', 'howSendWorksheet', 'howExamParents', 'howEvalFigures', 'howSaveSlides', 'howAddStudent']);
      const a = answerAppHelp(q, /[a-z]/i.test(q) ? 'en' : 'ar', t).text;
      assert.equal(ids.has(a.replace(/[<>]/g, '')), false);
    });
  }
});
