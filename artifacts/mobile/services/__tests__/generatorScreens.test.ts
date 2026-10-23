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
import { contrast } from '../readableColor.ts';

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
  assert.match(quizCode, /const statusPhase = loading \? 'loading' : cancelled \? 'cancelled' : \(error && topic\.trim\(\)\) \? 'error' : 'idle';/);
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
  assert.match(src, /if \(locked \|\| off\) return;/, 'a disabled chip must not call onToggle');
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
  for (const [name, src] of [['quiz', code(read('app', 'ai-tools', 'quiz.tsx'))], ['worksheet', worksheetCode]] as const) {
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
  assert.match(worksheetCode, /const statusPhase = loading \? 'loading' : cancelled \? 'cancelled' : \(error && topic\.trim\(\)\) \? 'error' : 'idle';/);
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
  assert.match(src, /const locked = on && !off && counted <= min;/);
  assert.doesNotMatch(src, /selected\.size/);
});

test('pressing generate again on the same refusal scrolls to it again: the effect also depends on an attempt counter', () => {
  for (const [name, src] of [['quiz', quizCode], ['worksheet', worksheetCode]] as const) {
    assert.match(src, /const \[attempt, setAttempt\] = useState\(0\);/, `${name}: no attempt counter`);
    // Bumped first thing in generate, before any early return (the refusals), and nothing else about generate moves.
    assert.match(src, /const generate = async \(opts\?: \{[^}]*\}\) => \{\s*(\/\/[^\n]*\n\s*)*setAttempt\(n => n \+ 1\);\s*const previous = result;/, `${name}: attempt is not bumped at the start of generate`);
    assert.match(src, /\}, \[statusPhase, attempt\]\);/, `${name}: the effect ignores the attempt`);
    assert.match(src, /if \(isDesktop \|\| statusPhase === 'idle'\) return;/, `${name}: an idle form must not scroll`);
  }
});
