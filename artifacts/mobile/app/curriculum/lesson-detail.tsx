import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import {
  getLessonById,
  getLessonsForUnit,
  isBrowserLessonTitleOnly,
} from '@/services/curriculumData';
import { lockState } from '@/services/lessonLock';
import { useMasteryProgress } from '@/hooks/useMasteryProgress';
import { LessonPrepPanel } from '@/components/ui/LessonPrepPanel';
import { LessonMediaPanel } from '@/components/ui/LessonMediaPanel';
import { ReadAloudPracticePanel } from '@/components/ui/ReadAloudPracticePanel';
import { LessonShelfPanel } from '@/components/ui/LessonShelfPanel';
import { VirtualLabCard } from '@/components/ui/VirtualLabCard';
import { askAboutLessonHandoff } from '@/services/lessonShelf';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { bookPagesForLesson } from '@/services/bookFigures';
import { VocabularyPracticePanel } from '@/components/ui/VocabularyPracticePanel';
import { hubLesson } from '@workspace/curriculum/englishHub';
import { bookFigureRefsForLesson } from '@/services/bookFigureUri';
import { goBack } from '@/services/navigation';
import { readableOn } from '@/services/readableColor';
import { palette } from '@/constants/colors';
import { BackButton } from '@/components/ui/BackButton';

const BLOOMS_COLORS: Record<string, string> = {
  Remember: '#6366F1',
  Understand: palette.info,
  Apply: palette.success,
  Analyze: palette.warning,
  Evaluate: '#F97316',
  Create: palette.destructive,
};

export default function LessonDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const isTeacher = isTeacherRole(user?.role);
  const { lessonId, subjectColor, openLessonPlan } = useLocalSearchParams<{
    lessonId: string;
    subjectColor: string;
    openLessonPlan?: string;
  }>();
  const lesson = getLessonById(lessonId);
  // Subject colours are picked for hue; `colorFill` carries white header text,
  // `color` is text and tints on cards — each adjusted to stay legible.
  const colorFill = readableOn(subjectColor ?? colors.hero, '#FFFFFF');
  const color = readableOn(subjectColor ?? colors.primary, colors.card);
  const showTitleOnly = lesson ? isBrowserLessonTitleOnly(lesson.id) : false;
  const hasBookPages = lesson ? bookPagesForLesson(lesson.id) !== null : false;
  /**
   * Preparation happens on this page. Opening it is one tap and it generates
   * straight away — the teacher has already told us the lesson by getting here.
   */
  const [prepOpen, setPrepOpen] = useState(false);

  const lessonTitle = lesson
    ? (lang === 'ar' ? (lesson.titleAr || lesson.title) : lesson.title)
    : '';

  // Resume path ("continue teaching"): land on the lesson with preparation
  // already open. It used to push the AI Tools form on a timer, which took the
  // teacher off the lesson they had just resumed.
  useEffect(() => {
    if (openLessonPlan === '1' && lesson) setPrepOpen(true);
  }, [openLessonPlan, lesson]);

  // A locked lesson can also be reached by a deep link or the back stack, so
  // the lock is enforced here as well as on the unit list.
  const masteryProgress = useMasteryProgress();
  const lock = lesson ? lockState(getLessonsForUnit(lesson.unitId).map(l => l.id), masteryProgress) : null;
  const lessonLocked = lesson ? lock!.locked.has(lesson.id) : false;

  if (!lesson) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }}>{t('lessonNotFound')}</Text>
      </View>
    );
  }

  if (lessonLocked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        <Ionicons name="lock-closed" size={40} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 17, textAlign: 'center' }}>
          {t(lock?.awaiting ? 'masteryAwaitingTitle' : 'masteryLockedTitle')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, textAlign: 'center' }}>
          {t(lock?.awaiting ? 'masteryAwaitingBody' : 'masteryLockedBody')}
        </Text>
        <Pressable
          onPress={() => router.replace('/my-exams' as never)}
          style={{ backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: colors.radius }}
        >
          <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>
            {t('masteryGoToExams')}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => goBack()} hitSlop={10}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14 }}>{t('masteryClose')}</Text>
        </Pressable>
      </View>
    );
  }

  const objectivesArr = lang === 'ar' ? (lesson.objectivesAr || lesson.objectives) : lesson.objectives;
  const keywordsArr = lang === 'ar' ? (lesson.keywordsAr || lesson.keywords) : lesson.keywords;
  const noteText = lang === 'ar' ? (lesson.teacherNotesAr || lesson.teacherNotes) : lesson.teacherNotes;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: colorFill, paddingTop: insets.top + 12 }]}>
        <BackButton color="#fff" style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={[styles.heroTitle, { color: '#fff', fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {lessonTitle}
        </Text>
        <View style={[styles.heroMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {showTitleOnly ? (
            <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={[styles.heroPillText, { color: '#fff', fontFamily: 'ReadexPro_500Medium' }]}>
                {t('curriculumTitleOnlyBadge')}
              </Text>
            </View>
          ) : null}
          <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="time-outline" size={12} color="#fff" />
            <Text style={[styles.heroPillText, { color: '#fff', fontFamily: 'Almarai_400Regular' }]}>
              {lesson.estimatedDuration} {t('min')}
            </Text>
          </View>
          <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="school-outline" size={12} color="#fff" />
            <Text style={[styles.heroPillText, { color: '#fff', fontFamily: 'Almarai_400Regular' }]}>
              {lesson.outcomes.length} {t('outcomes')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/*
          Teacher-only, and not merely cosmetically.

          A student can reach this page — `/curriculum` is on the non-teacher
          allowlist — and both buttons were shown to every role. «حضّر» runs
          generation, which the server refuses without a teacher role; but
          `RemoteAIService` falls back to `MockAIService` on failure, and its own
          header says mock output "is indistinguishable from a real answer by
          inspection: it is a well-formed Arabic lesson plan either way". So a
          student did not get a 403 — they got a fabricated lesson plan. "Ask
          iQra" pushes `/(tabs)/iqra`, which the route guard bounces.

          Gated here rather than in `routeGating`: allowlisting the iQra tab
          would hand students the teacher chat, which is the opposite of the fix.
        */}
        {isTeacher ? (
        <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPrepOpen(open => !open);
            }}
            style={[styles.aiBtn, { backgroundColor: colorFill, borderRadius: colors.radius, flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name={prepOpen ? 'chevron-up' : 'sparkles'} size={18} color="#fff" />
            <Text style={[styles.aiBtnText, { color: '#fff', fontFamily: 'ReadexPro_600SemiBold' }]}>
              {prepOpen ? t('prepInlineHide') : t('generateAILesson')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: '/(tabs)/iqra',
                params: {
                  // `lesson.id`, not the route param: the shelf below pins on the
                  // resolved lesson and both must name the same one.
                  ...askAboutLessonHandoff(lesson.id, lessonTitle, lang as 'ar' | 'en'),
                  subjectColor: color,
                  askId: String(Date.now()),
                },
              } as any);
            }}
            style={[styles.askIqraBtn, { backgroundColor: colors.card, borderColor: color, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={color} />
            <Text style={[styles.askIqraBtnText, { color, fontFamily: 'ReadexPro_600SemiBold' }]}>
              {t('askIqra')}
            </Text>
          </Pressable>
          {/* The lesson's pages of the student book, to project with the pen. */}
          {hasBookPages ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({ pathname: '/ai-tools/classroom/book-page', params: { lessonId: lesson.id } } as never);
              }}
              accessibilityRole="button"
              style={[styles.askIqraBtn, { backgroundColor: colors.card, borderColor: color, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="book-outline" size={16} color={color} />
              <Text style={[styles.askIqraBtnText, { color, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {t('bookPageButton')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        ) : null}

        {/* Preparation — in place, on the lesson it belongs to. Teacher-only
            for the same reason as the button that opens it. */}
        {isTeacher && prepOpen ? <LessonPrepPanel lessonId={lesson.id} accent={color} /> : null}

        {/* What the library actually holds for this lesson. Above the
            curriculum sections because a teacher preparing tomorrow wants the
            worksheets before they want the Bloom's levels. */}
        <LessonShelfPanel lessonId={lesson.id} accent={color} />

        {/* The PhET simulation for a lab lesson, with its predict–observe–explain
            sheet. Renders nothing on a lesson with no released lab. */}
        <VirtualLabCard lessonId={lesson.id} accent={color} />

        {/* Curated video and images, played and shown in place rather than
            linked. Below the shelf, which lists everything including these:
            the shelf answers "what is there", this answers "show me". Renders
            nothing when the lesson has no curated media, which is most of
            them until the library is curated. */}
        <LessonMediaPanel lessonId={lesson.id} accent={color} />

        {/* The book's own diagrams for this lesson.

            These were already bundled and already resolved — `BookFiguresPanel`
            has been rendering them on six teacher screens and inside the exam a
            student sits since `bookFigureAssets.ts` landed. They were never on
            the page a student reads while studying, which is the one place a
            diagram from their own book is most obviously wanted. 249 lessons
            have them; the panel returns null for the rest.

            Its own note key is exam-worded («الدروس التي يغطّيها هذا الاختبار»),
            so this passes a lesson-page one instead of reusing a sentence that
            would name an exam that does not exist here. */}
        <View style={{ paddingHorizontal: 20 }}>
          <BookFiguresPanel
            figures={bookFigureRefsForLesson(lesson.id, lang === 'ar')}
            isRTL={isRTL}
            colors={colors}
            labels={{ title: t('bookFiguresTitle'), note: t('bookFiguresLessonNote') }}
          />
        </View>

        {/* The one thing on this page built for a student rather than a
            teacher. Renders nothing when the lesson has no curated passage,
            which is most of them until the library is filled. */}
        <ReadAloudPracticePanel lessonId={lesson.id} accent={color} />

        {/* The lesson's own vocabulary, drilled. Unlike read-aloud above — which
            needs a curated passage and so reaches six lessons — this comes from
            the book's printed Word List and reaches 72, on every platform,
            with no server call to make. Renders nothing elsewhere. */}
        <VocabularyPracticePanel lessonId={lesson.id} accent={color} />

        {/* Grades 1–4 and 9–10 English: the same words, voiced and played with. */}
        {hubLesson(lesson.id) ? (
          <Pressable
            onPress={() => router.push({ pathname: '/curriculum/english/[lessonId]', params: { lessonId: lesson.id } } as never)}
            style={({ pressed }) => [
              styles.hubLink,
              { backgroundColor: colorFill, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={{ fontSize: 24 }}>🎧</Text>
            <Text style={{ flex: 1, color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
              {t('hubOpenFromLesson')}
            </Text>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="#fff" />
          </Pressable>
        ) : null}

        {/* Objectives */}
        <Section title={t('learningObjectives')} icon="checkmark-circle-outline" color={color} isRTL={isRTL}>
          {objectivesArr.map((obj, i) => (
            <View key={i} style={[styles.bullet, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.bulletDot, { backgroundColor: colorFill }]} />
              <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {obj}
              </Text>
            </View>
          ))}
        </Section>

        {/* Keywords — the NCCD books don't all print a per-lesson term list
            (Arabic prints none at all), and an empty card under a heading
            reads as a loading failure rather than "the book says nothing". */}
        {keywordsArr.length > 0 && (
        <Section title={t('keyTerms')} icon="pricetag-outline" color={color} isRTL={isRTL}>
          <View style={[styles.keywords, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {keywordsArr.map(k => (
              <View key={k} style={[styles.keyword, { backgroundColor: color + '15', borderColor: color + '30', borderRadius: 8 }]}>
                <Text style={[styles.keywordText, { color, fontFamily: 'ReadexPro_500Medium' }]}>{k}</Text>
              </View>
            ))}
          </View>
        </Section>
        )}

        {/* Teacher Notes — addressed to the teacher («دع الطلاب يتدربون…»),
            and this is the student's study page too. */}
        {isTeacher && !!noteText && (
        <Section title={t('teacherNotes')} icon="clipboard-outline" color={color} isRTL={isRTL}>
          <Text style={[styles.noteText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {noteText}
          </Text>
        </Section>
        )}

        {/* Learning Outcomes */}
        <Section title={t('learningOutcomes')} icon="trophy-outline" color={color} isRTL={isRTL}>
          {lesson.outcomes.map(o => {
            const bloomColor = BLOOMS_COLORS[o.bloomsLevel] ?? color;
            const outcomeDesc = lang === 'ar' ? (o.descriptionAr || o.description) : o.description;
            return (
              <View key={o.id} style={[styles.outcomeCard, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                <View style={[styles.outcomeTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.bloomsBadge, { backgroundColor: bloomColor + '20' }]}>
                    <Text style={[styles.bloomsText, { color: bloomColor, fontFamily: 'ReadexPro_600SemiBold' }]}>{o.bloomsLevel}</Text>
                  </View>
                </View>
                <Text style={[styles.outcomeDesc, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {outcomeDesc}
                </Text>
                <View style={[styles.skills, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {o.skills.map(s => (
                    <View key={s} style={[styles.skillPill, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 6 }]}>
                      <Text style={[styles.skillText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </Section>
      </View>
    </ScrollView>
  );
}

function Section({ title, icon, color, isRTL, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; color: string; isRTL: boolean; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
          {title}
        </Text>
      </View>
      <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12 }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hubLink: { alignItems: 'center', gap: 12, padding: 14, marginTop: 12 },
  hero: { paddingHorizontal: 20, paddingBottom: 14 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  heroTitle: { fontSize: 22, lineHeight: 30, marginBottom: 12 },
  heroMeta: { gap: 8 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  heroPillText: { fontSize: 12 },
  body: { padding: 20 },
  actionRow: { gap: 10, marginBottom: 24 },
  aiBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  aiBtnText: { fontSize: 14 },
  askIqraBtn: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderWidth: 1.5 },
  askIqraBtnText: { fontSize: 13 },
  section: { marginBottom: 20 },
  sectionHeader: { alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 15 },
  sectionBody: { padding: 16, borderWidth: 1 },
  bullet: { gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 23 },
  keywords: { flexWrap: 'wrap', gap: 8 },
  keyword: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  keywordText: { fontSize: 12 },
  noteText: { fontSize: 15, lineHeight: 23 },
  outcomeCard: { padding: 14, marginBottom: 10 },
  outcomeTop: { marginBottom: 8 },
  bloomsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  bloomsText: { fontSize: 11 },
  outcomeDesc: { fontSize: 15, lineHeight: 21, marginBottom: 10 },
  skills: { flexWrap: 'wrap', gap: 6 },
  skillPill: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  skillText: { fontSize: 11, lineHeight: 18 },
});
