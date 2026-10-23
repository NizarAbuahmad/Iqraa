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
  assert.match(quizCode, /scrollRef\.current\?\.scrollTo\(\{ y: Math\.max\(0, statusY\.current - SPACE\.lg\), animated: !reduceMotion \}\);\s*\}, \[statusPhase\]\);/);
  assert.match(quizCode, /const reduceMotion = useReduceMotion\(\);/);
});
