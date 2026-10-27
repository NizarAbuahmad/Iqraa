/**
 * One verb for "make me this material", everywhere the chat offers it.
 *
 * The create chips said five different things in Arabic (حضّر / أنشئ / جهّز /
 * اقترح / أنشئ) while the tool screens' own buttons were already «جهّز …» for
 * the worksheet, quiz, homework, activity, slides and game. The words are also
 * what a chip SENDS, so they show up as the teacher's own message in the thread.
 *
 * The rule: «جهّز» for a teaching material, «أنشئ» only for a record (an
 * account, a class, an exam, a code). English is «Create …». What a teacher TYPES
 * is a different matter — the parser keeps understanding every verb, which the
 * last group below holds — so this changes what the app says, not what it hears.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MATERIAL_TYPES, materialPrompt } from '../materialPrompts.ts';
import { CREATE_CHIP } from '../lessonCopilot.ts';
import { defaultTeachingActions } from '../ai/teachingAssistant.ts';
import { artifactFromAsk } from '../ai/askVocabulary.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';
import { topicFromQuery } from '../ai/artifactTopic.ts';
import { PROMPT_CHIPS } from '../homeAiTools.ts';
import { DOCUMENT_QUICK_ACTIONS } from '../documents/quickActions.ts';
import { getT } from '../i18n.ts';

const AR_VERB = 'جهّز';
const AR_OLD = /^(حضّر|حضر|أنشئ|انشئ|اقترح)\s/;
const TOPIC = 'تركيب الاقترانات';
const TOPIC_EN = 'function composition';

describe('what a chip sends', () => {
  for (const type of MATERIAL_TYPES) {
    it(`${type}: Arabic opens with «${AR_VERB}» and names the topic`, () => {
      const text = materialPrompt(type, TOPIC, 'ar');
      assert.ok(text.startsWith(`${AR_VERB} `), text);
      assert.ok(text.includes(TOPIC), text);
    });

    it(`${type}: English opens with "Create" and names the topic`, () => {
      const text = materialPrompt(type, TOPIC_EN, 'en');
      assert.ok(text.startsWith('Create '), text);
      assert.ok(text.includes(TOPIC_EN), text);
    });

    // The chat classifies a message before it reads it, so a verb the router
    // did not take for a request would send the chip down the explain path.
    it(`${type}: the chat routes it to generating a material, in both languages`, () => {
      for (const lang of ['ar', 'en'] as const) {
        const topic = lang === 'ar' ? TOPIC : TOPIC_EN;
        const route = classifyChatIntent(materialPrompt(type, topic, lang), lang, false, undefined, {
          activeLessonTitle: topic,
        });
        assert.equal(route.intent, 'artifact', `${lang}: ${materialPrompt(type, topic, lang)}`);
      }
    });

    // A verb is only worth unifying if the chat still knows what was asked for.
    it(`${type}: the chat reads its own prompt back as that material and that topic`, () => {
      assert.equal(artifactFromAsk(materialPrompt(type, TOPIC, 'ar')), type);
      assert.equal(topicFromQuery(materialPrompt(type, TOPIC, 'ar')), TOPIC);
      assert.equal(artifactFromAsk(materialPrompt(type, TOPIC_EN, 'en')), type);
      assert.equal(topicFromQuery(materialPrompt(type, TOPIC_EN, 'en')), TOPIC_EN);
    });
  }
});

describe('the create chips under the composer', () => {
  for (const type of MATERIAL_TYPES) {
    const chip = CREATE_CHIP[type];

    it(`${type}: label opens with «${AR_VERB}» / "Create"`, () => {
      assert.ok(chip.labelAr.startsWith(`${AR_VERB} `), chip.labelAr);
      assert.ok(chip.labelEn.startsWith('Create '), chip.labelEn);
    });

    it(`${type}: it sends the one shared prompt`, () => {
      assert.equal(chip.promptAr(TOPIC), materialPrompt(type, TOPIC, 'ar'));
      assert.equal(chip.promptEn(TOPIC_EN), materialPrompt(type, TOPIC_EN, 'en'));
    });
  }
});

describe('the follow-up chips under a reply', () => {
  const actions = defaultTeachingActions();

  it('offers all five materials', () => {
    assert.deepEqual(actions.map(a => a.type).sort(), [...MATERIAL_TYPES].sort());
  });

  for (const action of actions) {
    it(`${action.type}: Arabic says what to do, not just the noun`, () => {
      assert.ok(action.labelAr.startsWith(`${AR_VERB} `), action.labelAr);
      assert.ok(action.labelEn.startsWith('Create '), action.labelEn);
    });
  }
});

describe('the home prompt chips and the file quick actions', () => {
  it('home: the three create chips use the verb, in the label and in what they send', () => {
    for (const id of ['act', 'quiz', 'hw']) {
      const chip = PROMPT_CHIPS.find(c => c.id === id)!;
      assert.ok(chip.labelAr.startsWith(`${AR_VERB} `), chip.labelAr);
      assert.ok(chip.promptAr.startsWith(`${AR_VERB} `), chip.promptAr);
      assert.ok(chip.labelEn.startsWith('Create '), chip.labelEn);
      assert.ok(chip.promptEn.startsWith('Create '), chip.promptEn);
    }
  });

  it('files: no prompt that makes a material opens with an old verb', () => {
    for (const action of DOCUMENT_QUICK_ACTIONS) {
      assert.doesNotMatch(action.promptAr, AR_OLD, `${action.id}: ${action.promptAr}`);
    }
  });

  it('files: the five materials open with «جهّز» / "Create"', () => {
    for (const id of ['lesson-plan', 'worksheet', 'homework', 'quiz', 'activity']) {
      const action = DOCUMENT_QUICK_ACTIONS.find(a => a.id === id)!;
      assert.ok(action.promptAr.startsWith(`${AR_VERB} `), action.promptAr);
      assert.ok(action.promptEn.startsWith('Create '), action.promptEn);
    }
  });
});

describe('the tool screens and the help that names them say the same word', () => {
  const t = getT('ar');
  const BUTTONS = [
    ['generateLessonPlanBtn', 'howMakeLessonPlan'],
    ['createWorksheetBtn', 'howMakeWorksheet'],
    ['generateQuizBtn', 'howMakeQuiz'],
    ['generateActivityBtn', 'howMakeActivity'],
  ] as const;

  for (const [button, help] of BUTTONS) {
    it(`${button} opens with «${AR_VERB}»`, () => {
      assert.ok(t(button).startsWith(`${AR_VERB} `), t(button));
    });

    it(`${help} quotes the button as it is spelled`, () => {
      assert.ok(t(help).includes(`«${t(button)}»`), `${help} should quote «${t(button)}»`);
    });
  }
});

describe('what a teacher types is still understood, whichever verb they use', () => {
  const ASKS: [string, string][] = [
    ['حضّر خطة درس عن الدائرة', 'lesson-plan'],
    ['جهّز خطة درس عن الدائرة', 'lesson-plan'],
    ['أنشئ ورقة عمل عن الدائرة', 'worksheet'],
    ['جهّز ورقة عمل عن الدائرة', 'worksheet'],
    ['أنشئ واجباً منزلياً عن الدائرة', 'homework'],
    ['جهّز واجباً منزلياً عن الدائرة', 'homework'],
    ['اقترح نشاطاً صفياً عن الدائرة', 'activity'],
    ['جهّز نشاطاً صفياً عن الدائرة', 'activity'],
    ['جهّز اختباراً قصيراً عن الدائرة', 'quiz'],
    ['أنشئ اختباراً قصيراً عن الدائرة', 'quiz'],
  ];
  for (const [ask, type] of ASKS) {
    it(`«${ask}» is a ${type} about الدائرة`, () => {
      assert.equal(artifactFromAsk(ask), type);
      assert.equal(topicFromQuery(ask), 'الدائرة');
    });
  }
});
