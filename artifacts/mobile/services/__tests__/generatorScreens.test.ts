// The generator screens (docs/superpowers/specs/2026-10-23-generator-screens-design.md):
// the band wears the tool, the lesson is one card, short lists become touch
// controls, and the button says what you will get.
//
// The runner is bare `node --test`: it cannot load react-native, so a screen is
// pinned by reading its source. These tests pin the spec's INVARIANTS (state and
// saved positions untouched, TopicSelector never unmounted, validation kept,
// no hand-written colour) and the parts that are only arithmetic (white text on
// every band). How it LOOKS is checked in the browser, not here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONCEPTS } from '../../constants/icons.ts';
import { bandGradient } from '../band.ts';
import { contrast, readableOn, tintOver, selectedRow } from '../readableColor.ts';
import { chipLocked } from '../chipRules.ts';
import { generationPhase } from '../generationPhase.ts';
import translations from '../i18n.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
/** Code only: a comment may name `palette` or a colour to explain why it is not used. */
const code = (src: string) => src.split('\n').filter(l => !/^\s*(\/\/|\/?\*)/.test(l)).join('\n');

const GENERATOR_DIR = join(ROOT, 'components', 'generator');
const generatorFiles = readdirSync(GENERATOR_DIR).filter(f => f.endsWith('.tsx'));

// ── The band ────────────────────────────────────────────────────────────────

const blendWhite = (alpha: number, hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const mixed = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.round(255 * alpha + c * (1 - alpha)));
  return '#' + mixed.map(c => c.toString(16).padStart(2, '0')).join('');
};

test('white text reads on both stops of every concept band, at the alphas ToolHeader draws', () => {
  // title #fff; subtitle rgba(255,255,255,0.95); the AI-source badge on a dark band 0.92.
  for (const [id, concept] of Object.entries(CONCEPTS)) {
    for (const stop of bandGradient(concept.color)) {
      for (const alpha of [1, 0.95, 0.92]) {
        const text = alpha === 1 ? '#FFFFFF' : blendWhite(alpha, stop);
        assert.ok(contrast(text, stop) >= 4.5, `${id}: white at ${alpha} on ${stop} is ${contrast(text, stop).toFixed(2)}:1`);
      }
    }
  }
});

test('ToolHeader draws a concept band with Band, and asks for light status-bar icons', () => {
  const src = read('components', 'ui', 'ToolHeader.tsx');
  assert.match(src, /<Band\b[^>]*color=\{conceptOf\(concept\)\.color\}/, 'a concept band must take the concept colour');
  assert.match(src, /useLightStatusBar\(\)/, 'a band under the status bar must call useLightStatusBar');
  assert.match(src, /backgroundColor: colors\.hero/, 'without a concept the band stays the brand teal');
});

// ── The shared pieces ───────────────────────────────────────────────────────

test('the shared pieces exist, one per file', () => {
  for (const name of ['SegmentedControl', 'Stepper', 'ChipGroup', 'LessonCard', 'DockedAction', 'GeneratorLayout', 'PaperPreview']) {
    assert.ok(generatorFiles.includes(`${name}.tsx`), `components/generator/${name}.tsx is missing`);
  }
});

test('no shared piece imports the global palette or writes a colour by hand', () => {
  // PaperPreview's sheet is paper (white, ink) in dark mode too: it stands for the printout, not for the app's surface.
  const PAPER = new Set(['#FFFFFF', '#0B1B33', '#5C6675', '#E3E8E7']);
  for (const file of generatorFiles) {
    const src = code(read('components', 'generator', file));
    assert.doesNotMatch(src, /import[^;]*\bpalette\b[^;]*from/, `${file} imports the global palette (it ignores the corner provider); use useColors()`);
    const hexes = (src.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).map(h => h.toUpperCase());
    const stray = file === 'PaperPreview.tsx' ? hexes.filter(h => !PAPER.has(h)) : hexes;
    assert.deepEqual(stray, [], `${file} writes a colour by hand: ${stray.join(', ')}`);
    // Depth and any other colour come from the tokens: ELEVATION (through useSurface()), never a hand-written shadow or rgba().
    assert.doesNotMatch(src, /\bshadowColor\s*:/, `${file} writes a shadowColor; use ELEVATION`);
    assert.doesNotMatch(src, /\bboxShadow\s*:(?!\s*ELEVATION\.)/, `${file} writes a boxShadow by hand; use ELEVATION`);
    assert.doesNotMatch(src, /\brgba?\(/, `${file} writes an rgb()/rgba() colour by hand`);
  }
});

test('state is declared with aria-* props, and nothing lifts for the keyboard inside a screen', () => {
  for (const file of generatorFiles) {
    const src = code(read('components', 'generator', file));
    assert.doesNotMatch(src, /accessibilityState=/, `${file}: react-native-web ignores accessibilityState`);
    assert.doesNotMatch(src, /KeyboardAvoidingView/, `${file}: the root Stack already wraps every screen in KeyboardSafeView`);
  }
  assert.match(read('components', 'generator', 'SegmentedControl.tsx'), /aria-checked=/);
  assert.match(read('components', 'generator', 'ChipGroup.tsx'), /aria-pressed=/);
});

test('every control is a 44-point target', () => {
  for (const file of ['SegmentedControl', 'ChipGroup']) {
    assert.match(read('components', 'generator', `${file}.tsx`), /minHeight: 44/, `${file} is under 44 points`);
  }
  assert.match(read('components', 'generator', 'Stepper.tsx'), /width: 44, height: 44/);
  assert.match(read('components', 'generator', 'LessonCard.tsx'), /minHeight: 44/);
  assert.match(read('components', 'generator', 'DockedAction.tsx'), /minHeight: 50/);
});

test('motion goes through PressableScale (which honours reduced motion), and cards through useSurface', () => {
  for (const file of ['SegmentedControl', 'Stepper', 'ChipGroup', 'LessonCard', 'DockedAction']) {
    const src = read('components', 'generator', `${file}.tsx`);
    assert.match(src, /PressableScale/, `${file} presses without PressableScale`);
    assert.doesNotMatch(src, /\bAnimated\./, `${file} animates by hand; PressableScale already checks useReduceMotion`);
  }
  for (const file of ['Stepper', 'LessonCard', 'DockedAction', 'PaperPreview']) {
    const src = code(read('components', 'generator', `${file}.tsx`));
    assert.match(src, /useSurface\(\)/, `${file} is a card without useSurface`);
  }
});

test('the docked bar hides while the keyboard is open, on a phone only', () => {
  const src = read('components', 'generator', 'DockedAction.tsx');
  assert.match(src, /useKeyboardVisible\(\)/);
  assert.match(src, /docked && keyboardOpen/);
});

test('the lesson card never unmounts its body: collapsed is display none, hidden from the accessibility tree', () => {
  const src = read('components', 'generator', 'LessonCard.tsx');
  assert.match(src, /display: 'none'/);
  assert.match(src, /aria-hidden=\{!open\}/);
  assert.match(src, /no-hide-descendants/);
  assert.equal((src.match(/\{children\}/g) ?? []).length, 1);
  assert.ok(childrenRenderedUnconditionally(code(src)), 'children must be the sole child of a View that is rendered in both states');
  // `locked` is honoured here, not only by the screen: no one-render flash with the body folded.
  assert.match(src, /const open = expanded \|\| locked;/);
});

/**
 * The body is `<View …>{children}</View>` and nothing conditional wraps that View: not `{expanded && (`,
 * not `{expanded ? (` (on one line or several), and no early `return` on `expanded`.
 */
function childrenRenderedUnconditionally(src: string): boolean {
  const m = /<View\b[^>]*>\s*\{children\}\s*<\/View>/.exec(src);
  if (!m) return false;
  if (/(&&|\?|:)\s*\(?\s*$/.test(src.slice(0, m.index))) return false;
  if (/if\s*\([^)]*(expanded|open|locked)[^)]*\)\s*return\b/.test(src)) return false;
  return true;
}

test('the children check catches every way of unmounting the body', () => {
  assert.ok(childrenRenderedUnconditionally('<View style={open ? a : b}>\n  {children}\n</View>'));
  assert.ok(!childrenRenderedUnconditionally('{expanded && <View>{children}</View>}'));
  assert.ok(!childrenRenderedUnconditionally('{expanded && (\n  <View style={s}>\n    {children}\n  </View>\n)}'));
  assert.ok(!childrenRenderedUnconditionally('{expanded ? (\n  <View>\n    {children}\n  </View>\n) : null}'));
  assert.ok(!childrenRenderedUnconditionally('if (!expanded) return null;\n<View>{children}</View>'));
});

test('the stepper is one row layout at every width and not a live region', () => {
  const src = code(read('components', 'generator', 'Stepper.tsx'));
  assert.doesNotMatch(src, /stacked/, 'three steppers side by side overflowed their cards');
  assert.doesNotMatch(src, /aria-live/, 'a live value made a screen reader announce each step twice');
  assert.match(code(read('components', 'generator', 'DockedAction.tsx')), /aria-live="polite"/, 'the summary is the one live region');
});

test('the desktop layout uses the same breakpoint as the tab layout', () => {
  const src = read('components', 'generator', 'GeneratorLayout.tsx');
  assert.match(src, /useViewportWidth\(\) >= DESKTOP_BREAKPOINT/);
});

test('the preview shows the shape of the paper, not questions', () => {
  const src = code(read('components', 'generator', 'PaperPreview.tsx'));
  assert.doesNotMatch(src, /\bquestions\b/, 'a preview takes skeleton rows, never generated questions');
});

// ── The quiz ────────────────────────────────────────────────────────────────

const quiz = read('app', 'ai-tools', 'quiz.tsx');
const quizCode = code(quiz);

test('the quiz imports every shared piece and draws its controls with them', () => {
  for (const name of ['SegmentedControl', 'Stepper', 'ChipGroup', 'LessonCard', 'DockedAction', 'GeneratorLayout', 'PaperPreview']) {
    assert.match(quiz, new RegExp(`from '@/components/generator/${name}'`), `quiz.tsx does not import ${name}`);
    assert.match(quizCode, new RegExp(`<${name}\\b`), `quiz.tsx imports ${name} and does not draw it`);
  }
});

test('the quiz keeps TopicSelector mounted: inside the lesson card, never behind a condition', () => {
  assert.match(quizCode, /<TopicSelector\b/);
  assert.match(quizCode, /<LessonCard[\s\S]*<TopicSelector\b[\s\S]*<\/LessonCard>/, 'TopicSelector must sit inside LessonCard');
  assert.doesNotMatch(quizCode, /lessonOpen\s*(\?|&&)/, 'the open state may only change the card, never mount or unmount the pickers');
  // The pickers the card wraps are the same ones, with the teacher's scope applied.
  assert.match(quizCode, /<PickerField label=\{t\('grade'\)\}[^>]*hidden=\{teacherScope\.gradeHidden\}/);
  assert.match(quizCode, /<StrandedSelectionNote\b/);
  assert.match(quizCode, /<PickerField label=\{t\('subjects'\)\}[^>]*hidden=\{subjectHidden\}/);
});

test('the quiz still carries the lesson by id and keeps its state names', () => {
  assert.match(quizCode, /usePickedLesson\(/);
  assert.match(quizCode, /resolveGeneratorGrounding\(/);
  assert.match(quizCode, /lessonId: pickedLesson\.lessonId/);
  for (const name of ['gradeIdx', 'subjectIdx', 'durationIdx', 'marksIdx', 'numQIdx', 'diffIdx', 'selectedTypes']) {
    const cap = name[0]!.toUpperCase() + name.slice(1);
    assert.match(quizCode, new RegExp(`\\[${name}, set${cap}\\] = useState`), `state ${name} was renamed or removed`);
  }
});

test('saved positions keep their meaning: the same arrays, the same formState', () => {
  assert.match(quiz, /const DURATION_OPTIONS = \[10, 15, 20, 25, 30, 45\];/);
  assert.match(quiz, /const MARKS_OPTIONS = \[10, 20, 25, 30, 40, 50, 100\];/);
  assert.match(quiz, /const NUM_Q_OPTIONS = ALL_QUESTION_COUNTS;/);
  assert.match(quiz, /durationIdx, marksIdx, numQIdx: effNumQIdx, diffIdx, selectedTypes: JSON\.stringify\(Array\.from\(selectedTypes\)\)/);
  // A stepper moves an index through the real option array.
  assert.match(quizCode, /<Stepper label=\{t\('numQuestionsLabel'\)\} options=\{numQLabels\.slice\(0, visibleCountOptions\(wideScope\.isWide\)\)\} index=\{effNumQIdx\} onChange=\{setNumQIdx\}/);
  assert.match(quizCode, /<Stepper label=\{t\('quizDurationLabel'\)\} options=\{durationLabels\} index=\{durationIdx\} onChange=\{setDurationIdx\}/);
  assert.match(quizCode, /<Stepper label=\{t\('totalMarksLabel'\)\} options=\{marksLabels\} index=\{marksIdx\} onChange=\{setMarksIdx\}/);
  assert.match(quizCode, /<SegmentedControl label=\{t\('levelLabel'\)\} options=\{diffLabels\} index=\{diffIdx\} onChange=\{setDiffIdx\}/);
});

test('no dropdown is left for a list of at most four labels', () => {
  assert.doesNotMatch(quizCode, /<PickerField\b[^>]*label=\{t\('(levelLabel|quizDurationLabel|totalMarksLabel|numQuestionsLabel|distributionLabel)'\)\}/);
});

test('question types are chips over QUIZ_TYPE_ORDER with the existing at-least-one rule', () => {
  assert.match(quizCode, /QUIZ_TYPE_ORDER\.map\(type => \(\{ id: type, label: TYPE_LABEL\[type\] \}\)\)/);
  assert.match(quizCode, /<ChipGroup\b[^>]*onToggle=\{toggleType\}[^>]*min=\{1\}/);
  assert.match(quizCode, /if \(next\.size === 1\) return prev;/, 'toggleType lost its last-type guard');
});

test('the distribution control appears on a wide scope only', () => {
  assert.match(quizCode, /\{wideScope\.isWide && \(\s*<SegmentedControl\s+label=\{t\('distributionLabel'\)\}/);
  assert.match(quizCode, /wideScope\.setDistribution\(DISTRIBUTIONS\[i\]!\)/);
});

test('validation and the disabled state are unchanged', () => {
  assert.match(quizCode, /disabled=\{!topic\.trim\(\)\}/);
  // Not needTopicHint: it says «أعلاه»/"above", wrong when the button is in the desktop side column.
  assert.match(quizCode, /hint=\{t\('genNeedLessonHint'\)\}/);
  assert.doesNotMatch(quizCode, /needTopicHint/);
  assert.doesNotMatch(quizCode, /stacked=/, 'the steppers are one column at every width');
  assert.match(quizCode, /\{error && !topic\.trim\(\) \? <Text/);
  assert.match(quizCode, /hasError=\{!!error && !topic\}/);
  assert.match(quizCode, /if \(!topic\.trim\(\)\) \{ setError\(t\('topicRequired'\)\); return; \}/);
  assert.doesNotMatch(quizCode, /<Button\b/, 'the generate button is the DockedAction now');
});

test('the generate bar yields to the result save bar and sits under the preview on desktop', () => {
  assert.match(quizCode, /hidden=\{docked && saveBarVisible\}/);
  assert.match(quizCode, /\{isDesktop \? null : action\(true\)\}/);
  assert.match(quizCode, /\{action\(false\)\}/);
});

test('the quiz wears its concept colour and does not use the global palette for it', () => {
  assert.match(quizCode, /const ACCENT = conceptOf\('quiz'\)\.color;/);
  assert.doesNotMatch(quizCode, /ACCENT_FILL/);
  assert.doesNotMatch(quizCode, /const ACCENT = palette/);
});

test('generation, saving and the result are untouched', () => {
  assert.match(quizCode, /aiService\.generateQuiz\(/);
  assert.match(quizCode, /<GenerationStatus\b/);
  assert.match(quizCode, /<GeneratorResultActions\b/);
  assert.match(quizCode, /<GeneratorSaveBar\b/);
});

test('a stranded grade/subject pair keeps the lesson card open, so its note is never folded away', () => {
  // The note renders inside the card's body; the card cannot fold while it applies.
  assert.match(quizCode, /const stranded = subjectHidden\?\.\[subjectIdx\] === true;/, 'must be the same test StrandedSelectionNote makes');
  assert.match(quizCode, /expanded=\{lessonOpen \|\| stranded\}/);
  assert.match(quizCode, /locked=\{!topic\.trim\(\) \|\| stranded\}/);
  assert.match(quizCode, /<LessonCard[\s\S]*<StrandedSelectionNote\b[\s\S]*<\/LessonCard>/, 'the note is part of the card body');
});

test('a refusal, an error or the spinner scrolls into view above a docked button, without a flash or reduced-motion animation', () => {
  assert.match(quizCode, /const statusPhase = generationPhase\(\{ loading, cancelled, failed: !!\(error && topic\.trim\(\)\) \}\);/);
  assert.match(quizCode, /<GenerationStatus\s+phase=\{statusPhase\}/);
  // The position comes from the wrapper's own layout, recorded without a re-render.
  assert.match(quizCode, /<View onLayout=\{e => \{ statusY\.current = e\.nativeEvent\.layout\.y; \}\}>\s*<GenerationStatus/);
  // Before paint (no flash of the form first), docked bar only, never for 'idle'.
  assert.match(quizCode, /useLayoutEffect\(\(\) => \{\s*if \(isDesktop \|\| statusPhase === 'idle'\) return;/);
  assert.match(quizCode, /scrollRef\.current\?\.scrollTo\(\{ y: Math\.max\(0, statusY\.current - SPACE\.lg\), animated: !reduceMotion \}\);\s*\}, \[statusPhase, attempt\]\);/);
  assert.match(quizCode, /const reduceMotion = useReduceMotion\(\);/);
});

// ── ChipGroup: a disabled option ────────────────────────────────────────────

test('a chip can be disabled: dimmed, aria-disabled, inert, still a 44-point target', () => {
  const src = code(read('components', 'generator', 'ChipGroup.tsx'));
  assert.match(src, /disabled\?: boolean;/, 'ChipOption lost its optional disabled flag');
  assert.match(src, /aria-disabled=\{locked \|\| off\}/);
  assert.match(src, /disabled=\{off\}/);
  assert.match(src, /if \(locked \|\| off \|\| \(single && on\)\) return;/, 'a disabled chip must not call onToggle');
  assert.match(src, /opacity: off \? 0\.5 : 1/);
  assert.match(src, /minHeight: 44/);
  // The quiz passes no disabled flag, so none of it changes for the quiz.
  assert.doesNotMatch(quizCode, /disabled: /);
});

// ── DockedAction: an optional secondary action ──────────────────────────────

test('DockedAction takes an optional secondary action beside the primary, and the quiz does not pass one', () => {
  const src = code(read('components', 'generator', 'DockedAction.tsx'));
  assert.match(src, /secondary\?: DockedSecondary;/);
  assert.match(src, /\{secondary \? \(/);
  // The shared rules still cover the whole spot, whichever buttons it holds.
  assert.match(src, /if \(hidden \|\| \(docked && keyboardOpen\)\) return null;/);
  assert.match(src, /const note = disabled && hint \? hint : summary;/);
  // Never pressable while the primary is loading, so one tap cannot start two generations.
  assert.match(src, /secondary\.disabled === true \|\| loading/);
  assert.match(src, /aria-disabled=\{secondaryOff\}/);
  assert.match(src, /secondaryInk = readableOn\(accent, colors\.card\)/, 'the outlined label must stay readable on the dark card');
  assert.doesNotMatch(quizCode, /secondary=/);
});

// ── The worksheet / homework screen ─────────────────────────────────────────

const worksheet = read('app', 'ai-tools', 'worksheet.tsx');
const worksheetCode = code(worksheet);
const lessonPlan = read('app', 'ai-tools', 'lesson-plan.tsx');
const lessonPlanCode = code(lessonPlan);
const activity = read('app', 'ai-tools', 'activity.tsx');
const activityCode = code(activity);
const slides = read('app', 'ai-tools', 'slides.tsx');
const slidesCode = code(slides);

test('the worksheet imports every shared piece and draws its controls with them', () => {
  for (const name of ['SegmentedControl', 'Stepper', 'ChipGroup', 'LessonCard', 'DockedAction', 'GeneratorLayout', 'PaperPreview']) {
    assert.match(worksheet, new RegExp(`from '@/components/generator/${name}'`), `worksheet.tsx does not import ${name}`);
    assert.match(worksheetCode, new RegExp(`<${name}\\b`), `worksheet.tsx imports ${name} and does not draw it`);
  }
});

test('the worksheet keeps TopicSelector mounted: inside the lesson card, never behind a condition', () => {
  assert.equal((worksheetCode.match(/<TopicSelector\b/g) ?? []).length, 1);
  assert.match(worksheetCode, /<LessonCard[\s\S]*<TopicSelector\b[\s\S]*<\/LessonCard>/, 'TopicSelector must sit inside LessonCard');
  assert.doesNotMatch(worksheetCode, /lessonOpen\s*(\?|&&)/, 'the open state may only change the card, never mount or unmount the pickers');
  assert.match(worksheetCode, /allowedKinds=\{\['lesson', 'unit', 'semester', 'book'\]\}/);
  assert.match(worksheetCode, /onScopeChange=\{wideScope\.setScopeSel\}\s+offlineWideScope/);
  assert.match(worksheetCode, /hasError=\{!!error && !topic\}/);
  // The pickers the card wraps are the same ones, with the teacher's scope applied.
  assert.match(worksheetCode, /<PickerField label=\{t\('grade'\)\}[^>]*hidden=\{teacherScope\.gradeHidden\}/);
  assert.match(worksheetCode, /<StrandedSelectionNote\b/);
  assert.match(worksheetCode, /<PickerField label=\{t\('subjects'\)\}[^>]*hidden=\{subjectHidden\}/);
  assert.match(worksheetCode, /<LessonCard[\s\S]*<StrandedSelectionNote\b[\s\S]*<\/LessonCard>/, 'the note is part of the card body');
});

test('the worksheet still carries the lesson by id, and keeps its state names and saved positions', () => {
  assert.match(worksheetCode, /usePickedLesson\(/);
  assert.match(worksheetCode, /resolveGeneratorGrounding\(/);
  assert.match(worksheetCode, /lessonId: pickedLesson\.lessonId/);
  for (const name of ['gradeIdx', 'subjectIdx', 'diffIdx', 'numQIdx', 'selectedTypes', 'includePriorReview']) {
    const cap = name[0]!.toUpperCase() + name.slice(1);
    assert.match(worksheetCode, new RegExp(`\\[${name}, set${cap}\\] = useState`), `state ${name} was renamed or removed`);
  }
  assert.match(worksheetCode, /const \[topic, setTopic\] = useState/);
  assert.match(worksheet, /const NUM_Q_OPTIONS = ALL_QUESTION_COUNTS;/);
  assert.match(worksheet, /const DIFFICULTY_IDS: DifficultyLevel\[\] = \['normal', 'high', 'difficult'\];/);
  // Appended, never inserted: the types are persisted in formState.
  assert.match(worksheet, /const ALL_Q_TYPES: QType\[\] = \['multiple_choice', 'short_answer', 'fill_blank', 'true_false', 'word_problem', 'match', 'order', 'spot_error', 'graph'\];/);
  assert.match(worksheet, /diffIdx, numQIdx: effNumQIdx, selectedTypes: JSON\.stringify\(Array\.from\(selectedTypes\)\)/);
  assert.match(worksheet, /materialKind: isHomework \? 'homework' : 'worksheet',\s+isHomework,/);
});

test('difficulty and count are a segmented control and a stepper over the same arrays and indices', () => {
  assert.match(worksheetCode, /<SegmentedControl label=\{t\('difficultyLabel'\)\} options=\{diffLabels\} index=\{diffIdx\} onChange=\{/);
  assert.match(worksheetCode, /<Stepper label=\{t\('numQuestionsLabel'\)\} options=\{numQLabels\.slice\(0, visibleCountOptions\(wideScope\.isWide\)\)\} index=\{effNumQIdx\} onChange=\{setNumQIdx\}/);
  assert.match(worksheetCode, /const effNumQIdx = clampCountIndex\(numQIdx, wideScope\.isWide\);/);
  assert.match(worksheetCode, /const diffLabels = \[t\('difficultyNormal'\), t\('difficultyHigh'\), t\('difficultyDifficult'\)\];/);
});

test('no dropdown is left for a short list on the worksheet', () => {
  assert.doesNotMatch(worksheetCode, /<PickerField\b[^>]*label=\{t\('(difficultyLabel|numQuestionsLabel|distributionLabel|questionTypesLabel)'\)\}/);
  assert.doesNotMatch(worksheetCode, /<Button\b/, 'both generate actions are the DockedAction now');
  assert.doesNotMatch(worksheetCode, /ALL_Q_TYPES\.filter\([^)]*\)\.map\(type => \{\s*const greyed/, 'the types are chips, not a column of checkbox rows');
});

test('in three-level mode the difficulty control switches papers, with the same handler as before', () => {
  assert.match(worksheetCode, /onChange=\{i => \(levels \? showLevel\(i\) : setDiffIdx\(i\)\)\}/);
  // showLevel is untouched: it files the paper on screen under its own level before swapping.
  assert.match(worksheetCode, /const showLevel = \(i: number\) => \{\s+if \(!levels \|\| !result \|\| i === diffIdx\) return;/);
});

test('the distribution control appears on a wide scope only', () => {
  assert.match(worksheetCode, /\{wideScope\.isWide && \(\s*<SegmentedControl\s+label=\{t\('distributionLabel'\)\}/);
  assert.match(worksheetCode, /wideScope\.setDistribution\(DISTRIBUTIONS\[i\]!\)/);
});

test('a ported screen draws the docked bar on a phone and the inline action on desktop', () => {
  // The worksheet once built `action` and never rendered `action(true)`: a phone had no button at all.
  for (const [name, src] of [['quiz', code(read('app', 'ai-tools', 'quiz.tsx'))], ['worksheet', worksheetCode], ['lesson plan', lessonPlanCode], ['activity', activityCode], ['slides', slidesCode]] as const) {
    assert.match(src, /\{isDesktop \? null : action\(true\)\}/, `${name}: no docked bar on a phone`);
    assert.match(src, /\{action\(false\)\}/, `${name}: no inline action under the desktop preview`);
  }
});

test('question types are chips with the at-least-one rule, and a greyed format stays disabled', () => {
  assert.match(worksheetCode, /<ChipGroup\b[^>]*onToggle=\{toggleType\}[^>]*min=\{1\}/);
  assert.match(worksheetCode, /if \(next\.size === 1\) return prev;/, 'toggleType lost its last-type guard');
  // Same list, same filter, same greying as the old checkbox column.
  assert.match(worksheetCode, /ALL_Q_TYPES\s*\.filter\(type => !isFormatKind\(type\) \|\| shownFormats\.includes\(type\)\)/);
  assert.match(worksheetCode, /disabled: isFormatKind\(type\) && greyedFormats\.includes\(type\)/);
  assert.match(worksheetCode, /isTickChecked\(o\.id, selectedTypes, tickCtx\)/, 'a greyed tick must draw unchecked');
  assert.match(worksheetCode, /\{greyedFormats\.length > 0 \? \(/);
  assert.match(worksheetCode, /t\('formatUnavailable'\)/);
  // The request still sanitises the stored selection, so a greyed tick is dropped from it.
  assert.match(worksheetCode, /questionTypes: Array\.from\(sanitizeQuestionTypes\(selectedTypes, tickCtx\)\)/);
  assert.match(worksheetCode, /setSelectedTypes\(prev => sanitizeQuestionTypes\(prev, \{ isHomework, availability: null \}\)\)/);
});

test('the prior-knowledge review is still one checkbox: hidden on a wide scope, disabled with its note', () => {
  assert.match(worksheetCode, /\{wideScope\.isWide \? null : \(\s*<View style=\{\[surface, styles\.priorCard\]\}>\s*<CheckboxRow/);
  assert.match(worksheetCode, /checked=\{includePriorReview && priorReviewAvailable\}/);
  assert.match(worksheetCode, /disabled=\{!priorReviewAvailable\}/);
  assert.match(worksheetCode, /t\('priorReviewUnavailableNote'\)/);
  assert.match(worksheetCode, /includePriorReview: wide \? false : includePriorReview,/);
  assert.match(worksheetCode, /accessibilityRole="checkbox"\s+aria-checked=\{checked\}/);
  assert.match(worksheetCode, /minHeight: 44/);
});

test('the worksheet screen keeps the worked-example note for the worksheet only', () => {
  assert.match(worksheetCode, /\{isHomework \? null : \(\s*<Text[^>]*>\s*\{t\('numQuestionsIncludesExample'\)\}/);
});

test('both generate actions are in the docked spot, and neither can start while there is no lesson', () => {
  assert.match(worksheetCode, /onPress=\{\(\) => generate\(\)\}/);
  assert.match(worksheetCode, /secondary=\{\{ label: t\('worksheetThreeLevelsBtn'\), onPress: \(\) => generate\(\{ levels: true \}\), disabled: !topic\.trim\(\) \}\}/);
  assert.match(worksheetCode, /disabled=\{!topic\.trim\(\)\}/);
  // Not needTopicHint: it says «أعلاه»/"above", wrong when the button is in the desktop side column.
  assert.match(worksheetCode, /hint=\{t\('genNeedLessonHint'\)\}/);
  assert.doesNotMatch(worksheetCode, /needTopicHint/);
  assert.match(worksheetCode, /\{error && !topic\.trim\(\) \? <Text/);
  assert.match(worksheetCode, /if \(!topic\.trim\(\)\) \{ setError\(t\('topicRequired'\)\); return; \}/);
  assert.match(worksheetCode, /hidden=\{docked && saveBarVisible\}/);
  assert.match(worksheetCode, /\{action\(false\)\}/);
  // The docked bar is the phone's; the desktop one sits under the preview.
  assert.match(worksheet, /<GeneratorLayout form=\{form\} side=\{side\} isDesktop=\{isDesktop\} \/>/);
});

test('homework still shares the screen: the concept, title, subtitle and button follow isHomework', () => {
  assert.match(worksheetCode, /const isHomework = readHomeworkParam\(params\.isHomework\);/);
  assert.match(worksheetCode, /concept=\{isHomework \? 'homework' : 'worksheet'\}/);
  assert.match(worksheetCode, /title=\{isHomework \? t\('createHomework'\) : t\('createWorksheetTitle'\)\}/);
  assert.match(worksheetCode, /subtitle=\{isHomework \? t\('homeworkSubtitle'\) : t\('worksheetSubtitle'\)\}/);
  assert.match(worksheetCode, /t\(isHomework \? 'genHomeworkBtn' : 'createWorksheetBtn'\)/);
  assert.match(worksheetCode, /t\(isHomework \? 'genPreviewHomeworkNote' : 'genPreviewWorksheetNote'\)/);
  assert.match(worksheetCode, /generateHomework\(req/);
  assert.match(worksheetCode, /generateWorksheet\(req/);
});

test('the worksheet wears its concept colour (the homework its own), and not the global palette, in the form', () => {
  assert.match(worksheetCode, /const ACCENT = conceptOf\(isHomework \? 'homework' : 'worksheet'\)\.color;/);
  assert.match(worksheetCode, /const accentInk = readableOn\(ACCENT, colors\.card\);/);
  assert.doesNotMatch(worksheetCode, /ACCENT_FILL/);
  assert.doesNotMatch(worksheetCode, /ACCENT = palette/);
  // Text and rings on a card use the ink; the pickers and the selector too.
  assert.match(worksheetCode, /<TopicSelector[\s\S]*?accent=\{accentInk\}/);
  assert.match(worksheetCode, /<PickerField label=\{t\('grade'\)\}[^>]*accent=\{accentInk\}/);
  assert.match(worksheetCode, /<GenerationStatus[\s\S]*?accent=\{accentInk\}/);
  assert.match(worksheetCode, /<GeneratorResultActions\s+accent=\{accentInk\}/);
  assert.match(worksheetCode, /<GeneratorSaveBar accent=\{accentInk\}/);
  // Solid fills (the buttons) take the concept colour itself, which carries white at 4.5:1.
  assert.match(worksheetCode, /<DockedAction[\s\S]*?accent=\{ACCENT\}/);
  assert.match(worksheetCode, /textOn\(accent\)/, 'the checkbox tick is textOn the fill, not a literal white');
});

test('the form region writes no colour by hand and no KeyboardAvoidingView', () => {
  const form = worksheetCode.slice(worksheetCode.indexOf('const form = ('), worksheetCode.indexOf('const side = ('));
  assert.ok(form.length > 500, 'could not isolate the form region');
  assert.doesNotMatch(form, /#[0-9A-Fa-f]{3,8}\b/);
  assert.doesNotMatch(form, /\brgba?\(/);
  assert.doesNotMatch(form, /\bpalette\b/);
  const checkbox = worksheetCode.slice(worksheetCode.indexOf('function CheckboxRow('), worksheetCode.indexOf('function PickerField('));
  assert.doesNotMatch(checkbox, /#[0-9A-Fa-f]{3,8}\b/);
  assert.doesNotMatch(worksheetCode, /KeyboardAvoidingView/);
  assert.doesNotMatch(worksheetCode, /accessibilityState=/);
});

test('generation, saving and the result are untouched', () => {
  assert.match(worksheetCode, /buildWorksheetRequest\(\{/);
  assert.match(worksheetCode, /Promise\.allSettled\(LEVELS\.map\(d => call\(\{ \.\.\.baseReq, difficulty: d \}\)\)\)/);
  assert.match(worksheetCode, /<GenerationStatus\b/);
  assert.match(worksheetCode, /<GeneratorResultActions\b/);
  assert.match(worksheetCode, /<GeneratorSaveBar\b/);
  assert.match(worksheetCode, /onRegenerate=\{\(\) => generate\(\{ regenerate: true \}\)\}/);
});

test('a refusal, an error or the spinner scrolls into view above a docked button, without a flash or reduced-motion animation', () => {
  assert.match(worksheetCode, /const statusPhase = generationPhase\(\{ loading, cancelled, failed: !!\(error && topic\.trim\(\)\) \}\);/);
  assert.match(worksheetCode, /<GenerationStatus\s+phase=\{statusPhase\}/);
  assert.match(worksheetCode, /<View onLayout=\{e => \{ statusY\.current = e\.nativeEvent\.layout\.y; \}\}>\s*<GenerationStatus/);
  assert.match(worksheetCode, /useLayoutEffect\(\(\) => \{\s*if \(isDesktop \|\| statusPhase === 'idle'\) return;/);
  assert.match(worksheetCode, /scrollRef\.current\?\.scrollTo\(\{ y: Math\.max\(0, statusY\.current - SPACE\.lg\), animated: !reduceMotion \}\);\s*\}, \[statusPhase, attempt\]\);/);
  assert.match(worksheetCode, /const reduceMotion = useReduceMotion\(\);/);
});

test('a stranded grade/subject pair keeps the worksheet lesson card open, so its note is never folded away', () => {
  assert.match(worksheetCode, /const stranded = subjectHidden\?\.\[subjectIdx\] === true;/);
  assert.match(worksheetCode, /expanded=\{lessonOpen \|\| stranded\}/);
  assert.match(worksheetCode, /locked=\{!topic\.trim\(\) \|\| stranded\}/);
});

test('the summary counts the types the request will carry, not the chips ticked', () => {
  assert.match(worksheetCode, /const requestTypes = sanitizeQuestionTypes\(selectedTypes, tickCtx\);/);
  assert.match(worksheetCode, /const ticked = ALL_Q_TYPES\.filter\(type => requestTypes\.has\(type\)\);/);
  assert.match(worksheetCode, /summaryLine\(\{ questions: NUM_Q_OPTIONS\[effNumQIdx\], kinds: ticked\.length, level: diffLabels\[diffIdx\] \}, uiLang\)/);
});

// ── Review fixes: ink on a card, the primary label, the repeated refusal ────

test('the worksheet draws no text, icon or outline in the raw concept colour: on a card it is accentInk', () => {
  // The concept colour is a fill (it carries white at 4.5:1); as ink on the dark card it is 3:1.
  // Allowed raw uses: solid fills (`backgroundColor: ACCENT`, `accent={ACCENT}` props to fills) and
  // alpha tints (`ACCENT + '15'`). Forbidden: `color: ACCENT`, `color={ACCENT}`, a ternary that
  // yields ACCENT as a colour, and a bare `borderColor: ACCENT`.
  const bad: string[] = [];
  worksheetCode.split('\n').forEach((line, i) => {
    if (/\bcolor\s*[:=]\s*\{?\s*ACCENT\b/.test(line)
      || /\bcolor\s*[:=]\s*\{?[^\n]*?[?:]\s*ACCENT\b(?!\s*\+)/.test(line)
      || /\bborderColor\s*:\s*ACCENT\b(?!\s*\+)/.test(line)) bad.push(`${i + 1}: ${line.trim().slice(0, 100)}`);
  });
  assert.deepEqual(bad, [], 'use accentInk (readableOn(ACCENT, colors.card)) for ink on a card');
  assert.ok((worksheetCode.match(/\baccentInk\b/g) ?? []).length >= 20, 'the result area should read accentInk');
  // The ACTIVE level tab is an ACCENT fill, so its label is textOn(ACCENT), not a fixed palette colour.
  assert.match(worksheetCode, /color: active \? textOn\(ACCENT\) : accentInk,/);
  assert.doesNotMatch(worksheetCode, /palette\.primaryForeground/);
});

test('the ink check itself catches the forms it is meant to catch', () => {
  const flags = (line: string) => /\bcolor\s*[:=]\s*\{?\s*ACCENT\b/.test(line)
    || /\bcolor\s*[:=]\s*\{?[^\n]*?[?:]\s*ACCENT\b(?!\s*\+)/.test(line)
    || /\bborderColor\s*:\s*ACCENT\b(?!\s*\+)/.test(line);
  for (const bad of [
    "<Text style={{ color: ACCENT }}>",
    '<Ionicons color={ACCENT} />',
    "{ color: wanted ? ACCENT : colors.mutedForeground }",
    "{ color: active ? palette.x : ACCENT }",
    "{ borderColor: ACCENT, borderRadius: 1 }",
  ]) assert.ok(flags(bad), `should flag: ${bad}`);
  for (const ok of [
    "{ backgroundColor: ACCENT, borderRadius: 1 }",
    "{ backgroundColor: ACCENT + '15', borderColor: ACCENT + '30' }",
    "{ color: active ? textOn(ACCENT) : accentInk }",
    "<DockedAction accent={ACCENT} />",
  ]) assert.ok(!flags(ok), `should not flag: ${ok}`);
});

test('the primary label is centred and may take two lines, and the secondary stays two lines', () => {
  const src = code(read('components', 'generator', 'DockedAction.tsx'));
  assert.match(src, /<Text numberOfLines=\{2\} style=\{\[styles\.label, \{ color: ink \}\]\}>\{label\}<\/Text>/);
  assert.match(src, /label: \{[^}]*textAlign: 'center'/);
  assert.match(src, /minHeight: 50/);
  assert.match(src, /<Text numberOfLines=\{2\} style=\{\[styles\.secondaryLabel/);
});

test('a disabled chip never counts towards min', () => {
  const src = code(read('components', 'generator', 'ChipGroup.tsx'));
  assert.match(src, /const counted = options\.filter\(o => !o\.disabled && selected\.has\(o\.id\)\)\.length;/);
  assert.match(src, /const locked = chipLocked\(\{ single, on, off, counted, min \}\);/, 'the lock rule is the tested pure one');
  assert.doesNotMatch(src, /selected\.size/);
});

test('pressing generate again on the same refusal scrolls to it again: the effect also depends on an attempt counter', () => {
  for (const [name, src] of [['quiz', quizCode], ['worksheet', worksheetCode], ['lesson plan', lessonPlanCode], ['activity', activityCode]] as const) {
    assert.match(src, /const \[attempt, setAttempt\] = useState\(0\);/, `${name}: no attempt counter`);
    // Bumped first thing in generate, before any early return (the refusals), and nothing else about generate moves.
    assert.match(src, /const generate = async \(opts\?: \{[^}]*\}\) => \{\s*(\/\/[^\n]*\n\s*)*setAttempt\(n => n \+ 1\);\s*(\/\/[^\n]*\n\s*)*setCancelled\(false\);\s*const previous = result;/, `${name}: attempt is not bumped at the start of generate`);
    assert.match(src, /\}, \[statusPhase, attempt\]\);/, `${name}: the effect ignores the attempt`);
    assert.match(src, /if \(isDesktop \|\| statusPhase === 'idle'\) return;/, `${name}: an idle form must not scroll`);
    assert.doesNotMatch(src, /statusPhase === 'idle' \|\| (topicRefusal|refusal)/, `${name}: no special case for a refusal: cancelled is cleared first, so the phase is idle then`);
  }
});

// ── The lesson plan ─────────────────────────────────────────────────────────

/** The ink rule, shared by the screens that wear a concept colour (see the worksheet's test for why). */
function rawAccentAsInk(line: string): boolean {
  return /\bcolor\s*[:=]\s*\{?\s*ACCENT\b/.test(line)
    || /\bcolor\s*[:=]\s*\{?[^\n]*?[?:]\s*ACCENT\b(?!\s*\+)/.test(line)
    || /\bborderColor\s*:\s*ACCENT\b(?!\s*\+)/.test(line);
}
const rawAccentLines = (src: string) => src.split('\n').flatMap((l, i) => (rawAccentAsInk(l) ? [`${i + 1}: ${l.trim().slice(0, 100)}`] : []));

test('the lesson plan imports the shared pieces it uses and draws them', () => {
  for (const name of ['SegmentedControl', 'LessonCard', 'DockedAction', 'GeneratorLayout', 'PaperPreview']) {
    assert.match(lessonPlan, new RegExp(`from '@/components/generator/${name}'`), `lesson-plan.tsx does not import ${name}`);
    assert.match(lessonPlanCode, new RegExp(`<${name}\\b`), `lesson-plan.tsx imports ${name} and does not draw it`);
  }
  assert.equal((lessonPlanCode.match(/<DockedAction\b/g) ?? []).length, 1, 'one generate action, no secondary');
  assert.doesNotMatch(lessonPlanCode, /secondary=/);
  assert.doesNotMatch(lessonPlanCode, /<Button\b/, 'the generate button is the DockedAction now');
});

test('the lesson plan keeps TopicSelector mounted: inside the lesson card, never behind a condition', () => {
  assert.equal((lessonPlanCode.match(/<TopicSelector\b/g) ?? []).length, 1);
  assert.match(lessonPlanCode, /<LessonCard[\s\S]*<TopicSelector\b[\s\S]*<\/LessonCard>/, 'TopicSelector must sit inside LessonCard');
  assert.doesNotMatch(lessonPlanCode, /lessonOpen\s*(\?|&&)/, 'the open state may only change the card, never mount or unmount the pickers');
  assert.match(lessonPlanCode, /allowedKinds=\{\['lesson', 'unit', 'semester', 'book'\]\}/);
  assert.match(lessonPlanCode, /onScopeChange=\{wideScope\.setScopeSel\}\s+offlineWideScope/);
  assert.match(lessonPlanCode, /hasError=\{!!error && !topic\}/);
  assert.match(lessonPlanCode, /<PickerField label=\{t\('grade'\)\}[^>]*hidden=\{teacherScope\.gradeHidden\}/);
  assert.match(lessonPlanCode, /<LessonCard[\s\S]*<StrandedSelectionNote\b[\s\S]*<\/LessonCard>/, 'the note is part of the card body');
  assert.match(lessonPlanCode, /<PickerField label=\{t\('subjects'\)\}[^>]*hidden=\{subjectHidden\}/);
  // A stranded pair keeps the card open, and an empty topic keeps it locked open.
  assert.match(lessonPlanCode, /const stranded = subjectHidden\?\.\[subjectIdx\] === true;/);
  assert.match(lessonPlanCode, /expanded=\{lessonOpen \|\| stranded\}/);
  assert.match(lessonPlanCode, /locked=\{!topic\.trim\(\) \|\| stranded\}/);
});

test('the lesson plan carries the lesson by id, and keeps its state names, route params and saved form state', () => {
  assert.match(lessonPlanCode, /usePickedLesson\(/);
  assert.match(lessonPlanCode, /groundLessonPlanTopic\(form, kbScope, pickedLesson\.lessonId\)/);
  assert.match(lessonPlanCode, /lessonId\?: string;/);
  for (const name of ['gradeIdx', 'subjectIdx', 'objectives', 'adaptations', 'priorTopicsNotes', 'includePriorReview', 'durationIdx', 'styleIdx']) {
    const cap = name[0]!.toUpperCase() + name.slice(1);
    assert.match(lessonPlanCode, new RegExp(`\\[${name}, set${cap}\\] = useState`), `state ${name} was renamed or removed`);
  }
  assert.match(lessonPlanCode, /const \[topic, setTopic\] = useState/);
  assert.match(lessonPlanCode, /const DURATION_VALUES = \[30, 45, 60, 90\];/);
  assert.match(lessonPlanCode, /const STYLE_IDS = \['direct', 'inquiry', 'collaborative'\] as const;/);
  assert.match(lessonPlanCode, /durationIdx, styleIdx, objectives, adaptations,/);
  assert.match(lessonPlanCode, /priorTopicsNotes: wideFrozen \? '' : priorTopicsNotes,/);
  assert.match(lessonPlanCode, /includePriorReview: includePriorReview \? '1' : '0',/);
  assert.match(lessonPlanCode, /\.\.\.scopeFormState\(wideFrozen, 'balanced'\),/);
});

test('duration and teaching style are segmented controls over the same arrays and indices', () => {
  assert.match(lessonPlanCode, /<SegmentedControl label=\{t\('durationLabel'\)\} options=\{durationLabels\} index=\{durationIdx\} onChange=\{setDurationIdx\}/);
  assert.match(lessonPlanCode, /<SegmentedControl label=\{t\('teachingStyleLabel'\)\} options=\{styleLabels\} index=\{styleIdx\} onChange=\{setStyleIdx\}/);
  assert.match(lessonPlanCode, /const durationLabels = DURATION_VALUES\.map\(d => `\$\{d\} \$\{t\('min'\)\}`\);/);
  assert.match(lessonPlanCode, /const styleLabels = \[t\('teachingStyleDirect'\), t\('teachingStyleInquiry'\), t\('teachingStyleCollaborative'\)\];/);
  assert.doesNotMatch(lessonPlanCode, /<PickerField\b[^>]*label=\{t\('(durationLabel|teachingStyleLabel)'\)\}/, 'no dropdown for a short list');
});

test('the optional boxes still fold: open when any holds text, three inputs, the prior-topics box hidden on a wide scope', () => {
  assert.match(lessonPlanCode, /const moreOpen = showMore \|\| !!\(objectives\.trim\(\) \|\| adaptations\.trim\(\) \|\| \(!wideScope\.isWide && priorTopicsNotes\.trim\(\)\)\);/);
  assert.match(lessonPlanCode, /aria-expanded=\{moreOpen\}/);
  assert.match(lessonPlanCode, /onPress=\{\(\) => setShowMore\(v => !v\)\}/);
  assert.equal((lessonPlanCode.match(/<TextInput\b/g) ?? []).length, 3);
  for (const setter of ['setObjectives', 'setAdaptations', 'setPriorTopicsNotes']) {
    assert.match(lessonPlanCode, new RegExp(`onChangeText=\\{${setter}\\}`));
  }
  assert.match(lessonPlanCode, /\{wideScope\.isWide \? null : \(\s*<View style=\{styles\.field\}>\s*<Text[^>]*>\s*\{t\('priorTopicsLabel'\)\}/);
  // The «تبسيط الشرح» preset is unchanged.
  assert.match(lessonPlanCode, /if \(adaptations\.includes\(preset\)\) return;/);
  assert.match(lessonPlanCode, /setAdaptations\(a => \(a\.trim\(\) \? `\$\{a\.trim\(\)\}\\n\$\{preset\}` : preset\)\);/);
  // The toggle and the preset chip are 44-point targets; the boxes sit in a surface card.
  assert.match(lessonPlanCode, /moreToggle: \{[^}]*minHeight: 44/);
  assert.match(lessonPlanCode, /presetChip: \{[^}]*minHeight: 44/);
  assert.match(lessonPlanCode, /<View style=\{\[surface, styles\.moreCard\]\}>/);
});

test('the prior-knowledge review is one checkbox: hidden on a wide scope, disabled with its note', () => {
  assert.match(lessonPlanCode, /\{wideScope\.isWide \? null : \(\s*<View style=\{\[surface, styles\.priorCard\]\}>\s*<CheckboxRow/);
  // After the fold: its unavailable note says «the notes field above», and the notes are in the fold.
  assert.ok(lessonPlanCode.indexOf('styles.moreCard') < lessonPlanCode.indexOf('styles.priorCard]'), 'the checkbox card must come after the optional boxes');
  assert.match(translations.ar.priorReviewPlanUnavailableNote, /أعلاه/);
  assert.match(lessonPlanCode, /checked=\{includePriorReview && priorReviewAvailable\}/);
  assert.match(lessonPlanCode, /disabled=\{!priorReviewAvailable\}/);
  assert.match(lessonPlanCode, /t\('priorReviewPlanUnavailableNote'\)/);
  assert.match(lessonPlanCode, /accessibilityRole="checkbox"\s+aria-checked=\{checked\}/);
  assert.match(lessonPlanCode, /checkRow: \{[^}]*minHeight: 44/);
  assert.match(lessonPlanCode, /textOn\(accent\)/, 'the tick is textOn the fill, not a literal white');
  // The request still drops the review on a wide scope (wideScopeRequest), and the effect keeps the tick across a detour.
  assert.match(lessonPlanCode, /if \(!wideScope\.isWide && !priorReviewAvailable && includePriorReview\) setIncludePriorReview\(false\);/);
});

test('validation is unchanged: the button is not disabled, pressing it with no topic sets the error beside the field', () => {
  assert.match(lessonPlanCode, /if \(!topic\.trim\(\)\) \{ setError\(t\('topicRequired'\)\); return; \}/);
  const action = lessonPlanCode.slice(lessonPlanCode.indexOf('const action = ('), lessonPlanCode.indexOf('const form = ('));
  assert.match(action, /onPress=\{\(\) => generate\(\)\}/);
  assert.doesNotMatch(action, /disabled=/, 'this screen never disabled the button on an empty topic');
  assert.doesNotMatch(action, /hint=/);
  assert.match(lessonPlanCode, /\{error && !topic\.trim\(\) \? \(\s*<View ref=\{topicErrorRef\} collapsable=\{false\}>\s*<Text/);
  assert.match(lessonPlanCode, /label=\{loading \? t\('generatingLessonPlan'\) : t\('generateLessonPlanBtn'\)\}/);
  assert.match(lessonPlanCode, /hidden=\{docked && saveBarVisible\}/);
  assert.match(lessonPlanCode, /\{action\(false\)\}/);
});

test('an empty-topic press brings the field into view on a phone AND on desktop, and a second press does it again', () => {
  assert.match(lessonPlanCode, /const topicRefusal = !!error && !topic\.trim\(\);/);
  // Desktop too: the sticky button is in the side column and the field is at the top of the form.
  assert.match(lessonPlanCode, /useLayoutEffect\(\(\) => \{\s*if \(!topicRefusal\) return;/);
  assert.doesNotMatch(lessonPlanCode, /isDesktop \|\| !topicRefusal/);
  // The status scroll has no refusal special case any more (`generate` clears `cancelled` first, so a topic refusal is phase 'idle').
  assert.match(lessonPlanCode, /useLayoutEffect\(\(\) => \{\s*if \(isDesktop \|\| statusPhase === 'idle'\) return;/);
  // No special case in the status effect: see the assertion above and the cancel tests at the end of this file.
  assert.doesNotMatch(lessonPlanCode, /statusPhase === 'idle' \|\| topicRefusal/, 'no special case: cancelled is cleared first, so the phase is idle on a topic refusal');
  // Both positions are measured together, so the current scroll offset cancels out.
  assert.match(lessonPlanCode, /top\.measureInWindow\(\(_x, topY\) => \{\s*target\.measureInWindow\(\(_tx, targetY\) => \{\s*scrollRef\.current\?\.scrollTo\(\{ y: Math\.max\(0, targetY - topY - Math\.round\(windowHeight \* 0\.4\)\), animated: !reduceMotion \}\);/);
  assert.match(lessonPlanCode, /\}, \[topicRefusal, attempt\]\);/, 'without the attempt a repeated press with the same refusal scrolls nowhere');
  assert.match(lessonPlanCode, /<View ref=\{contentTopRef\} collapsable=\{false\}>\s*<ToolHeader/);
});

test('the lesson plan scrolls a refusal, an error or the spinner into view above the docked bar, and pads its content for the bar', () => {
  assert.match(lessonPlanCode, /const statusPhase = generationPhase\(\{ loading, cancelled, failed: !!\(error && topic\.trim\(\)\) \}\);/);
  assert.match(lessonPlanCode, /<GenerationStatus\s+phase=\{statusPhase\}/);
  assert.match(lessonPlanCode, /<View onLayout=\{e => \{ statusY\.current = e\.nativeEvent\.layout\.y; \}\}>\s*<GenerationStatus/);
  assert.match(lessonPlanCode, /useLayoutEffect\(\(\) => \{\s*if \(isDesktop \|\| statusPhase === 'idle'\) return;/);
  assert.match(lessonPlanCode, /scrollRef\.current\?\.scrollTo\(\{ y: Math\.max\(0, statusY\.current - SPACE\.lg\), animated: !reduceMotion \}\);\s*\}, \[statusPhase, attempt\]\);/);
  assert.match(lessonPlanCode, /const reduceMotion = useReduceMotion\(\);/);
  assert.match(lessonPlanCode, /paddingBottom: DOCKED_BAR_HEIGHT \+ SPACE\.xxl \+ insets\.bottom/);
  assert.match(lessonPlanCode, /const saveBarVisible = !!result && !loading && !savedId && saveLabel === 'save';/);
  assert.match(lessonPlanCode, /<GeneratorLayout form=\{form\} side=\{side\} isDesktop=\{isDesktop\} \/>/);
});

test('the lesson plan header keeps its concept and eyebrow, and generation and the result are untouched', () => {
  assert.match(lessonPlanCode, /concept="lesson-plan" eyebrow=\{\{ icon: 'sparkles', label: t\('aiLessonPlanBadge'\) \}\}/);
  assert.match(lessonPlanCode, /aiService\.generateLessonPlan\(\s*wideReq \?\? buildLessonPlanRequest\(form, grounding\),/);
  assert.match(lessonPlanCode, /buildWideLessonPlanRequest\(form, wideSel\)/);
  assert.match(lessonPlanCode, /groundedSubjectConflict\(/);
  assert.match(lessonPlanCode, /<GeneratorResultActions\b/);
  assert.match(lessonPlanCode, /<GeneratorSaveBar\b/);
  assert.match(lessonPlanCode, /onMinistry=\{wideFrozen \? undefined : handleMinistry\}/);
});

test('the lesson plan wears its concept colour; text, icons and outlines on a card are accentInk, never the raw colour', () => {
  assert.match(lessonPlanCode, /const ACCENT = conceptOf\('lesson-plan'\)\.color;/);
  assert.match(lessonPlanCode, /const accentInk = readableOn\(ACCENT, colors\.card\);/);
  assert.doesNotMatch(lessonPlanCode, /import[^;]*\bpalette\b[^;]*from/, 'no palette import is left in the file');
  assert.doesNotMatch(lessonPlanCode, /\bpalette\./);
  assert.deepEqual(rawAccentLines(lessonPlanCode), [], 'use accentInk (readableOn(ACCENT, colors.card)) for ink on a card');
  assert.ok((lessonPlanCode.match(/\baccentInk\b/g) ?? []).length >= 12, 'the form and the result should read accentInk');
  // The sheets and bars that take an accent get the ink, as the worksheet's do.
  assert.match(lessonPlanCode, /<GenerationStatus[\s\S]*?accent=\{accentInk\}/);
  assert.match(lessonPlanCode, /<GeneratorResultActions\s+accent=\{accentInk\}/);
  assert.match(lessonPlanCode, /<GeneratorSaveBar accent=\{accentInk\}/);
  assert.match(lessonPlanCode, /<TopicSelector[\s\S]*?accent=\{accentInk\}/);
  // The result area gets the ink as a prop: it is a function outside the component and cannot see accentInk.
  assert.match(lessonPlanCode, /<LessonPlanResult\s+plan=\{result\}\s+ink=\{accentInk\}/);
  assert.match(lessonPlanCode, /<LessonPlanView[\s\S]*?accent=\{ink\}/);
  // Fills and tints stay the concept colour.
  assert.match(lessonPlanCode, /<DockedAction[\s\S]*?accent=\{ACCENT\}/);
  assert.match(lessonPlanCode, /backgroundColor: ACCENT \+ '15'/);
});

test('the raw-accent check catches the forms it is meant to catch, in the lesson plan\'s own source', () => {
  // Put one raw use back into the real source and the check must see it.
  const mutations: Array<[string, string]> = [
    ["color={ink}", "color={ACCENT}"],
    ["color: ink, fontFamily", "color: ACCENT, fontFamily"],
    ["borderColor: accentInk, borderRadius: colors.radius", "borderColor: ACCENT, borderRadius: colors.radius"],
  ];
  for (const [from, to] of mutations) {
    assert.ok(lessonPlanCode.includes(from), `fixture drifted: ${from}`);
    assert.equal(rawAccentLines(lessonPlanCode.replace(from, to)).length, 1, `should flag: ${to}`);
  }
  for (const ok of ["{ backgroundColor: ACCENT, borderRadius: 1 }", "{ backgroundColor: ACCENT + '15', borderColor: ACCENT + '30' }", "{ color: active ? textOn(ACCENT) : accentInk }", "<DockedAction accent={ACCENT} />"]) {
    assert.equal(rawAccentLines(ok).length, 0, `should not flag: ${ok}`);
  }
});

test('the lesson plan form writes no colour by hand and nothing lifts for the keyboard', () => {
  const formSrc = lessonPlanCode.slice(lessonPlanCode.indexOf('const form = ('), lessonPlanCode.indexOf('const side = ('));
  assert.ok(formSrc.length > 1000, 'could not isolate the form region');
  assert.doesNotMatch(formSrc, /#[0-9A-Fa-f]{3,8}\b/);
  assert.doesNotMatch(formSrc, /\brgba?\(/);
  assert.doesNotMatch(lessonPlanCode, /KeyboardAvoidingView/);
  assert.doesNotMatch(lessonPlanCode, /accessibilityState=/);
  assert.doesNotMatch(lessonPlanCode, /#fff\b/i, 'no literal white left (the checkbox tick is textOn)');
});

test('the lesson plan preview draws one skeleton row per section, with the review only when asked, and no name line', () => {
  assert.match(lessonPlanCode, /const planSections = lessonPlanSections\(withPriorReview\);/);
  assert.match(lessonPlanCode, /const withPriorReview = !wideScope\.isWide && \(\(includePriorReview && priorReviewAvailable\) \|\| priorTopicsNotes\.trim\(\)\.length > 0\);/);
  assert.match(lessonPlanCode, /previewRows\(planSections, planSections\.length, planSections\.length\)/);
  assert.match(lessonPlanCode, /summaryLine\(\{ minutes: DURATION_VALUES\[durationIdx\], sections: planSections\.length, level: styleLabels\[styleIdx\] \}, uiLang\)/);
  assert.match(lessonPlanCode, /nameLine=\{false\}/);
  // The titles are the plan's own headings: in the language the plan will be written in, not the interface's.
  assert.match(lessonPlanCode, /const previewT = getT\(lang\);/);
  assert.match(lessonPlanCode, /previewT\(SECTION_LABEL_KEY\[r\.type\]\)/);
  assert.doesNotMatch(lessonPlanCode, /\bt\(SECTION_LABEL_KEY/);
  const preview = code(read('components', 'generator', 'PaperPreview.tsx'));
  assert.match(preview, /nameLine = true/, 'the worksheet and quiz keep the name line');
  // Every section the preview can draw has a title in both languages.
  const keys = ['sectionObjectives', 'sectionMaterials', 'sectionPriorReview', 'sectionIntroduction', 'sectionMainActivity', 'sectionGuidedPractice', 'sectionIndependentPractice', 'sectionClosure', 'sectionAssessment', 'sectionDifferentiation', 'sectionHomework'];
  for (const key of keys) {
    assert.match(lessonPlanCode, new RegExp(`'${key}'`), `the preview does not title ${key}`);
    for (const lang of ['ar', 'en'] as const) assert.ok((translations as any)[lang][key], `${lang}.${key} is missing`);
  }
});

test('the new generator strings exist in both languages', () => {
  for (const key of ['genPreviewLessonPlanNote', 'genPreviewWorksheetNote', 'genPreviewHomeworkNote', 'genHomeworkBtn']) {
    for (const lang of ['ar', 'en'] as const) assert.ok(String((translations as any)[lang][key] ?? '').trim(), `${lang}.${key} is missing`);
  }
});

// ── ChipGroup: single choice ────────────────────────────────────────────────

test('ChipGroup has a single-choice mode: radio semantics, the chosen chip inert, still a 44-point chip', () => {
  const src = code(read('components', 'generator', 'ChipGroup.tsx'));
  assert.match(src, /single\?: boolean;/);
  assert.match(src, /single = false/, 'single is opt-in, so the quiz and worksheet are unchanged');
  assert.match(src, /role=\{single \? 'radiogroup' : 'group'\}/);
  assert.match(src, /accessibilityRole=\{single \? 'radio' : 'button'\}/);
  assert.match(src, /aria-pressed=\{single \? undefined : on\}/);
  assert.match(src, /aria-checked=\{single \? on : undefined\}/);
  assert.doesNotMatch(src, /accessibilityState=/);
  // A radio is not switched off: pressing the chosen chip neither buzzes nor calls the screen.
  assert.match(src, /if \(locked \|\| off \|\| \(single && on\)\) return;/);
  // `min` belongs to multi-select; it must not lock the one chosen chip as «disabled».
  assert.match(src, /const locked = chipLocked\(\{ single, on, off, counted, min \}\);/, 'the lock rule is the tested pure one');
  assert.match(src, /minHeight: 44/);
  // The existing screens do not pass it.
  // Every <ChipGroup .../> element of the multi-select screens, whole: none of them carries a `single` prop in any position.
  for (const [name, src2] of [['quiz', quizCode], ['worksheet', worksheetCode]] as const) {
    const elements = src2.match(/<ChipGroup\b[\s\S]*?\/>/g) ?? [];
    assert.ok(elements.length >= 1, `${name}: found no ChipGroup element to check`);
    for (const el of elements) assert.doesNotMatch(el, /\bsingle\b/, `${name}: a multi-select ChipGroup got the single prop`);
  }
});

// ── The activity ────────────────────────────────────────────────────────────

test('the activity imports the shared pieces it uses and draws them, with one generate action', () => {
  for (const name of ['SegmentedControl', 'ChipGroup', 'LessonCard', 'DockedAction', 'GeneratorLayout', 'PaperPreview']) {
    assert.match(activity, new RegExp(`from '@/components/generator/${name}'`), `activity.tsx does not import ${name}`);
    assert.match(activityCode, new RegExp(`<${name}\\b`), `activity.tsx imports ${name} and does not draw it`);
  }
  assert.equal((activityCode.match(/<DockedAction\b/g) ?? []).length, 1);
  assert.doesNotMatch(activityCode, /secondary=/);
  assert.doesNotMatch(activityCode, /<Button\b/, 'the generate button is the DockedAction now');
});

test('the activity keeps TopicSelector mounted inside the lesson card, and the lesson by id', () => {
  assert.equal((activityCode.match(/<TopicSelector\b/g) ?? []).length, 1);
  assert.match(activityCode, /<LessonCard[\s\S]*<TopicSelector\b[\s\S]*<\/LessonCard>/);
  assert.doesNotMatch(activityCode, /lessonOpen\s*(\?|&&)/, 'the open state may only change the card, never mount or unmount the pickers');
  assert.match(activityCode, /allowedKinds=\{\['lesson', 'unit', 'semester', 'book'\]\}/);
  assert.match(activityCode, /onScopeChange=\{wideScope\.setScopeSel\}\s+offlineWideScope/);
  assert.match(activityCode, /hasError=\{!!error && !topic\}/);
  assert.match(activityCode, /<PickerField label=\{t\('grade'\)\}[^>]*hidden=\{teacherScope\.gradeHidden\}/);
  assert.match(activityCode, /<LessonCard[\s\S]*<StrandedSelectionNote\b[\s\S]*<\/LessonCard>/);
  assert.match(activityCode, /<PickerField label=\{t\('subjects'\)\}[^>]*hidden=\{subjectHidden\}/);
  assert.match(activityCode, /const stranded = subjectHidden\?\.\[subjectIdx\] === true;/);
  assert.match(activityCode, /expanded=\{lessonOpen \|\| stranded\}/);
  assert.match(activityCode, /locked=\{!topic\.trim\(\) \|\| stranded\}/);
  assert.match(activityCode, /usePickedLesson\(/);
  assert.match(activityCode, /lessonId: pickedLesson\.lessonId/);
  assert.match(activityCode, /lessonId\?: string;/);
});

test('the activity keeps its state names, arrays and saved form state', () => {
  for (const name of ['gradeIdx', 'subjectIdx', 'activityTypeIdx', 'durationIdx', 'objective']) {
    const cap = name[0]!.toUpperCase() + name.slice(1);
    assert.match(activityCode, new RegExp(`\\[${name}, set${cap}\\] = useState`), `state ${name} was renamed or removed`);
  }
  assert.match(activityCode, /const \[topic, setTopic\] = useState/);
  assert.match(activityCode, /const DURATION_VALUES = \[20, 30, 45, 60\];/);
  assert.match(activityCode, /readIndexParam\(params\.activityTypeIdx, ACTIVITY_TYPE_IDS\.length, 1\)/);
  assert.match(activityCode, /\.\.\.\(builtWith \?\? \{ activityTypeIdx, durationIdx, objective \}\),/);
  assert.match(activityCode, /\.\.\.scopeFormState\(wideFrozen, 'balanced'\),/);
  assert.match(activityCode, /activityType: ACTIVITY_TYPE_IDS\[activityTypeIdx\],/);
  assert.match(activity, /ACTIVITY_TYPE_IDS/);
});

test('the activity type is a single-choice chip group over the same ids, moving the same index; duration is segmented', () => {
  assert.match(activityCode, /<ChipGroup\s+single\s+label=\{t\('activityTypeLabel'\)\}/);
  assert.match(activityCode, /options=\{ACTIVITY_TYPE_IDS\.map\(\(id, i\) => \(\{ id, label: activityTypeLabels\[i\]! \}\)\)\}/);
  assert.match(activityCode, /selected=\{new Set<AType>\(\[ACTIVITY_TYPE_IDS\[activityTypeIdx\]!\]\)\}/);
  assert.match(activityCode, /onToggle=\{id => setActivityTypeIdx\(ACTIVITY_TYPE_IDS\.indexOf\(id\)\)\}/);
  assert.match(activityCode, /<SegmentedControl label=\{t\('durationLabel'\)\} options=\{durationLabels\} index=\{durationIdx\} onChange=\{setDurationIdx\}/);
  assert.match(activityCode, /const durationLabels = DURATION_VALUES\.map\(d => `\$\{d\} \$\{t\('min'\)\}`\);/);
  assert.doesNotMatch(activityCode, /<PickerField\b[^>]*label=\{t\('(activityTypeLabel|durationLabel)'\)\}/, 'no dropdown for these lists');
});

test('the objective stays a multiline input in a labelled surface card', () => {
  assert.equal((activityCode.match(/<TextInput\b/g) ?? []).length, 1);
  assert.match(activityCode, /<View style=\{\[surface, styles\.objectiveCard\]\}>/);
  assert.match(activityCode, /value=\{objective\}\s+onChangeText=\{setObjective\}\s+multiline/);
  assert.match(activityCode, /t\('activityObjectiveLabel'\)/);
  assert.match(activityCode, /textInput: \{[^}]*minHeight: 44/);
});

test('the activity button is still disabled with no topic, and says why', () => {
  const action = activityCode.slice(activityCode.indexOf('const action = ('), activityCode.indexOf('const form = ('));
  assert.match(action, /disabled=\{!topic\.trim\(\)\}/);
  assert.match(action, /hint=\{t\('genNeedLessonHint'\)\}/);
  assert.match(action, /onPress=\{\(\) => generate\(\)\}/);
  assert.match(action, /hidden=\{docked && saveBarVisible\}/);
  assert.doesNotMatch(activityCode, /needTopicHint/);
  assert.match(activityCode, /if \(!topic\.trim\(\)\) \{ setError\(t\('topicRequired'\)\); return; \}/);
  assert.match(activityCode, /\{error && !topic\.trim\(\) \? <Text/);
  assert.match(activityCode, /\{action\(false\)\}/);
  assert.match(activityCode, /label=\{loading \? t\('generatingActivity'\) : t\('generateActivityBtn'\)\}/);
});

test('the activity scrolls a refusal or the spinner into view above the docked bar, and pads for it', () => {
  assert.match(activityCode, /const statusPhase = generationPhase\(\{ loading, cancelled, failed: !!\(error && topic\.trim\(\)\) \}\);/);
  assert.match(activityCode, /<GenerationStatus\s+phase=\{statusPhase\}/);
  assert.match(activityCode, /<View onLayout=\{e => \{ statusY\.current = e\.nativeEvent\.layout\.y; \}\}>\s*<GenerationStatus/);
  assert.match(activityCode, /scrollRef\.current\?\.scrollTo\(\{ y: Math\.max\(0, statusY\.current - SPACE\.lg\), animated: !reduceMotion \}\);\s*\}, \[statusPhase, attempt\]\);/);
  assert.match(activityCode, /const reduceMotion = useReduceMotion\(\);/);
  assert.match(activityCode, /paddingBottom: DOCKED_BAR_HEIGHT \+ SPACE\.xxl \+ insets\.bottom/);
  assert.match(activityCode, /const saveBarVisible = !!result && !loading && !savedId && saveLabel === 'save';/);
  assert.match(activityCode, /<GeneratorLayout form=\{form\} side=\{side\} isDesktop=\{isDesktop\} \/>/);
});

test('the activity header, generation and result are untouched', () => {
  assert.match(activityCode, /concept="activity" eyebrow=\{\{ icon: 'flash', label: t\('activityBadge'\) \}\}/);
  assert.match(activityCode, /aiService\.generateActivity\(/);
  assert.match(activityCode, /buildScopeRequest\(wideScope\.scopeSel!/);
  assert.match(activityCode, /groundedSubjectConflict\(/);
  assert.match(activityCode, /setSavedId\(prev => savedIdAfterGeneration\(prev, opts\)\)/);
  assert.match(activityCode, /<GeneratorResultActions\b/);
  assert.match(activityCode, /<GeneratorSaveBar\b/);
});

test('the activity wears its concept colour: no hand-written colour, no palette, ink on cards, tint behind', () => {
  assert.match(activityCode, /const ACCENT = conceptOf\('activity'\)\.color;/);
  assert.match(activityCode, /const accentInk = readableOn\(ACCENT, colors\.card\);/);
  assert.doesNotMatch(activityCode, /import[^;]*\bpalette\b[^;]*from/);
  assert.doesNotMatch(activityCode, /\bpalette\./);
  assert.doesNotMatch(activityCode, /ACCENT_FILL|ACCENT_LOCAL/);
  // The result's old private copy of the colour, and a literal white on the step numbers, are gone.
  assert.doesNotMatch(activityCode, /#[0-9A-Fa-f]{3,8}\b/, 'a hand-written colour is left in the file');
  assert.deepEqual(rawAccentLines(activityCode), [], 'use the ink (readableOn(ACCENT, colors.card)) for text, icons and outlines on a card');
  assert.match(activityCode, /color: textOn\(ACCENT\)/, 'the step number is textOn its ACCENT fill');
  assert.match(activityCode, /<TopicSelector[\s\S]*?accent=\{accentInk\}/);
  assert.match(activityCode, /<GenerationStatus[\s\S]*?accent=\{accentInk\}/);
  assert.match(activityCode, /<GeneratorResultActions\s+accent=\{accentInk\}/);
  assert.match(activityCode, /<GeneratorSaveBar accent=\{accentInk\}/);
  assert.match(activityCode, /<DockedAction[\s\S]*?accent=\{ACCENT\}/);
  // Every result piece that draws ink on a card reads the ink from the card colour.
  assert.ok((activityCode.match(/readableOn\(ACCENT, colors\.card\)/g) ?? []).length >= 4);
  assert.doesNotMatch(activityCode, /KeyboardAvoidingView/);
  assert.doesNotMatch(activityCode, /accessibilityState=/);
});

test('the raw-accent check bites in the activity\'s own source', () => {
  const mutations: Array<[string, string]> = [
    ['color={ink}', 'color={ACCENT}'],
    ['{ color: bannerInk, fontFamily', '{ color: ACCENT, fontFamily'],
    ['color: textOn(ACCENT), fontSize', 'color: ACCENT, fontSize'],
  ];
  for (const [from, to] of mutations) {
    assert.ok(activityCode.includes(from), `fixture drifted: ${from}`);
    assert.equal(rawAccentLines(activityCode.replace(from, to)).length, 1, `should flag: ${to}`);
  }
});

test('the activity preview is one skeleton row per section the result prints, in its order, in the content language', () => {
  assert.match(activityCode, /const sections = activitySections\(\);/);
  assert.match(activityCode, /previewRows\(sections, sections\.length, sections\.length\)/);
  assert.match(activityCode, /const previewT = getT\(lang\);/);
  assert.match(activityCode, /previewT\(SECTION_LABEL_KEY\[r\.type\]\)/);
  assert.doesNotMatch(activityCode, /\bt\(SECTION_LABEL_KEY/);
  assert.match(activityCode, /summaryLine\(\{ minutes: DURATION_VALUES\[durationIdx\], level: typeLabel \}, uiLang\)/);
  assert.match(activityCode, /nameLine=\{false\}/);
  // The titles are the ones ActivityResult prints, in the order it prints them.
  const result = activityCode.slice(activityCode.indexOf('function ActivityResult('));
  const order = ["'sectionMaterials'", "'sectionActivitySteps'", "'sectionTeacherTips'", "'sectionDifferentiation'", "'sectionAssessment'"];
  const at = order.map(k => result.indexOf(`t(${k})`));
  assert.ok(at.every(i => i >= 0), 'ActivityResult no longer prints one of the previewed sections');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'the preview order drifted from the result order');
  assert.ok(result.indexOf("lang === 'ar' ? 'الهدف'") < at[0]!, 'the objective box comes first');
  const keyed = activityCode.slice(activityCode.indexOf('const SECTION_LABEL_KEY'), activityCode.indexOf('} as const satisfies'));
  assert.deepEqual(['genSectionObjective', 'sectionMaterials', 'sectionActivitySteps', 'sectionTeacherTips', 'sectionDifferentiation', 'sectionAssessment'].map(k => keyed.indexOf(k)).every(i => i >= 0), true);
  for (const key of ['genSectionObjective', 'sectionMaterials', 'sectionActivitySteps', 'sectionTeacherTips', 'sectionDifferentiation', 'sectionAssessment', 'genPreviewActivityNote']) {
    for (const lang of ['ar', 'en'] as const) assert.ok(String((translations as any)[lang][key] ?? '').trim(), `${lang}.${key} is missing`);
  }
});

// ── Contrast of the selected label on its real background ──────────────────

/** The card and page colours of both themes, read from the palette source (which imports react-native). */
function themeColours() {
  const src = readFileSync(join(ROOT, 'constants', 'colors.ts'), 'utf8');
  const block = (name: 'light' | 'dark') => {
    const at = src.indexOf(`  ${name}: {`);
    const body = src.slice(at, src.indexOf('\n  },', at));
    const pick = (key: string) => new RegExp(`\\n    ${key}:\\s+'(#[0-9A-Fa-f]{6})'`).exec(body)![1]!;
    return { card: pick('card'), background: pick('background') };
  };
  return { light: block('light'), dark: block('dark') };
}
/** Every concept colour a generator screen wears. */
const GENERATOR_CONCEPTS = ['quiz', 'worksheet', 'homework', 'lesson-plan', 'activity', 'slides'] as const;

test('a selected chip\'s label, tick and ring read at 4.5:1 on the chip\'s own fill, in both themes, for every generator colour', () => {
  assert.match(code(read('components', 'generator', 'ChipGroup.tsx')), /const selectedFill = tintOver\(accent, SELECTED_ALPHA, colors\.card\);\s*const ink = readableOn\(accent, selectedFill\);/);
  assert.match(code(read('components', 'generator', 'ChipGroup.tsx')), /SELECTED_ALPHA = 0x1f \/ 255/);
  assert.match(code(read('components', 'generator', 'ChipGroup.tsx')), /backgroundColor: selectedFill/);
  assert.doesNotMatch(code(read('components', 'generator', 'ChipGroup.tsx')), /accent \+ '/, 'a translucent tint leaves the label on an unknown background');
  const alpha = 0x1f / 255;
  for (const [theme, c] of Object.entries(themeColours())) {
    for (const id of GENERATOR_CONCEPTS) {
      const accent = CONCEPTS[id].color;
      const fill = tintOver(accent, alpha, c.card);
      const ink = readableOn(accent, fill);
      assert.ok(contrast(ink, fill) >= 4.5, `${id} on ${theme}: chip label ${ink} on ${fill} is ${contrast(ink, fill).toFixed(2)}:1`);
    }
  }
  // The flaw this replaces: judged against the plain card, #C2410C on its own tint was under 4.5:1.
  const activityFill = tintOver(CONCEPTS.activity.color, alpha, themeColours().light.card);
  assert.ok(contrast(readableOn(CONCEPTS.activity.color, themeColours().light.card), activityFill) < 4.5);
});

test('a selected segment\'s label reads at 4.5:1 on the card it is drawn on, in both themes, for every generator colour', () => {
  const src = code(read('components', 'generator', 'SegmentedControl.tsx'));
  // The selected segment is the plain card colour (not a tint), and its label is judged against that card.
  assert.match(src, /const ink = readableOn\(accent, colors\.card\);/);
  assert.match(src, /on \? \{ backgroundColor: colors\.card, borderColor: ink \}/);
  for (const [theme, c] of Object.entries(themeColours())) {
    for (const id of GENERATOR_CONCEPTS) {
      const ink = readableOn(CONCEPTS[id].color, c.card);
      assert.ok(contrast(ink, c.card) >= 4.5, `${id} on ${theme}: segment label ${ink} on ${c.card} is ${contrast(ink, c.card).toFixed(2)}:1`);
    }
  }
});

test('the activity\'s ready banner text reads at 4.5:1 on its tint over the page, in both themes', () => {
  assert.match(activityCode, /const bannerInk = readableOn\(ink, tintOver\(ACCENT, 0x15 \/ 255, colors\.background\)\);/);
  assert.match(activityCode, /color=\{bannerInk\}/);
  assert.match(activityCode, /\{ color: bannerInk, fontFamily/);
  for (const [theme, c] of Object.entries(themeColours())) {
    const fill = tintOver(CONCEPTS.activity.color, 0x15 / 255, c.background);
    const ink = readableOn(readableOn(CONCEPTS.activity.color, c.card), fill);
    assert.ok(contrast(ink, fill) >= 4.5, `${theme}: banner ${ink} on ${fill} is ${contrast(ink, fill).toFixed(2)}:1`);
  }
});

test('the activity result headings share their text with the preview, and no unused icon import is left', () => {
  const result = activityCode.slice(activityCode.indexOf('function ActivityResult('));
  assert.match(result, /\{t\('genSectionObjective'\)\}/, 'the objective heading is the preview\'s key, so the two cannot drift');
  assert.doesNotMatch(activityCode, /'الهدف'|'Objective'/);
  assert.doesNotMatch(activityCode, /\bICON\b/);
  assert.doesNotMatch(activityCode, /lang=\{outLang\}/);
});

// ── The slides ──────────────────────────────────────────────────────────────

test('the slides import the shared pieces they use and draw them, with one generate action', () => {
  for (const name of ['ChipGroup', 'LessonCard', 'DockedAction', 'GeneratorLayout', 'PaperPreview']) {
    assert.match(slides, new RegExp(`from '@/components/generator/${name}'`), `slides.tsx does not import ${name}`);
    assert.match(slidesCode, new RegExp(`<${name}\\b`), `slides.tsx imports ${name} and does not draw it`);
  }
  assert.equal((slidesCode.match(/<DockedAction\b/g) ?? []).length, 1);
  assert.doesNotMatch(slidesCode, /secondary=/);
  assert.doesNotMatch(slidesCode, /<Button\b/, 'the generate button is the DockedAction now');
  assert.doesNotMatch(slidesCode, /const Toggle\b|<Toggle\b/, 'the three toggles are chips now');
});

test('the slides keep TopicSelector mounted inside the lesson card, the lesson by id, and the lesson pins mounted', () => {
  assert.equal((slidesCode.match(/<TopicSelector\b/g) ?? []).length, 1);
  assert.match(slidesCode, /<LessonCard[\s\S]*<TopicSelector\b[\s\S]*<\/LessonCard>/);
  assert.doesNotMatch(slidesCode, /lessonOpen\s*(\?|&&)/, 'the open state may only change the card, never mount or unmount the pickers');
  assert.match(slidesCode, /allowedKinds=\{\['lesson', 'unit', 'semester', 'book'\]\}/);
  assert.match(slidesCode, /onScopeChange=\{wideScope\.setScopeSel\}\s+offlineWideScope/);
  assert.match(slidesCode, /hasError=\{!!validationError && !topic\}/);
  const gradePicker = /<PickerField label=\{t\('grade'\)\}[\s\S]*?\/>/.exec(slidesCode)?.[0] ?? '';
  assert.match(gradePicker, /hidden=\{teacherScope\.gradeHidden\}/);
  assert.match(gradePicker, /maxHeight=\{220\}/);
  assert.match(slidesCode, /<LessonCard[\s\S]*<StrandedSelectionNote\b[\s\S]*<\/LessonCard>/);
  assert.match(slidesCode, /<PickerField label=\{t\('subjects'\)\}[^>]*hidden=\{subjectHidden\}[^>]*maxHeight=\{220\}/);
  assert.match(slidesCode, /const stranded = subjectHidden\?\.\[subjectIdx\] === true;/);
  // Locked while a refusal shows too: the «تم» button would do nothing (the card is forced open) and the card would fold while typing.
  assert.match(slidesCode, /locked=\{!topic\.trim\(\) \|\| stranded \|\| refusal\}/);
  assert.match(slidesCode, /expanded=\{lessonOpen \|\| stranded \|\| refusal\}/);
  assert.match(slidesCode, /usePickedLesson\(/);
  assert.match(slidesCode, /const groundingOptions = \{ lessonId: pickedLessonId, scope: kbScope \};/);
  // The lesson's pins follow the lesson card, outside its body so folding the card never hides them, with their conditions untouched.
  assert.match(slidesCode, /<\/LessonCard>[\s\S]*\{!wideScope\.isWide && <LessonResources topic=\{topic\.trim\(\)\} onChange=\{setAttached\} \/>\}\s*<LessonAttachments lessonId=\{groundedLessonId\} onChange=\{setUploadedAttachments\} \/>\s*<LessonLabItems lessonId=\{groundedLessonId\} isAr=\{isAr\} picks=\{labPicks\} onChange=\{setLabPicks\} \/>/);
});

test('the slides keep their switches, their defaults and the saved deck options', () => {
  assert.match(slidesCode, /const \[includeExamples, setIncludeExamples\] = useState\(\(\) => readFlagParam\(params\.includeExamples, true\)\);/);
  assert.match(slidesCode, /const \[includePractice, setIncludePractice\] = useState\(\(\) => readFlagParam\(params\.includePractice, true\)\);/);
  assert.match(slidesCode, /const \[includeAttachments, setIncludeAttachments\] = useState\(\(\) => readFlagParam\(params\.includeAttachments, false\)\);/);
  assert.match(slidesCode, /type DeckOptions = \{ includeExamples: boolean; includePractice: boolean; includeAttachments: boolean \};/);
  assert.match(slidesCode, /\.\.\.\(generated\?\.options \?\? \{ includeExamples, includePractice, includeAttachments \}\),/);
  assert.match(slidesCode, /options: \{ includeExamples, includePractice, includeAttachments \},/);
  assert.match(slidesCode, /\.\.\.scopeFormState\(wideFrozen, 'balanced'\),/);
  for (const param of ['gradeIdx', 'subjectIdx', 'topic', 'savedId', 'includeExamples', 'includePractice', 'includeAttachments', 'scope', 'lessonId']) {
    assert.match(slidesCode, new RegExp(`${param}\\?: string`), `route param ${param} was dropped`);
  }
});

test('the three switches are one multi-select chip group over the same booleans, offered under the same conditions, clearable', () => {
  assert.match(slidesCode, /<ChipGroup\s+label=\{t\('genSlidesIncludeLabel'\)\}\s+options=\{includeOptions\}\s+selected=\{includeSelected\}\s+onToggle=\{toggleOption\}\s+min=\{0\}/);
  assert.doesNotMatch(slidesCode, /<ChipGroup\s+single/);
  // The conditions the toggles had, unchanged: examples and attachments never on a wide scope; attachments only when there are some.
  // Examples also need a subject with a problem to work (`usesWorkedExample`): a history deck is offered none.
  assert.match(slidesCode, /const subjectHasExamples = usesWorkedExample\(subjects\[subjectIdx\]\.id\);\s*const examplesOn = includeExamples && subjectHasExamples;/);
  assert.match(slidesCode, /const offerExamples = !wideScope\.isWide && subjectHasExamples;/);
  assert.match(slidesCode, /const offerAttachments = hasAttachments && !wideScope\.isWide;/);
  assert.match(slidesCode, /\.\.\.\(offerExamples \? \[\{ id: 'examples' as const, label: t\('genSlidesOptExamples'\) \}\] : \[\]\),\s*\{ id: 'practice' as const, label: t\('genSlidesOptPractice'\) \},\s*\.\.\.\(offerAttachments \? \[\{ id: 'attachments' as const, label: t\('genSlidesOptAttachments'\) \}\] : \[\]\),/);
  // Each chip flips its own boolean and nothing else, and a hidden chip leaves its boolean exactly as it was.
  assert.match(slidesCode, /if \(id === 'examples'\) setIncludeExamples\(v => !v\);\s*else if \(id === 'practice'\) setIncludePractice\(v => !v\);\s*else setIncludeAttachments\(v => !v\);/);
  assert.match(slidesCode, /\.\.\.\(examplesOn \? \['examples' as const\] : \[\]\),\s*\.\.\.\(includePractice \? \['practice' as const\] : \[\]\),\s*\.\.\.\(includeAttachments \? \['attachments' as const\] : \[\]\),/);
  // min 0 really lets every chip be cleared: the lock rule is the tested pure one, and min is not raised.
  assert.match(code(read('components', 'generator', 'ChipGroup.tsx')), /const locked = chipLocked\(\{ single, on, off, counted, min \}\);/);
  assert.match(code(read('components', 'generator', 'ChipGroup.tsx')), /min = 0/);
  assert.equal(chipLocked({ single: false, on: true, off: false, counted: 1, min: 0 }), false);
  // Generation reads the same three booleans.
  // Both builders get the EFFECTIVE examples flag, so a hidden chip (history, a wide scope's twin) builds no example slide.
  assert.match(slidesCode, /includeExamples: examplesOn,\s*includePractice,\s*graphCommands: extractGraphCommands/);
  assert.match(slidesCode, /includeExamples: examplesOn,\s*includePractice,\s*graphCommands,\s*checks,/);
  assert.doesNotMatch(slidesCode, /^\s*includeExamples,$/m, 'a builder is handed the raw flag');
});

test('«ابدأ من فكرتك» is its own outlined button with a hint, not text under the chips', () => {
  const form = slidesCode.slice(slidesCode.indexOf('const form = ('), slidesCode.indexOf('const side = ('));
  assert.ok(form.indexOf('<ChipGroup') < form.indexOf("t('slidesFromPromptLink')"));
  assert.ok(form.includes("t('slidesFromPromptHint')"));
  assert.match(slidesCode, /promptLink: \{[^}]*borderWidth: 1/);
  const T = translations as any;
  for (const lang of ['ar', 'en'] as const) {
    for (const key of ['slidesFromPromptLink', 'slidesFromPromptHint']) assert.ok(String(T[lang][key] ?? '').trim(), `${lang}.${key} is missing`);
  }
  // The old wording is gone from the app, including the help answers that quoted it.
  for (const lang of ['ar', 'en'] as const) {
    for (const [key, value] of Object.entries(T[lang])) {
      assert.ok(!String(value).includes('اكتب وصف العرض بكلماتك') && !String(value).includes('describe the slides in your own words'), `${lang}.${key} still quotes the old link`);
    }
  }
  // Every help answer that names the button names it as it is now.
  for (const key of ['howSlideAddReorder', 'howInteractiveDeck', 'howSlidesOwnText']) {
    assert.ok(String(T.ar[key]).includes(T.ar.slidesFromPromptLink), `ar.${key} does not quote the button`);
  }
  assert.ok(String(T.en.howSlideAddReorder).includes(T.en.slidesFromPromptLink));
});

test('the slides button is not disabled; every refusal is shown in the lesson card and brought into view, and a second press scrolls again', () => {
  const action = slidesCode.slice(slidesCode.indexOf('const action = ('), slidesCode.indexOf('const form = ('));
  assert.doesNotMatch(action, /disabled=|hint=/, 'this screen never disabled the button');
  assert.match(action, /hidden=\{docked && deckUnsaved\}/);
  assert.match(action, /label=\{loading \? t\('slidesBuilding'\) : t\('slidesBuild'\)\}/);
  assert.match(action, /onPress=\{\(\) => generate\(\)\}/);
  assert.match(slidesCode, /const refuse = \(msg: string\) => \{ setValidationError\(msg\); setError\(''\); setCancelled\(false\); \};/);
  for (const refusal of ["refuse(t('topicRequired'))", "refuse(t('scopeNoCurriculum', scope.grade, scope.subject))", "refuse(t('wideScopeUngrounded'))", "refuse(t('subjectTopicMismatch'"]) {
    assert.ok(slidesCode.includes(refusal), `a refusal went missing: ${refusal}`);
  }
  // Inside the card, where every one of them is about; the card opens for it (so it is measurable) and stays open when it clears.
  assert.match(slidesCode, /\{validationError \? \(\s*<View ref=\{refusalRef\} collapsable=\{false\}>/);
  assert.match(slidesCode, /expanded=\{lessonOpen \|\| stranded \|\| refusal\}/);
  assert.match(slidesCode, /useEffect\(\(\) => \{ if \(!topic\.trim\(\) \|\| validationError\) setLessonOpen\(true\); \}, \[topic, validationError\]\);/);
  assert.match(slidesCode, /const refusal = !!validationError;/);
  // Measure-and-scroll on phone AND desktop, keyed on the attempt so the same refusal scrolls again.
  assert.match(slidesCode, /useLayoutEffect\(\(\) => \{\s*if \(!refusal\) return;/);
  assert.doesNotMatch(slidesCode, /isDesktop \|\| !refusal/);
  assert.match(slidesCode, /top\.measureInWindow\(\(_x, topY\) => \{\s*target\.measureInWindow\(\(_tx, targetY\) => \{\s*scrollRef\.current\?\.scrollTo\(\{ y: Math\.max\(0, targetY - topY - Math\.round\(windowHeight \* 0\.4\)\), animated: !reduceMotion \}\);/);
  assert.match(slidesCode, /\}, \[refusal, attempt\]\);/);
  assert.match(slidesCode, /<View ref=\{contentTopRef\} collapsable=\{false\}>\s*<ToolHeader/);
  // The status scroll depends on the attempt (a refusal is phase 'idle', so it returns by itself), and its phase still reads the two-phase flow.
  assert.match(slidesCode, /if \(isDesktop \|\| statusPhase === 'idle'\) return;/);
  assert.match(slidesCode, /\}, \[statusPhase, attempt\]\);/);
  assert.match(slidesCode, /const statusPhase = generationPhase\(\{ loading, cancelled, failed: !!error \}\);/);
  assert.match(slidesCode, /<GenerationStatus\s+phase=\{statusPhase\}/);
  assert.match(slidesCode, /<View onLayout=\{e => \{ statusY\.current = e\.nativeEvent\.layout\.y; \}\}>\s*<GenerationStatus/);
  // The attempt is counted before anything can refuse.
  assert.match(slidesCode, /const \[attempt, setAttempt\] = useState\(0\);/);
  assert.match(slidesCode, /const generate = async \(regen: ReturnType<typeof regenerationFields> = \{\}\) => \{\s*setAttempt\(n => n \+ 1\);\s*(\/\/[^\n]*\n\s*)*setCancelled\(false\);\s*const trimmed = topic\.trim\(\);/);
  assert.match(slidesCode, /loadingLabel=\{preliminary \? t\('slidesBuildingRest'\) : t\('slidesBuilding'\)\}/);
});

test('the slides pad for the docked bar and lock the draft deck while it is preliminary', () => {
  assert.match(slidesCode, /paddingBottom: DOCKED_BAR_HEIGHT \+ SPACE\.xxl \+ insets\.bottom/);
  assert.match(slidesCode, /<GeneratorLayout form=\{form\} side=\{side\} isDesktop=\{isDesktop\} \/>/);
  assert.match(slidesCode, /style=\{\{ marginHorizontal: 20, opacity: preliminary \? 0\.6 : 1 \}\}\s*pointerEvents=\{preliminary \? 'none' : 'auto'\}/);
  assert.match(slidesCode, /\{deck && \(!loading \|\| preliminary\) && \(/);
});

test('the own-idea button stays in the form (never the docked bar), reachable on phone and desktop, 44 points', () => {
  assert.match(slidesCode, /router\.push\(\{ pathname: '\/ai-tools\/prompt-slides', params: topic\.trim\(\) \? \{ prompt: topic\.trim\(\) \} : \{\} \}\)/);
  assert.match(slidesCode, /<PressableScale[^>]*onPress=\{\(\) => router\.push[\s\S]*?accessibilityRole="link"\s+style=\{\[styles\.promptLink, /);
  assert.match(slidesCode, /promptLink: \{[^}]*minHeight: 44/);
  assert.match(slidesCode, /t\('slidesFromPromptLink'\)/);
  // It is part of the form, not of the docked bar.
  const form = slidesCode.slice(slidesCode.indexOf('const form = ('), slidesCode.indexOf('const side = ('));
  assert.ok(form.includes("t('slidesFromPromptLink')"));
  assert.ok(!slidesCode.slice(slidesCode.indexOf('const action = ('), slidesCode.indexOf('const form = (')).includes('slidesFromPromptLink'));
});

test('the slides wear their concept colour: no palette, no hand-written colour, ink on cards', () => {
  assert.match(slidesCode, /const ACCENT = conceptOf\('slides'\)\.color;/);
  assert.match(slidesCode, /const accentInk = readableOn\(ACCENT, colors\.card\);/);
  assert.doesNotMatch(slidesCode, /import[^;]*\bpalette\b[^;]*from/);
  assert.doesNotMatch(slidesCode, /\bpalette\b/);
  assert.doesNotMatch(slidesCode, /#[0-9A-Fa-f]{3,8}\b/, 'a hand-written colour is left in the file');
  assert.deepEqual(rawAccentLines(slidesCode), [], 'use the ink (readableOn(ACCENT, colors.card)) for text, icons and outlines on a card');
  assert.match(slidesCode, /<TopicSelector[\s\S]*?accent=\{accentInk\}/);
  assert.match(slidesCode, /<GenerationStatus[\s\S]*?accent=\{accentInk\}/);
  assert.match(slidesCode, /<DockedAction[\s\S]*?accent=\{ACCENT\}/);
  assert.match(/<PickerField label=\{t\('grade'\)\}[\s\S]*?\/>/.exec(slidesCode)?.[0] ?? '', /accent=\{accentInk\}/);
  assert.match(slidesCode, /const row = selectedRow\(props\.accent, props\.colors\.card\);\s*return <SharedPickerField selectedTint=\{row\.fill\} \{\.\.\.props\} accent=\{row\.ink\} \/>;/);
  assert.doesNotMatch(slidesCode, /KeyboardAvoidingView/);
  assert.doesNotMatch(slidesCode, /accessibilityState=/);
});

test('the raw-accent check bites in the slides\' own source', () => {
  const from = "color: accentInk, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label";
  assert.ok(slidesCode.includes(from), 'fixture drifted');
  assert.equal(rawAccentLines(slidesCode.replace(from, "color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label")).length, 1);
});

test('the slides preview draws the sections a deck is built from, in the content language, and claims no slide count', () => {
  assert.match(slidesCode, /const sections = deckSections\(\{ wide: wideScope\.isWide, examples: examplesOn, practice: includePractice \}\);/);
  assert.match(slidesCode, /previewRows\(sections, sections\.length, sections\.length\)/);
  assert.match(slidesCode, /const previewT = getT\(lang\);/);
  assert.match(slidesCode, /previewT\(r\.type === 'exitTicket' && wideScope\.isWide \? 'genDeckExitTicketRevision' : DECK_SECTION_LABEL_KEY\[r\.type\]\)/);
  assert.doesNotMatch(slidesCode, /\bt\(DECK_SECTION_LABEL_KEY/);
  assert.match(slidesCode, /const summary = deckOptionsSummary\(\{\s*wide: wideScope\.isWide, examples: examplesOn, practice: includePractice, attachments: includeAttachments && offerAttachments,\s*\}, uiLang\);/);
  assert.match(slidesCode, /nameLine=\{false\}/);
  const side = slidesCode.slice(slidesCode.indexOf('const side = ('), slidesCode.indexOf('return (\n    <View style={{ flex: 1, backgroundColor'));
  assert.doesNotMatch(side, /slideCount|deck\.slides/, 'the preview cannot know how many slides there will be');
  assert.match(side, /t\('genPreviewDeckNote'\)/);
  const keys = slidesCode.slice(slidesCode.indexOf('const DECK_SECTION_LABEL_KEY'), slidesCode.indexOf('} as const satisfies'));
  for (const key of keys.match(/'gen[A-Za-z]+'/g) ?? []) {
    for (const lang of ['ar', 'en'] as const) assert.ok(String((translations as any)[lang][key.slice(1, -1)] ?? '').trim(), `${lang}.${key} is missing`);
  }
  assert.equal((keys.match(/'gen[A-Za-z]+'/g) ?? []).length, 14);
  for (const key of ['genSlidesIncludeLabel', 'genSlidesOptExamples', 'genSlidesOptPractice', 'genSlidesOptAttachments', 'genPreviewDeckNote']) {
    for (const lang of ['ar', 'en'] as const) assert.ok(String((translations as any)[lang][key] ?? '').trim(), `${lang}.${key} is missing`);
  }
});

test('a long chip label wraps inside its chip instead of running off a narrow screen', () => {
  const src = code(read('components', 'generator', 'ChipGroup.tsx'));
  assert.match(src, /maxWidth: '100%'/);
  assert.match(src, /text: \{ fontSize: TYPE\.label, flexShrink: 1 \}/);
});

test('the docked bar yields to an unsaved deck on a phone, and the rebuild stays reachable inline above the results', () => {
  // The screen's saved signal: `workspace.saved` (a saved link whose stored copy IS the deck on screen).
  assert.match(slidesCode, /const deckUnsaved = !!deck && !loading && !workspace\.saved;/);
  assert.match(slidesCode, /hidden=\{docked && deckUnsaved\}/);
  assert.match(slidesCode, /\{isDesktop \? null : action\(true\)\}/);
  // While the bar is hidden the same action is the last thing in the form (phone only; desktop keeps the side column's).
  assert.match(slidesCode, /\{!isDesktop && deckUnsaved \? action\(false\) : null\}\s*<\/>\s*\);\s*const side = \(/);
  assert.match(slidesCode, /\{action\(false\)\}/);
  // It is the form's last child, after the quiet link and the chips.
  const form = slidesCode.slice(slidesCode.indexOf('const form = ('), slidesCode.indexOf('const side = ('));
  assert.ok(form.indexOf("t('slidesFromPromptLink')") < form.indexOf('action(false)'));
  assert.ok(form.indexOf('<ChipGroup') < form.indexOf('action(false)'));
  // The saved signal really is the one that is lit only for a stored copy equal to the deck on screen.
  const hook = code(read('hooks', 'useDeckWorkspace.ts'));
  assert.match(hook, /saved: showsSaved\(currentLink\(\)\),/);
  const link = code(read('services', 'deckSaveLink.ts'));
  assert.match(link, /return !!link\.savedId && link\.autoSync;/);
});

test('the slides toast is lifted above the docked bar while the bar is shown on a phone', () => {
  // (The lift itself is the shared helper: see the test on `toastLift` at the end of this file.)
  const toast = code(read('components', 'ui', 'Toast.tsx'));
  assert.match(toast, /bottomOffset\?: number;/);
  assert.match(toast, /bottomOffset = 0/, 'every other screen\'s toast stays where it was');
  assert.match(toast, /bottom: 100 \+ insets\.bottom \+ bottomOffset,/);
});

test('the slides wording: neutral count note, one attachments word, the revision exit ticket, no dead toggle strings', () => {
  const T = translations as any;
  assert.match(T.ar.genPreviewDeckNote, /يتبع المحتوى/);
  assert.doesNotMatch(T.ar.genPreviewDeckNote, /يتبع الدرس/);
  assert.match(T.en.genPreviewDeckNote, /follows the content/);
  assert.equal(T.ar.genSlidesOptAttachments, 'مرفقاتي');
  assert.equal(T.en.genSlidesOptAttachments, 'My attachments');
  assert.equal(T.ar.genDeckExitTicket, 'غلق الدرس', 'a lesson deck titles it «غلق الدرس»');
  assert.equal(T.ar.genDeckExitTicketRevision, 'غلق الحصة', 'buildRevisionDeck titles it «غلق الحصة»');
  assert.match(read('services', 'lessonSlides.ts'), /L\('غلق الحصة', 'Exit Ticket'\)/);
  assert.match(read('services', 'lessonSlides.ts'), /L\('غلق الدرس', 'Exit Ticket'\)/);
  for (const lang of ['ar', 'en'] as const) {
    for (const dead of ['slidesIncludeExamples', 'slidesIncludePractice', 'slidesIncludeAttachments']) assert.equal(T[lang][dead], undefined, `${lang}.${dead} is dead and was removed`);
  }
  assert.doesNotMatch(read('app', 'ai-tools', 'slides.tsx'), /slidesInclude/);
});

// ── Cancel, then a refused press ────────────────────────────────────────────

test('every generator clears `cancelled` first in generate, before any refusal can return, and uses the one phase expression', () => {
  const screens = [['quiz', quizCode], ['worksheet', worksheetCode], ['lesson plan', lessonPlanCode], ['activity', activityCode], ['slides', slidesCode]] as const;
  for (const [name, src] of screens) {
    const at = src.indexOf('const generate = async (');
    assert.ok(at >= 0, `${name}: no generate`);
    const body = src.slice(at, src.indexOf('Haptics.impactAsync', at));
    const reset = body.indexOf('setCancelled(false);');
    assert.ok(reset >= 0, `${name}: generate never clears cancelled`);
    // Before the first refusal (setError / refuse) and right after the attempt is counted.
    const firstRefusal = Math.min(...['setError(t(', 'refuse(t('].map(k => (body.indexOf(k) >= 0 ? body.indexOf(k) : Infinity)));
    assert.ok(reset < firstRefusal, `${name}: cancelled is cleared after a refusal could already return`);
    assert.ok(body.indexOf('setAttempt(n => n + 1);') < reset, `${name}: the attempt is counted first`);
    assert.match(src, /import \{ generationPhase \} from '@\/services\/generationPhase';/, name);
    assert.match(src, /const statusPhase = generationPhase\(\{ loading, cancelled, failed: /, name);
    assert.doesNotMatch(src, /loading \? 'loading' : cancelled \? 'cancelled'/, `${name}: the phase expression is back inline`);
  }
});

test('the paths that rebuild go through generate, so they clear a cancel too', () => {
  // Regenerate buttons, the English refresh and slides\' report-a-problem all call generate; none sets its own phase.
  for (const [name, src] of [['quiz', quizCode], ['worksheet', worksheetCode], ['lesson plan', lessonPlanCode], ['activity', activityCode]] as const) {
    assert.match(src, /generate: \(\) => generate\(\)/, `${name}: English refresh`);
    assert.match(src, /onRegenerate=\{\(\) => generate\(\{ regenerate: true \}\)\}/, `${name}: regenerate`);
  }
  assert.match(slidesCode, /await generate\(regenerationFields\(true, \{ variantId: teachingVariantId \}\)\);/);
  assert.match(slidesCode, /generate: \(\) => generate\(\),/);
});

test('the status scroll needs no special case for a refusal any more: the phase is idle then', () => {
  assert.doesNotMatch(lessonPlanCode, /statusPhase === 'idle' \|\| topicRefusal/);
  assert.doesNotMatch(slidesCode, /statusPhase === 'idle' \|\| refusal/);
});

// ── Ink on a tint is judged against the tint ───────────────────────────────

test('the ready banners, pills, figure button and selected dropdown rows read at 4.5:1 on their own tint, and never lower than the plain ink, for every concept colour in both modes', () => {
  const tints = (id: keyof typeof CONCEPTS, c: { card: string; background: string }) => {
    const accent = CONCEPTS[id].color;
    const banner = tintOver(accent, 0x15 / 255, c.background);
    const pill = tintOver(accent, 0x18 / 255, banner);
    const figure = tintOver(accent, 0x1a / 255, c.card);
    return { accent, banner, pill, figure };
  };
  for (const [theme, c] of Object.entries(themeColours())) {
    for (const id of GENERATOR_CONCEPTS) {
      const { accent, banner, pill, figure } = tints(id, c);
      // The screens start from the plain ink (readableOn(accent, card)) and only move it further when the tint needs it,
      // so a label is never LOWER in contrast than the ink it used to be.
      const plain = readableOn(accent, c.card);
      for (const [what, fill] of [['banner', banner], ['quiz pill', pill], ['figure button', figure]] as const) {
        const ink = readableOn(plain, fill);
        assert.ok(contrast(ink, fill) >= 4.5, `${id} on ${theme}: ${what} ${ink} on ${fill} is ${contrast(ink, fill).toFixed(2)}:1`);
        assert.ok(contrast(ink, fill) >= Math.min(contrast(plain, fill), 4.5) - 1e-9, `${id} on ${theme}: ${what} got worse than the plain ink`);
      }
      // …and where the plain ink already read better than 4.5:1 on the tint, it is left exactly as it was.
      if (contrast(plain, banner) >= 4.5) assert.equal(readableOn(plain, banner), plain, `${id} on ${theme}: a banner ink that already passed was moved`);
      const row = selectedRow(plain, c.card);
      assert.ok(contrast(row.ink, row.fill) >= 4.5, `${id} on ${theme}: selected picker row ${row.ink} on ${row.fill} is ${contrast(row.ink, row.fill).toFixed(2)}:1`);
    }
  }
  const { light, dark } = themeColours();
  // The flaws these replace, measured with the colours that had them: judged the old way each is under 4.5:1.
  const oldInk = (id: keyof typeof CONCEPTS, c: { card: string }) => readableOn(CONCEPTS[id].color, c.card);
  for (const id of ['homework', 'activity'] as const) {
    assert.ok(contrast(oldInk(id, light), tints(id, light).banner) < 4.5, `${id} banner (light), judged against the card`);
  }
  // Quiz header pills: the label was accentInk on `accentInk + '18'` over the header, 3.7–4.5:1 across the colours and both modes.
  for (const [theme, c] of [['light', light], ['dark', dark]] as const) {
    // The pills exist on the quiz screen only, so the quiz's own colour is the one measured.
    for (const id of ['quiz'] as const) {
      const ink = oldInk(id, c);
      const oldPill = tintOver(ink, 0x18 / 255, tints(id, c).banner);
      assert.ok(contrast(ink, oldPill) < 4.5, `${id} pill (${theme}), judged the old way: ${contrast(ink, oldPill).toFixed(2)}:1`);
    }
  }
  // The attach-figure button in dark mode: 4.46 for the worksheet's colour, 4.11 for the homework's.
  assert.ok(contrast(oldInk('worksheet', dark), tints('worksheet', dark).figure) < 4.5, 'worksheet figure button (dark), judged against the card');
  assert.ok(contrast(oldInk('homework', dark), tints('homework', dark).figure) < 4.5, 'homework figure button (dark), judged against the card');
  // The dropdown's selected row in dark mode.
  const oldRow = tintOver(oldInk('homework', dark), 0x15 / 255, dark.card);
  assert.ok(contrast(oldInk('homework', dark), oldRow) < 4.5, 'dark selected row, judged against the card');
});

test('the screens draw those tints with ink judged against them', () => {
  // Worksheet and homework: the banner on the page, the attach-figure button on the card. Both start from accentInk.
  assert.match(worksheetCode, /const bannerInk = readableOn\(accentInk, tintOver\(ACCENT, 0x15 \/ 255, colors\.background\)\);/);
  assert.match(worksheetCode, /const figureInk = readableOn\(accentInk, tintOver\(ACCENT, 0x1a \/ 255, colors\.card\)\);/);
  assert.match(activityCode, /const bannerInk = readableOn\(ink, tintOver\(ACCENT, 0x15 \/ 255, colors\.background\)\);/);
  assert.match(worksheetCode, /<Ionicons name="document-text" size=\{20\} color=\{bannerInk\} \/>/);
  assert.match(worksheetCode, /wanted && \{ backgroundColor: ACCENT \+ '1A', borderColor: figureInk \}/);
  assert.match(worksheetCode, /color=\{wanted \? figureInk : colors\.mutedForeground\}/);
  // Quiz: the pills are drawn in an opaque fill and labelled for it.
  assert.match(quizCode, /const pillFill = tintOver\(ACCENT, 0x18 \/ 255, tintOver\(ACCENT, 0x15 \/ 255, colors\.background\)\);/);
  assert.match(quizCode, /const pillInk = readableOn\(accentInk, pillFill\);/);
  assert.equal((quizCode.match(/color=\{pillInk\} fill=\{pillFill\}/g) ?? []).length, 3);
  assert.match(quizCode, /backgroundColor: fill, borderRadius: 20/);
  // Every screen's dropdown draws its selected row in an opaque fill with its own ink.
  for (const [name, src] of [['quiz', quizCode], ['worksheet', worksheetCode], ['lesson plan', lessonPlanCode], ['activity', activityCode], ['slides', slidesCode]] as const) {
    assert.match(src, /const row = selectedRow\(props\.accent, props\.colors\.card\);/, name);
    assert.match(src, /selectedTint=\{row\.fill\}/, name);
    assert.match(src, /accent=\{row\.ink\}/, name);
    assert.doesNotMatch(src, /selectedTint=\{[^}]*\+ '15'\}/, `${name}: a translucent tint is back`);
  }
});

test('changing the grade or the subject after a Cancel clears the Cancel too, on every generator', () => {
  for (const [name, src] of [['quiz', quizCode], ['worksheet', worksheetCode], ['lesson plan', lessonPlanCode], ['activity', activityCode], ['slides', slidesCode]] as const) {
    const at = src.indexOf('prevGradeRef.current !== gradeIdx');
    assert.ok(at >= 0, `${name}: no grade/subject reset effect`);
    const effect = src.slice(at, src.indexOf('prevSubjectRef.current = subjectIdx;', at));
    assert.match(effect, /setCancelled\(false\);/, `${name}: the reset leaves «أُلغي» showing for the old pairing`);
    assert.match(effect, /setError\(''\);/, name);
    assert.match(effect, /setTopic\(''\);/, name);
  }
});

test('GenerationStatus takes its phase type from the one service, not a second declaration', () => {
  const src = code(read('components', 'ui', 'GenerationStatus.tsx'));
  assert.match(src, /import type \{ GenerationPhase \} from '@\/services\/generationPhase';/);
  assert.match(src, /export type \{ GenerationPhase \};/);
  assert.doesNotMatch(src, /type GenerationPhase =/);
});

// ── The toast clears the docked bar ─────────────────────────────────────────

test('every generator lifts its toast over the docked bar through the one helper, with the same condition it hides the bar by', () => {
  const screens = [
    ['quiz', quizCode, 'saveBarVisible'], ['worksheet', worksheetCode, 'saveBarVisible'], ['lesson plan', lessonPlanCode, 'saveBarVisible'],
    ['activity', activityCode, 'saveBarVisible'], ['slides', slidesCode, 'deckUnsaved'],
  ] as const;
  for (const [name, src, hidden] of screens) {
    assert.match(src, /import \{ toastLift \} from '@\/services\/dockedBar';/, name);
    assert.match(src, /import \{ useKeyboardVisible \} from '@\/hooks\/useKeyboardVisible';/, name);
    assert.match(src, /const keyboardOpen = useKeyboardVisible\(\);/, name);
    assert.match(src, new RegExp(`const toastBottom = toastLift\\(\\{ isDesktop, barHidden: ${hidden}, keyboardOpen \\}\\);`), `${name}: not computed through toastLift with the bar's own hidden condition`);
    assert.match(src, /<Toast [\s\S]*?bottomOffset=\{toastBottom\} \/>/, `${name}: the toast is not lifted`);
    // The same condition really is what hides the bar on that screen.
    assert.match(src, new RegExp(`hidden=\\{docked && ${hidden}\\}`), `${name}: the bar is hidden by another condition`);
    assert.doesNotMatch(src, /bottomOffset=\{isDesktop/, `${name}: an inline expression is back`);
  }
});

test('the bar\'s height is one constant in a pure file, re-exported by DockedAction so the screens\' imports keep working', () => {
  assert.match(code(read('services', 'dockedBar.ts')), /export const DOCKED_BAR_HEIGHT = 108;/);
  const dock = code(read('components', 'generator', 'DockedAction.tsx'));
  assert.match(dock, /import \{ DOCKED_BAR_HEIGHT \} from '@\/services\/dockedBar';/);
  assert.match(dock, /export \{ DOCKED_BAR_HEIGHT \};/);
  assert.doesNotMatch(dock, /DOCKED_BAR_HEIGHT = /, 'a second definition of the height');
  // The toast takes a lift and defaults to none, so every other screen\'s toast is where it was.
  assert.match(code(read('components', 'ui', 'Toast.tsx')), /bottomOffset = 0/);
});
