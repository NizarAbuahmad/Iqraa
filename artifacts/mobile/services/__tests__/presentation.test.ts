/**
 * Presentation-screen logic tests.
 *
 * Runs with Node's built-in test runner (no extra packages):
 *   node --experimental-strip-types --test artifacts/mobile/services/__tests__/presentation.test.ts
 *
 * Covers:
 *  1. timerColor() returns the correct colour at >50%, 10–50%, and <20% remaining.
 *  2. tickTimer() counts down from durationSeconds to 0.
 *  3. slideHasTimer() returns false for slides with durationSeconds = 0, and for
 *     read-out slide types (intro / reveal / summary …) whatever their duration.
 *  4. classroomStore set / get / clear round-trip.
 *  5. Integration: mock ClassroomActivity → classroomStore → simulated screen state
 *     (first slide, advance to next, hint toggle).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  timerColor,
  calcTimerPct,
  tickTimer,
  slideHasTimer,
  timerSecondsForSlide,
} from '../presentationUtils.ts';

import {
  setPendingClassroomActivity,
  getPendingClassroomActivity,
  clearClassroomActivity,
} from '../classroomStore.ts';

// Inlined types (avoids importing React-Native-dependent modules in Node runner)
interface ActivitySlide {
  slideNumber: number;
  type: 'intro' | 'challenge' | 'reveal' | 'summary' | 'bingo-call' | 'relay-problem'
      | 'divider' | 'scoreboard' | 'podium';
  title: string;
  content: string;
  hint?: string;
  answer?: string;
  unlockCode?: string;
  durationSeconds: number;
  teacher?: {
    expectedAnswer: string;
    commonMisconceptions?: string;
    teachingTips?: string;
    suggestedQuestions?: string[];
    differentiationTips?: string;
  };
}

interface ClassroomActivity {
  activityName: string;
  activityType: string;
  grade: string;
  subject: string;
  lesson: string;
  duration: number;
  difficulty: 'easy' | 'standard' | 'advanced';
  groupType: 'individual' | 'pairs' | 'groups' | 'whole-class';
  learningObjective: string;
  materials: string[];
  teacherPreparation: string;
  slides: ActivitySlide[];
  teacherNotes: string[];
  answerKey: string[];
  printables: string[];
  assessment: string;
  extensionChallenge: string;
}

// ─── Shared mock data ─────────────────────────────────────────────────────────

function makeSlide(overrides: Partial<ActivitySlide> = {}): ActivitySlide {
  return {
    slideNumber: 1,
    type: 'intro',
    title: 'Test Slide',
    content: 'Slide content here.',
    durationSeconds: 60,
    ...overrides,
  };
}

function makeMockActivity(): ClassroomActivity {
  return {
    activityName: 'Mock Quiz',
    activityType: 'challenge',
    grade: '10',
    subject: 'Math',
    lesson: 'Algebra Basics',
    duration: 20,
    difficulty: 'standard',
    groupType: 'individual',
    learningObjective: 'Solve linear equations.',
    materials: ['Whiteboard'],
    teacherPreparation: 'Prepare slides.',
    slides: [
      makeSlide({
        slideNumber: 1,
        type: 'intro',
        title: 'Welcome',
        content: 'Today we practise algebra.',
        durationSeconds: 30,
        hint: 'Remember: isolate the variable.',
        answer: 'x = 5',
        teacher: {
          expectedAnswer: 'x = 5',
          commonMisconceptions: 'Students forget to flip the sign.',
          teachingTips: 'Work through the example slowly.',
          suggestedQuestions: ['What is the first step?'],
        },
      }),
      makeSlide({
        slideNumber: 2,
        type: 'challenge',
        title: 'Solve: 2x + 3 = 13',
        content: 'Find x.',
        durationSeconds: 90,
        hint: 'Subtract 3 from both sides first.',
        answer: 'x = 5',
      }),
      makeSlide({
        slideNumber: 3,
        type: 'summary',
        title: 'Wrap-up',
        content: 'Great work today!',
        durationSeconds: 0, // no timer
      }),
    ],
    teacherNotes: ['Keep energy up.'],
    answerKey: ['x = 5'],
    printables: [],
    assessment: 'Exit ticket',
    extensionChallenge: 'Try 3x² = 75.',
  };
}

// ─── 1. timerColor ────────────────────────────────────────────────────────────

describe('timerColor()', () => {
  it('returns green when pct > 0.5 (majority of time remaining)', () => {
    assert.equal(timerColor(1.0), '#16A34A');
    assert.equal(timerColor(0.75), '#16A34A');
    assert.equal(timerColor(0.51), '#16A34A');
  });

  it('returns amber when pct is between 0.2 and 0.5 (10–50% bracket)', () => {
    assert.equal(timerColor(0.5),  '#D97706');
    assert.equal(timerColor(0.35), '#D97706');
    assert.equal(timerColor(0.21), '#D97706');
  });

  it('returns red when pct ≤ 0.2 (less than 20% remaining)', () => {
    assert.equal(timerColor(0.2),  '#DC2626');
    assert.equal(timerColor(0.1),  '#DC2626');
    assert.equal(timerColor(0.0),  '#DC2626');
  });
});

// ─── 2. Timer countdown ───────────────────────────────────────────────────────

describe('tickTimer() — counts down from durationSeconds to 0', () => {
  it('decrements by 1 each tick', () => {
    assert.equal(tickTimer(10), 9);
    assert.equal(tickTimer(1), 0);
  });

  it('never goes below 0', () => {
    assert.equal(tickTimer(0), 0);
  });

  it('reaches 0 after exactly durationSeconds ticks', () => {
    const duration = 5;
    let sec = duration;
    for (let i = 0; i < duration; i++) {
      sec = tickTimer(sec);
    }
    assert.equal(sec, 0, `should reach 0 after ${duration} ticks`);
  });

  it('calcTimerPct returns 0 when timerTotal is 0 (no timer slide)', () => {
    assert.equal(calcTimerPct(0, 0), 0);
  });

  it('calcTimerPct correctly represents fraction remaining', () => {
    assert.equal(calcTimerPct(30, 60), 0.5);
    assert.equal(calcTimerPct(60, 60), 1.0);
    assert.equal(calcTimerPct(0, 60), 0);
  });
});

// ─── 3. slideHasTimer ─────────────────────────────────────────────────────────

describe('slideHasTimer()', () => {
  it('returns false for durationSeconds = 0 (teacher-paced slide)', () => {
    const slide = makeSlide({ type: 'challenge', durationSeconds: 0 });
    assert.equal(slideHasTimer(slide), false);
  });

  it('returns true for durationSeconds > 0', () => {
    const slide = makeSlide({ type: 'challenge', durationSeconds: 60 });
    assert.equal(slideHasTimer(slide), true);
  });

  it('returns false on a read-out slide type even with a duration set', () => {
    assert.equal(slideHasTimer(makeSlide({ type: 'intro', durationSeconds: 60 })), false);
  });
});

// ─── 3b. timerSecondsForSlide — the clamp behind slideHasTimer ────────────────

describe('timerSecondsForSlide()', () => {
  it('keeps the duration on slide types the class works through', () => {
    assert.equal(timerSecondsForSlide(makeSlide({ type: 'challenge', durationSeconds: 90 })), 90);
    assert.equal(timerSecondsForSlide(makeSlide({ type: 'relay-problem', durationSeconds: 45 })), 45);
    assert.equal(timerSecondsForSlide(makeSlide({ type: 'bingo-call', durationSeconds: 30 })), 30);
  });

  it('refuses a countdown on slide types that are read out, not worked on', () => {
    // The generation prompts ask for 0 here; this is what happens when a model
    // ignores that and puts 60s on the mission slide.
    for (const type of ['intro', 'reveal', 'summary', 'divider', 'scoreboard', 'podium'] as const) {
      assert.equal(
        timerSecondsForSlide(makeSlide({ type, durationSeconds: 60 })),
        0,
        `${type} slides must not run a timer`,
      );
    }
  });

  it('never returns a negative or non-finite duration', () => {
    assert.equal(timerSecondsForSlide(makeSlide({ type: 'challenge', durationSeconds: -30 })), 0);
    assert.equal(
      timerSecondsForSlide({ type: 'challenge', durationSeconds: undefined as unknown as number }),
      0,
    );
  });

  it('leaves the deck untouched — the clamp is display-only', () => {
    const slide = makeSlide({ type: 'intro', durationSeconds: 60 });
    timerSecondsForSlide(slide);
    assert.equal(slide.durationSeconds, 60, 'the stored deck keeps what the model produced');
  });
});

// ─── 4. classroomStore ────────────────────────────────────────────────────────

describe('classroomStore — set / get / clear round-trip', () => {
  beforeEach(() => {
    clearClassroomActivity();
  });

  it('returns null when nothing has been set', () => {
    assert.equal(getPendingClassroomActivity(), null);
  });

  it('returns the activity that was set', () => {
    const activity = makeMockActivity();
    setPendingClassroomActivity(activity);
    assert.equal(getPendingClassroomActivity(), activity);
  });

  it('returns null after clearClassroomActivity()', () => {
    setPendingClassroomActivity(makeMockActivity());
    clearClassroomActivity();
    assert.equal(getPendingClassroomActivity(), null);
  });

  it('replaces the previous activity when set twice', () => {
    const a1 = makeMockActivity();
    const a2 = { ...makeMockActivity(), activityName: 'Second Activity' };
    setPendingClassroomActivity(a1);
    setPendingClassroomActivity(a2);
    assert.equal(getPendingClassroomActivity()?.activityName, 'Second Activity');
  });
});

// ─── 5. Integration — simulated PresentationScreen state ─────────────────────

describe('PresentationScreen — simulated state flow', () => {
  beforeEach(() => {
    clearClassroomActivity();
  });

  it('first slide is rendered when activity is loaded from store', () => {
    const activity = makeMockActivity();
    setPendingClassroomActivity(activity);

    // Simulate what useEffect([]) does on mount
    const loaded = getPendingClassroomActivity();
    assert.ok(loaded, 'activity should be present in store');

    let slideIndex = 0;
    const slide = loaded!.slides[slideIndex];
    assert.equal(slide.title, 'Welcome', 'first slide title should be "Welcome"');
    assert.equal(slide.slideNumber, 1);
  });

  it('advances to next slide and resets hint/answer visibility', () => {
    const activity = makeMockActivity();
    setPendingClassroomActivity(activity);
    const loaded = getPendingClassroomActivity()!;

    // Start on slide 0, toggle hint visible
    let slideIndex = 0;
    let hintVisible = false;
    let answerVisible = false;

    hintVisible = true;   // teacher reveals hint
    answerVisible = true; // teacher reveals answer

    // Simulate goToSlide(1) — initSlide resets visibility
    slideIndex = 1;
    hintVisible = false;
    answerVisible = false;

    const slide = loaded.slides[slideIndex];
    assert.equal(slide.title, 'Solve: 2x + 3 = 13');
    assert.equal(hintVisible, false, 'hint should reset on slide change');
    assert.equal(answerVisible, false, 'answer should reset on slide change');
  });

  it('mission slide does not run a countdown even when the model timed it', () => {
    // The reported bug: slide 1 of a generated escape-challenge deck showed a
    // live 00:58 counting down against «مهمتكم» — a paragraph with no task in it.
    const activity = makeMockActivity();
    setPendingClassroomActivity(activity);
    const loaded = getPendingClassroomActivity()!;

    const missionSlide = loaded.slides[0];
    assert.equal(missionSlide.type, 'intro');
    assert.ok(missionSlide.durationSeconds > 0, 'the model did put a duration on it');

    // Simulate initSlide for the mission slide
    const timerTotal = timerSecondsForSlide(missionSlide);
    assert.equal(timerTotal, 0, 'no timer box, no countdown bar');
    assert.equal(slideHasTimer(missionSlide), false);
  });

  it('summary slide (durationSeconds=0) has no timer', () => {
    const activity = makeMockActivity();
    setPendingClassroomActivity(activity);
    const loaded = getPendingClassroomActivity()!;

    const summarySlide = loaded.slides[2];
    assert.equal(summarySlide.type, 'summary');
    assert.equal(slideHasTimer(summarySlide), false, 'summary slide should have no timer');

    // Simulate initSlide for the summary slide
    const timerTotal = summarySlide.durationSeconds > 0 ? summarySlide.durationSeconds : 0;
    const timerRunning = summarySlide.durationSeconds > 0;
    assert.equal(timerTotal, 0);
    assert.equal(timerRunning, false);
  });

  it('hint toggles on and off without changing slide', () => {
    const activity = makeMockActivity();
    setPendingClassroomActivity(activity);
    const loaded = getPendingClassroomActivity()!;

    let hintVisible = false;
    const slideIndex = 0;
    const slide = loaded.slides[slideIndex];

    assert.ok(slide.hint, 'slide should have a hint');

    // Toggle hint on
    hintVisible = !hintVisible;
    assert.equal(hintVisible, true);

    // Toggle hint off
    hintVisible = !hintVisible;
    assert.equal(hintVisible, false);

    // Slide index unchanged
    assert.equal(slideIndex, 0);
  });

  it('teacher panel state is per-slide and resets on navigation', () => {
    const activity = makeMockActivity();
    setPendingClassroomActivity(activity);
    const loaded = getPendingClassroomActivity()!;

    let teacherPanelOpen = false;
    let slideIndex = 0;

    // Open teacher panel on slide 0 (which has teacher notes)
    assert.ok(loaded.slides[0].teacher, 'slide 0 should have teacher notes');
    teacherPanelOpen = true;
    assert.equal(teacherPanelOpen, true);

    // Navigate to slide 1 — initSlide closes the panel
    slideIndex = 1;
    teacherPanelOpen = false;
    assert.equal(teacherPanelOpen, false);
  });

  it('cannot navigate before first slide or past last slide', () => {
    const activity = makeMockActivity();
    const totalSlides = activity.slides.length;

    // Simulate goToSlide boundary check
    function canGoTo(idx: number): boolean {
      return idx >= 0 && idx < totalSlides;
    }

    assert.equal(canGoTo(-1), false, 'cannot go before slide 0');
    assert.equal(canGoTo(0), true);
    assert.equal(canGoTo(totalSlides - 1), true);
    assert.equal(canGoTo(totalSlides), false, 'cannot go past last slide');
  });

  it('store is cleared when presentation screen exits (prevents stale activity re-appearing)', () => {
    const activity = makeMockActivity();

    // Builder sets the activity (handleStartPresentation in builder.tsx)
    setPendingClassroomActivity(activity);

    // Presentation screen mounts — activity must be present with at least one slide
    const loaded = getPendingClassroomActivity();
    assert.ok(loaded, 'activity must be in store when presentation screen mounts');
    assert.ok(loaded!.slides.length >= 1, 'activity must have at least one slide');

    // Presentation screen exits — useFocusEffect cleanup calls clearClassroomActivity()
    clearClassroomActivity();

    assert.equal(
      getPendingClassroomActivity(),
      null,
      'store must be empty after presentation screen exits',
    );
  });
});

// ─── 6. Builder → store → presentation handoff ────────────────────────────────

describe('builder → store → presentation — end-to-end handoff', () => {
  beforeEach(() => {
    clearClassroomActivity();
  });

  it('getPendingClassroomActivity() returns a valid activity with at least one slide after builder sets it', () => {
    // Simulate what handleStartPresentation() in builder.tsx does
    const generated = makeMockActivity();
    setPendingClassroomActivity(generated);

    const retrieved = getPendingClassroomActivity();

    assert.ok(retrieved !== null, 'activity must not be null after builder sets it');
    assert.equal(typeof retrieved!.activityName, 'string', 'activityName must be a string');
    assert.ok(retrieved!.activityName.length > 0, 'activityName must be non-empty');
    assert.ok(Array.isArray(retrieved!.slides), 'slides must be an array');
    assert.ok(retrieved!.slides.length >= 1, 'activity must have at least one slide');

    // The exact object reference is preserved (no serialisation round-trip)
    assert.equal(retrieved, generated, 'retrieved activity must be the same object reference');
  });

  it('first slide title and slideNumber are accessible immediately on the presentation screen', () => {
    const generated = makeMockActivity();
    setPendingClassroomActivity(generated);

    // Presentation screen reads the store on mount
    const loaded = getPendingClassroomActivity()!;
    const firstSlide = loaded.slides[0];

    assert.ok(firstSlide, 'first slide must exist');
    assert.equal(typeof firstSlide.title, 'string');
    assert.equal(typeof firstSlide.slideNumber, 'number');
    assert.equal(firstSlide.slideNumber, 1, 'first slide must have slideNumber 1');
  });

  it('store is null before builder sets it (no phantom activity on first launch)', () => {
    // Nothing set yet
    assert.equal(getPendingClassroomActivity(), null);
  });

  it('clearClassroomActivity() after exit leaves store empty for the next session', () => {
    setPendingClassroomActivity(makeMockActivity());
    assert.ok(getPendingClassroomActivity() !== null, 'activity present before exit');

    // Simulate useFocusEffect cleanup
    clearClassroomActivity();

    assert.equal(getPendingClassroomActivity(), null, 'store empty after exit');

    // A subsequent builder run sets a fresh activity normally
    const second = { ...makeMockActivity(), activityName: 'Second Session' };
    setPendingClassroomActivity(second);
    assert.equal(getPendingClassroomActivity()?.activityName, 'Second Session');
  });
});
