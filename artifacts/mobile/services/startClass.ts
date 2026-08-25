/**
 * Start Class — build a projectable deck for the current lesson and hand it to
 * the presentation screen.
 *
 * Straight from the curriculum book (objectives + Quick Check questions), so a
 * teacher can start cold with no prep. This lived inside the home screen; it
 * moved here when the home tab was retired in favour of the chat landing, and
 * it is the only reason that screen's retirement is not a feature loss.
 */
import { remoteAIService as aiService } from './ai/RemoteAIService.ts';
import { assembleDeckSlides, objectivesSlide } from './classDeck.ts';
import { buildChartSlide, buildGraphSlide, buildMediaSlide, extractGraphCommands } from './classMedia.ts';
import { chartForLesson } from './deckVisuals.ts';
import { getLessonMedia } from './lessonMedia.ts';
import { resolveGeneratorGrounding } from './kbContext.ts';
import { getLessonById } from './knowledgeBase.ts';
import type { ClassroomActivity } from './ai/AIService.ts';

export type StartClassInput = {
  topic: string;
  lang: 'ar' | 'en';
  subjectId?: string;
  subjectName?: string;
  /**
   * The KB id of the lesson to ground on, when the caller knows it.
   *
   * `resolveGeneratorGrounding` resolves an exact lesson title correctly
   * (checked: 63/63 of the picker's titles), so this is not a fix for a
   * drifting deck — it is the caller saying which lesson it means instead of
   * hoping a string round-trips. It matters where the string is not a lesson
   * title at all: an entire-unit pick, a free-typed topic, a title the
   * teacher has since edited.
   */
  lessonId?: string | null;
};

/**
 * Returns the activity with its slides assembled and numbered. The caller
 * stores and navigates — keeping routing out of here is what makes this
 * callable from any screen.
 */
export async function buildClassDeck({
  topic: rawTopic,
  lang,
  subjectId = 'mathematics',
  subjectName = 'Mathematics',
  lessonId,
}: StartClassInput): Promise<ClassroomActivity> {
  const topic = rawTopic.trim();
  const isAr = lang === 'ar';
  const groundedLesson = (lessonId ? getLessonById(lessonId) : null)
    ?? resolveGeneratorGrounding(topic, lang).lesson;

  const activity = await aiService.generateClassroomActivity({
    grade: '10',
    subject: subjectName,
    topic,
    activityType: 'quick-check',
    duration: 15,
    difficulty: 'standard',
    groupType: 'whole-class',
    teachingGoal: 'warm-up',
    language: isAr ? 'arabic' : 'english',
  });

  const objSlide = objectivesSlide(groundedLesson, topic, isAr, 0);

  // Plot what the class is actually about: the lesson's own examples AND the
  // functions inside the generated questions. Curriculum objectives are prose
  // and rarely contain a plottable definition, so they alone are not enough.
  // Key the visual off what the LESSON CONTAINS, not off its subject id.
  //
  // This used to read `subjectId === 'mathematics'`, which meant chemistry and
  // financial-literacy decks got no functional visual at all — for months,
  // silently, because nothing fails when a branch simply never runs. Any
  // lesson whose text carries a plottable function now gets its curve,
  // whatever subject it belongs to, and every subject added later inherits
  // that instead of needing another branch here.
  const graphCommands = extractGraphCommands(
    [
      topic,
      ...(groundedLesson?.examplesAr ?? []),
      ...(groundedLesson?.objectives ?? []),
      ...activity.slides.map(s => s.content),
    ].join(' \n '),
  );
  // Maths keeps its blank-calculator affordance when nothing was found — a
  // teacher typing a function live in front of the class is the point of the
  // slide. Other subjects get a graph only when there is something to graph;
  // an empty calculator on a chemistry deck is clutter, not a tool.
  const isMath = subjectId === 'mathematics';
  const graphSlide = graphCommands.length > 0 || isMath
    ? buildGraphSlide(graphCommands, topic, isAr, 0)
    : null;

  // A chart when the lesson's own text states a dataset — a budget split, a
  // set of shares. `chartForLesson` refuses everything it is not certain of
  // (a statistics mean exercise is a list of bare numbers, not a dataset), so
  // most lessons get nothing here and that is the intended outcome.
  const chartVisual = chartForLesson(
    [
      ...(groundedLesson?.examplesAr ?? []),
      ...(groundedLesson?.keyConceptsAr ?? []),
      ...activity.slides.map(s => s.content),
    ].join('\n'),
  );
  const chartSlide = chartVisual ? buildChartSlide(chartVisual, topic, isAr, 0) : null;

  const media = await getLessonMedia(topic);
  const mediaSlides = media.map(m => buildMediaSlide(m.kind, m.url, m.caption, isAr, 0));

  return {
    ...activity,
    slides: assembleDeckSlides({
      activitySlides: activity.slides,
      objectives: objSlide,
      graph: graphSlide,
      chart: chartSlide,
      media: mediaSlides,
    }),
  };
}
