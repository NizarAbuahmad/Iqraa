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
    const lang1 = answerAppHelp('i want to change the language', 'en', t);
    assert.equal(lang1.places[0]?.id, 'settings');
    assert.match(lang1.text, /<settings>/);
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
