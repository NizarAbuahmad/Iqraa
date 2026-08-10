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
import { buildGraphSlide, buildMediaSlide, extractGraphCommands } from './classMedia.ts';
import { getLessonMedia } from './lessonMedia.ts';
import { resolveGeneratorGrounding } from './kbContext.ts';
import type { ClassroomActivity } from './ai/AIService.ts';

export type StartClassInput = {
  topic: string;
  lang: 'ar' | 'en';
  subjectId?: string;
  subjectName?: string;
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
}: StartClassInput): Promise<ClassroomActivity> {
  const topic = rawTopic.trim();
  const isAr = lang === 'ar';
  const grounding = resolveGeneratorGrounding(topic, lang);

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

  const objSlide = objectivesSlide(grounding.lesson, topic, isAr, 0);

  // Plot what the class is actually about: the lesson's own examples AND the
  // functions inside the generated questions. Curriculum objectives are prose
  // and rarely contain a plottable definition, so they alone are not enough.
  const isMath = subjectId === 'mathematics';
  const graphCommands = isMath
    ? extractGraphCommands(
        [
          topic,
          ...(grounding.lesson?.examplesAr ?? []),
          ...(grounding.lesson?.objectives ?? []),
          ...activity.slides.map(s => s.content),
        ].join(' \n '),
      )
    : [];
  // Math lessons always get a graph slide — with the lesson's functions
  // preloaded when we found any, otherwise a blank calculator to type into live.
  const graphSlide = isMath ? buildGraphSlide(graphCommands, topic, isAr, 0) : null;

  const media = await getLessonMedia(topic);
  const mediaSlides = media.map(m => buildMediaSlide(m.kind, m.url, m.caption, isAr, 0));

  return {
    ...activity,
    slides: assembleDeckSlides({
      activitySlides: activity.slides,
      objectives: objSlide,
      graph: graphSlide,
      media: mediaSlides,
    }),
  };
}
