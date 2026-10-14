/**
 * The English counterpart of `lessonPlanVariantsAr.ts`: a second wording for the
 * five sections of a lesson plan that used to have only one, one per teaching
 * style and kind of lesson.
 *
 * Same technique per blueprint as the Arabic variant 1 (fade the last step,
 * sort-then-explain, role-based task, predict-observe-explain, meaning-first
 * recitation, reading with a purpose, test-teach-test, see-think-wonder,
 * part-learning with hint cards, reverse-engineering a model), so a teacher gets
 * the same alternative whichever language the plan is in. It is NOT a
 * translation: the English plan is written as instructions to the teacher («Show
 * the phenomenon…»), as `lessonPlanBlueprints.ts` and `lessonPlanNative.ts` have
 * always written it, while the Arabic plan is the teacher's own first person.
 *
 * What every one of them keeps, and what the tests pin
 * (`lessonPlanVariants.test.ts`): the style's own contract (direct's I-Do / We Do
 * / You Do with an individual last stage, inquiry's conjecture and withheld rule,
 * collaborative's individual accountability), no subject content — method only —
 * and no Arabic. It has NOT been read by a teacher.
 */
import {
  concepts, conceptList, firstConcept, fromDoc, phaseMinutes, term,
  type LessonStyleBlueprint, type LessonStyleContext,
} from './lessonPlanTypes.ts';
import { sciencePlanHasCalculations, type LessonKind } from './lessonPlanKinds.ts';

type Builder = (ctx: LessonStyleContext) => LessonStyleBlueprint;
const m = phaseMinutes;

// ─── The three styles that apply to every kind of lesson ────────────────────

export const directEn1: Builder = ctx => {
  const cs = concepts(ctx, 3);
  const body = cs.length
    ? cs.map((c, i) => `${i + 1}. Show "${c}" inside a short worked problem, and say when it applies and why.`).join('\n')
    : '1. Solve one problem in full at the board and think aloud at every decision.\n2. Re-solve it on a second problem with one step hidden, and have students predict that step.\n3. Write on the board what to watch for in each step.';
  return {
    materials: ['Textbook', 'Board and coloured markers', 'Worked-example card per student', 'Slips of paper for holding up answers', 'Three graded problems (the first half solved)'],
    mainActivity: `(${m(ctx, 0.3)}) – Direct instruction, I-Do model with a think-aloud${fromDoc(ctx)}:\n\n${body}\n• Ask students to follow in silence and mark every step whose reason they cannot give.`,
    guidedPractice: `(${m(ctx, 0.22)}) – We Do, with the last step left to the students:\n\n• Work a shared problem on ${term(ctx)} and leave the final step to the class; each student writes it on a slip of paper and holds it up together.\n• Pick two different answers and ask: "Which is right, and where does the other go wrong?"\n• Write the most common error on the board without naming anyone, and take it apart together before moving on.`,
    independentPractice: `(${m(ctx, 0.18)}) – You Do, with shrinking support:\n\n• This stage is individual by the model's design: each student works three graded problems alone.\n• The first problem is half solved, the second a quarter, the third has no help.\n• Circulate and ask each student to read you their last step and justify it in a sentence.\n• Early finishers write a similar problem for a classmate.`,
    assessment: 'Formative: read what students wrote in the We-Do stage to see which step most of the class stumbles on before they go solo.\nSummative: mark the third problem, solved unaided; it is the signal for who has mastered the step.\nExit ticket: two lines — one step from today\'s solution and why it was legal.',
    differentiation: 'Support: start with a half-solved problem and keep the worked-example card in front of the student until the second problem.\nStretch: ask them to write a problem with a hidden error and hand it to a classmate to find.\nThe principle: everyone passes through the same stages — what varies is how much scaffold you withdraw, and when.',
  };
};

export const inquiryEn1: Builder = ctx => {
  const c0 = firstConcept(ctx);
  return {
    materials: ['Untitled example cards for each group', 'Chart paper and markers', 'Textbook (opened after the exploration, not before)', 'Tape for posting group sheets'],
    mainActivity: `(${m(ctx, 0.3)}) – Inquiry by sorting${fromDoc(ctx)}:\n\n1. Give each group a set of example cards on "${c0}" with no titles and no explanation, and ask them to sort them into two or three piles by what they have in common.\n2. Each group writes on chart paper why it sorted that way, and writes its **conjecture** for the rule that holds each pile together.\n3. Circulate and note what you hear without correcting or steering towards the answer.\n4. Then post the sheets side by side to see where the groups agreed and where they differed.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Comparing and testing the conjectures:\n\n• Do not explain the rule. Ask each group to pick a card from another group's piles and test its conjecture on it: "Does your conjecture work here?"\n• When two conjectures clash, ask the two groups to find a card that settles it.\n• Once the class settles on one wording, write it up and attach the formal term (${term(ctx)}) — the name comes after the idea.`,
    independentPractice: `(${m(ctx, 0.18)}) – A new case tests our conclusion:\n\n• Each student works alone on a new case that was not discussed and judges whether the class's conclusion holds for it.\n• They write two sentences: what they predicted before checking, and what they found after.\n• If the conclusion does not hold, they propose one change to it.\n• Early finishers design a case they think will embarrass the conclusion and pass it to a classmate.`,
    assessment: 'The measure is the soundness of the reasoning, not the speed of reaching the rule.\nFormative: read the groups\' reasons for sorting and tell apart those built on a visible feature of the examples from those built on a hunch with nothing behind it.\nSummative: the new-case sheet — did the student set their prediction against what they found, or only copy down the result?\nExit ticket: "What changed in my conjecture since the start of the lesson?"',
    differentiation: 'Support: use fewer cards, put one guiding question on each sheet ("What repeats across these cards?"), and give a sentence stem for the conjecture.\nStretch: add an odd card that fits no pile and ask them to explain it or change the sorting to take it in.\nThe principle: everyone sorts, conjectures and tests — adjust the number of cards and the amount of guidance, never the student\'s right to work it out.',
  };
};

export const collaborativeEn1: Builder = ctx => {
  const c0 = firstConcept(ctx);
  return {
    materials: ['One rich task card per group', 'Role cards (discussion leader, answer recorder, evidence checker, spokesperson)', 'One answer board per group', 'Number draw for random accountability', 'Short individual assessment sheet'],
    mainActivity: `(${m(ctx, 0.3)}) – Collaborative learning with roles, groups of 3-4${fromDoc(ctx)}:\n\n1. Form groups of three or four and give each member a fixed role for this lesson: discussion leader, answer recorder, evidence checker, spokesperson.\n2. Give each group one rich task card on "${c0}" that cannot be finished without every role contributing.\n3. The group works on the task, and each member signs the group answer once they are convinced by it.\n4. Then call the spokespeople to present, and ask each group to set its answer beside another group's.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Dialogue between groups:\n\n• Pair up the groups: each pair merges its two answers into one, and each group must convince the other with evidence, not volume.\n• Move among the groups and listen; step in only with a question: "What makes you sure?"\n• Write on the board any disagreement the pairs could not settle, and return to it together.`,
    independentPractice: `(${m(ctx, 0.18)}) – Individual accountability:\n\n• Now each student works alone and in silence on a short sheet about the **whole task**, not just their own role.\n• The sheet shows who learned with the group and who leaned on it — and it is part of collaborative learning, not a departure from it.\n• Then draw a number from the bag: that student presents what their group concluded.`,
    assessment: 'Grade the group on the sheet of the student whose number was drawn, not on its strongest member.\nFormative: check each member\'s signature on the group answer and ask one of them about a step they did not write themselves.\nParticipation note: record in each group who filled their role and who did not, and rotate the roles next lesson.',
    differentiation: 'Hand out the roles deliberately: give the member who needs support the "evidence checker" role with a card of ready-made questions — it is a real part the group depends on.\nStretch: the checker role that hunts for a gap in another group\'s answer, or writing a question that tests the whole group\'s understanding.\nThe principle: every member holds a role the group cannot do without — not one working while three watch.',
  };
};

// ─── The direct plan for every kind of lesson that is not mathematics ────────

const scienceEn1: Builder = ctx => {
  const c0 = firstConcept(ctx);
  const list = conceptList(ctx, 3);
  const calc = sciencePlanHasCalculations(ctx.subjectId)
    ? '\n• If the lesson includes a calculation, work one example on the board and show the unit at every step.'
    : '';
  return {
    materials: ['Textbook (the lesson’s photographs and diagrams)', 'A sample, tool or picture to show the phenomenon', 'A “Predict / Observe / Explain” card for each student', 'Board and coloured markers'],
    mainActivity: `(${m(ctx, 0.3)}) – Predict, then observe, then explain${fromDoc(ctx)}:\n\n1. Before any demonstration, describe the situation linked to "${c0}"; each student writes a prediction in the “Predict” box and justifies it in a sentence.\n2. Record the class's predictions on the board with the number of supporters for each, without judging any of them.\n3. Then show the phenomenon, sample or picture, and students record in the “Observe” box what they actually saw.\n4. Explain the concepts in order${list ? `: ${list}` : ''}, and return to the predictions to see which held and which needed changing.\n5. If the demonstration needs materials or equipment, review the safety rules before starting.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Reconciling prediction and observation:\n\n• In pairs, students set what they predicted against what they observed and say what surprised them.\n• Separate what we saw from what we explain it with, and ask of every explanation: “What evidence supports it?”\n• Correct common misconceptions the moment they surface, and have the student restate the explanation in their own words.${calc}`,
    independentPractice: `(${m(ctx, 0.18)}) – Predict and explain alone:\n\n• Present a new situation like the last one and stop before the result is known.\n• Each student writes alone a prediction and its evidence; reveal the result, and they write whether the prediction held and why.\n• They may use their Predict / Observe / Explain card.\n• Early finishers change one variable in the situation and predict what will happen.`,
    assessment: 'Formative: collect the “Predict” cards and check whether each prediction rests on what was already learned or on a guess with nothing behind it.\nSummative: mark the new-situation card; a prediction justified with evidence counts for more than a correct result with no reasoning.\nExit ticket: a prediction of mine that changed today after I saw the evidence.',
    differentiation: 'Support: offer ready-made prediction options (A / B / C) to choose from before justifying, and one clearer picture instead of several.\nStretch: design a situation in which a classmate’s prediction would fail, and explain why.\nThe principle: everyone predicts and explains — vary the scaffold and the complexity of the situation, never a student’s right to be wrong and then learn.',
  };
};

const recitationEn1: Builder = ctx => {
  const list = conceptList(ctx, 4);
  return {
    materials: ['Textbook (the set text)', 'A card with the text split into short sections, for each pair', 'Vocabulary-meaning card', 'A follow-up card for each pair to note words that need repeating'],
    mainActivity: `(${m(ctx, 0.3)}) – Meaning first, then performance${fromDoc(ctx)}:\n\n1. Open with a situation or question from students’ lives that leads into the lesson’s idea, then state the main idea in one sentence before the text is read.\n2. Read the set text (or recite it in measured recitation if it is Quran) in short sections, pausing after each to ask what it means while students follow with their eyes.\n3. ${list ? `Explain the new words using the textbook’s meanings: ${list}` : 'Explain the new words using the textbook’s meanings'}, then read the section again now that students understand it.\n4. After that, students repeat the section after you, first together and then one at a time; correct mistakes calmly and without embarrassment.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Perfecting the delivery in turns:\n\n• Students read in pairs, taking turns: one reads a section while the other listens and marks on the follow-up card every word that needs repeating, then they swap.\n• Move between the pairs and listen, noting the words that more than one pair stumbles on so you can repeat them with the class.\n• Ask graduated comprehension questions: “What does the word mean? What is the main idea? What does the lesson ask of us?”\n• If the text is to be memorised, split it into short sections and have the class master one before moving to the next.`,
    independentPractice: `(${m(ctx, 0.18)}) – Mastering and applying alone:\n\n• Each student reviews their section quietly, then recites it to a classmate who knows it or to you, one at a time while the rest continue.\n• Each picks a real situation from their day and describes in two sentences how they would apply the value learned.\n• Early finishers write a comprehension question on the section and put it to a classmate.`,
    assessment: 'Formative: read the follow-up cards to learn which words most of the class stumbled on, and retrain them before hearing anyone recite.\nSummative: ask each student to explain the meaning of their section in their own words and then recite it, to see whether they understand what they are performing.\nConsider each student’s starting point: progress matters more than comparison with classmates.\nExit ticket: one sentence beginning “Today I will apply…”',
    differentiation: 'Support: break the section into smaller units and start with a whispered group reading before reading alone; give a card in a larger font with the hard words coloured.\nStretch: choose the word they think is the key to the section and tell classmates why, or lead a pair in following the reading.\nThe principle: every student has their own starting point — make stumbling a chance to repeat, not a moment of embarrassment.',
  };
};

const arabicEn1: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['Textbook (the lesson text)', 'New-vocabulary cards', 'A sheet for questions before reading', 'A short response sheet'],
    mainActivity: `(${m(ctx, 0.3)}) – Reading with a purpose${fromDoc(ctx)}:\n\n1. Before reading, show the title of the text and any picture with it; students predict the topic, and each writes one question they want the text to answer.\n2. Read the text expressively while students follow with their eyes and underline every word whose meaning they do not know.\n3. Collect the new words together and try to work out each from context before revealing its meaning: “What in the sentence points to it?”\n4. ${list ? `Then link what was read to the concepts that come up: ${list}, and return to the students’ questions to see what the text answered` : 'Then name the language skill the lesson targets and return to the students’ questions to see what the text answered'}. If it is a language lesson, show examples from the text and work out the rule together before wording it.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Read and answer together:\n\n• Students read in small groups, each with a role: reader, new-word spotter, paragraph summariser.\n• Then they answer the questions they wrote before reading: what did the text answer? What did it leave unanswered?\n• Visit each group and ask them to write one sentence using a new word, and correct it with them.`,
    independentPractice: `(${m(ctx, 0.18)}) – Write my response alone:\n\n• Each student writes a short response to the text (4–5 sentences) beginning with a stem of their choice: “I liked that…”, “I learned that…”, “I think that…”.\n• They read their response quietly to catch their own errors before handing it in.\n• Early finishers write a question they could put to the author of the text.`,
    assessment: 'Formative: read the questions students wrote before reading and see whether they found the answers afterwards; listen for reading fluency in the groups.\nSummative: mark the individual response against clear criteria: language accuracy, clarity of idea, support for an opinion from the text.\nExit ticket: a new word I learned and a sentence I can use it in.',
    differentiation: 'Support: give the text in short paragraphs, offer sentence starters for the response, and allow reading with a partner before reading alone.\nStretch: propose a different title for the text and justify it, or rewrite a paragraph in another style (dialogue, letter).\nThe principle: reading and writing grow with practice — change the length of the text and the amount of support, not a student’s right to understand and express.',
  };
};

const englishEn1: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['Textbook', 'Short task cards for the first and last tasks', 'Pictures or vocabulary cards', 'A sheet for noting common errors'],
    mainActivity: `(${m(ctx, 0.3)}) – Test first, then teach (Test–Teach)${fromDoc(ctx)}:\n\n1. Open with a short communication task that needs the target language, without teaching it first, and let students try with what they already have in pairs.\n2. Circulate and listen, noting on your sheet what students managed and where they struggled, with no correction yet.\n3. Then teach the target form from their own errors and gaps: write sentences you heard (no names) on the board and work through them${list ? ` (${list})` : ''}.\n4. Model each new item two or three times; students repeat chorally, then individually.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Guided practice and a second attempt:\n\n• Students repeat the first task in new pairs, now using the form they have just learned.\n• An information-gap or card-matching activity to fix the form.\n• Listen and compare what you heard in the first attempt with this one to see what has improved, then deal with remaining errors in front of the class without names.`,
    independentPractice: `(${m(ctx, 0.18)}) – A final task alone:\n\n• Each student carries out a task like the first one on their own, using the new language.\n• Then they write two sentences: what has improved since before the teaching, and what still needs practice.\n• Early finishers add a reason or a second example to lengthen their answer.`,
    assessment: 'Formative: set what you heard in the first task against the last to see what the teaching actually added.\nSummative: mark the individual task against criteria: accuracy, clarity, use of the target language.\nExit ticket: one sentence I could not say at the start of the lesson.',
    differentiation: 'Support: give sentence frames and picture prompts in the first task, and allow written preparation before speaking.\nStretch: a slightly harder final task (adding a reason, a comparison or a possibility), or writing a short dialogue.\nThe principle: everyone tries before the teaching and tries again after it — change the support, not the number of attempts.',
  };
};

const socialEn1: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['Textbook (the lesson’s texts and sources)', 'A picture or printed source for each group', 'A three-column sheet: “I see / I think / I wonder”', 'Board and coloured markers'],
    mainActivity: `(${m(ctx, 0.3)}) – See, think, wonder${fromDoc(ctx)}:\n\n1. Show the lesson’s source (a picture, a short text, a map or a timeline) and let students study it in silence for a full minute.\n2. Each group writes in the first column what it actually sees, in the second what it thinks the source shows, and in the third what it wonders about.\n3. Collect the groups’ questions on the board and sort them: which the lesson answers and which need research.\n4. ${list ? `Then explain the concepts of the lesson that answer the questions: ${list}` : 'Then explain the concepts of the lesson that answer the questions'}, and record causes and consequences in a diagram.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Tie the evidence to the conclusion:\n\n• Each pair picks one conclusion from the second column and backs it with a phrase or detail from the source.\n• Put two conflicting conclusions to the class and ask: “Which evidence is stronger, and why?” — each student defends their view with evidence.\n• Remind them of the manners of discussion: we listen first, then disagree with evidence, not volume.`,
    independentPractice: `(${m(ctx, 0.18)}) – Analyse a new source alone:\n\n• Give each student a short new source to fill in the “I see / I think / I wonder” columns on their own.\n• Then each writes a short paragraph answering “why?” using what they saw in the source.\n• Early finishers compare their source with a classmate’s on three points.`,
    assessment: 'Formative: read the “I think” column and tell apart what rests on what the source shows from what rests on earlier knowledge or a hunch.\nSummative: mark the individual paragraph against criteria: accuracy of information, soundness of the reason, support from the source.\nExit ticket: one question that still puzzles me after today’s lesson.',
    differentiation: 'Support: offer a shorter, clearer source, and fill in one line of the first column with the student as a model.\nStretch: give two sources that tell the story differently and ask why they differ.\nThe principle: everyone sees, thinks and wonders — change the length of the source and the amount of support, not a student’s right to ask.',
  };
};

const movementEn1: Builder = ctx => ({
  materials: ['The field or hall, checked clear of obstacles', 'Equipment for the lesson (balls, cones, ropes… as the skill needs)', 'Pictured hint cards for each station', 'A whistle and a stopwatch'],
  mainActivity: `(${m(ctx, 0.3)}) – Warm-up, then learn the skill in parts${fromDoc(ctx)}:\n\n1. A general warm-up, then one specific to the skill: light jogging and dynamic stretches for the muscles that will work.\n2. Review the safety rules and the spacing between groups before anyone moves, and fix the signal for an immediate stop.\n3. Split the skill “${ctx.topic}” into two or three parts and demonstrate each part alone in a clear voice, then join them in a complete performance.\n4. Students try each part on its own while you circulate and correct.`,
  guidedPractice: `(${m(ctx, 0.22)}) – Stations with hint cards:\n\n• Split students into stations; each has a pictured card showing the performance point required and a common error to avoid.\n• In each pair a performer and an observer compare the performance with the hint card, then swap.\n• Give each student one short, specific piece of feedback: “You nailed…, now try to…”\n• Stop the activity immediately at any sign of danger.`,
  independentPractice: `(${m(ctx, 0.18)}) – Beat your own best in a full performance:\n\n• Each student performs the whole skill on a short course and tries to improve one performance point of their own choosing.\n• They note their first and last attempt on their card and compare themselves with themselves, not with others.\n• Those who master it early raise the challenge (greater distance or more speed) or take over observing.\n• Finish with a cool-down and stretching.`,
  assessment: 'Formative: watch one performance point at each station and note who needs an individual demonstration.\nSummative: a checklist (executing the parts, joining them, safety, teamwork) rather than the result alone.\nExit ticket: one performance point I improved today.',
  differentiation: 'Support: lighter or larger equipment, extra attempts on one part before joining the parts, and an encouraging partner.\nStretch: joining the parts at greater speed, or a decision to make during the performance.\nThe principle: everyone moves and improves — each student’s progress is measured against themselves.\nHealth note: a student with a medical exemption takes the observer or referee role.',
});

const makingEn1: Builder = ctx => {
  const list = conceptList(ctx, 3);
  return {
    materials: ['The lesson’s tools and materials (as the activity needs)', 'A finished model for students to examine', 'A work-quality criteria card', 'A workspace for each student or group', 'Small stickers for peer feedback'],
    mainActivity: `(${m(ctx, 0.3)}) – Examine a model, then learn the technique${fromDoc(ctx)}:\n\n1. Place a finished example of the work required in “${ctx.topic}” in front of each group and ask them to imagine how it was made and to order the steps on a sheet.\n2. Show the correct steps and set them against the groups’ guesses, thinking aloud at each decision.\n3. Fix ${list ? `the concepts and terms: ${list}` : 'the key terms and tools'} on the board.\n4. Review the safety rules and how to organise the tools before anyone starts work.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Make the first part together:\n\n• Students carry out the first step as you demonstrate, while you circulate and correct.\n• After each step the student pauses and compares their work with the criteria card and with the model.\n• Encourage trying things and productive mistakes: “What if we tried…?”`,
    independentPractice: `(${m(ctx, 0.18)}) – Make my own work:\n\n• Each student finishes their work in their own way against the criteria, with clear room for choice.\n• At the end, a mini-exhibition: each student leaves their work on their desk, classmates walk round, and each visitor leaves a sticker noting one strength and one wish.\n• Early finishers help a classmate with one step without doing it for them.`,
    assessment: 'Formative: set the order of steps the groups guessed against the correct order to see where understanding slipped, and review work in progress against the criteria card.\nSummative: assess the work against criteria announced in advance: mastery of the technique, organisation, creativity, safety.\nExit ticket: a strength a classmate wrote about my work and one wish I will work on.',
    differentiation: 'Support: pictured steps, a simplified criteria card, and a ready-made part to start from.\nStretch: an extra element or a new constraint on the work, or writing two-step advice for a classmate.\nThe principle: everyone makes and evaluates — change the amount of support and the complexity, not the chance to make something.',
  };
};

const NATIVE_1_EN: Partial<Record<LessonKind, Builder>> = {
  science: scienceEn1,
  recitation: recitationEn1,
  arabic: arabicEn1,
  english: englishEn1,
  social: socialEn1,
  movement: movementEn1,
  making: makingEn1,
};

/** The direct plan's English variant 1 for a kind that has its own routine, or null for `calc`. */
export function nativeDirectVariant1En(ctx: LessonStyleContext): LessonStyleBlueprint | null {
  const build = NATIVE_1_EN[ctx.kind ?? 'calc'];
  return build ? build(ctx) : null;
}
