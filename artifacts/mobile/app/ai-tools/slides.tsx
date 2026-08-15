/**
 * Slides Maker — build a projectable teaching deck for a lesson.
 *
 * Unlike the other generators this one does not always need the AI: when the
 * topic resolves to a curriculum lesson, the book already carries outcomes,
 * vocabulary, concepts and examples, and building the deck from those is both
 * instant and more trustworthy than generating them. The lesson plan is
 * fetched only to fill what the book does not hold (hook, practice, closure),
 * and the screen says which of the two the deck came from.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { DemoModeBanner } from '@/components/ui/DemoModeBanner';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import type { ClassroomActivity, LessonPlanOutput } from '@/services/ai/AIService';
import { buildGeneratorContext, resolveGeneratorGrounding } from '@/services/kbContext';
import { buildLessonDeck } from '@/services/lessonSlides';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { saveItem } from '@/services/workspace';
import { buildLessonPlanSlidesHTML, exportAsPDF } from '@/services/share';
import {
  getDefaultPickerGradeIndex, getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';

const ACCENT = '#0EA5E9';

export default function SlidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const grades = getPickerGrades();

  const [gradeIdx, setGradeIdx] = useState(getDefaultPickerGradeIndex);
  // Subjects follow the selected grade; KB-backed subjects lead the list so
  // legacy saved subjectIdx values (written against [math, chem, finlit])
  // still restore to the right subject.
  const subjects = getPickerSubjects(grades[gradeIdx].id);
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(undefined, subjects.length));
  // Changing grade swaps the subject list, so the subject resets in the same
  // event — an out-of-range subjectIdx must never survive to the next render.
  const pickGrade = (i: number) => { setGradeIdx(i); setSubjectIdx(0); };
  const [topic, setTopic] = useState('');
  const [includeExamples, setIncludeExamples] = useState(true);
  const [includePractice, setIncludePractice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<ClassroomActivity | null>(null);
  const [plan, setPlan] = useState<LessonPlanOutput | null>(null);
  const [grounded, setGrounded] = useState(false);
  const [groundedLesson, setGroundedLesson] = useState('');
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const prevGradeRef = useRef(gradeIdx);
  const prevSubjectRef = useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      setDeck(null);
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  const generate = async () => {
    const trimmed = topic.trim();
    if (!trimmed) { setError(t('topicRequired')); return; }
    setError(''); setLoading(true); setDeck(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const grounding = resolveGeneratorGrounding(trimmed, lang as 'ar' | 'en', { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
    setGrounded(grounding.grounded);
    setGroundedLesson(grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');

    try {
      // The plan supplies only the connective tissue. If it fails we still have
      // a usable deck from the book, so a generation error must not throw away
      // curriculum content the teacher can already project.
      let lessonPlan: LessonPlanOutput | null = null;
      try {
        lessonPlan = await aiService.generateLessonPlan({
          grade: grades[gradeIdx].name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          language: isAr ? 'arabic' : 'english',
          additionalContext: buildGeneratorContext(trimmed, lang as 'ar' | 'en', { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id }) || undefined,
        });
      } catch {
        lessonPlan = null;
      }

      if (!lessonPlan && !grounding.lesson) {
        setError(t('generationFailed'));
        return;
      }

      setPlan(lessonPlan);
      setDeck(buildLessonDeck(trimmed, isAr, {
        lesson: grounding.lesson,
        plan: lessonPlan,
        subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
        grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        includeExamples,
        includePractice,
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } finally {
      setLoading(false);
    }
  };

  const present = () => {
    if (!deck) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingClassroomActivity(deck);
    router.push('/ai-tools/classroom/presentation' as any);
  };

  const save = async () => {
    if (!deck) return;
    await saveItem({
      type: 'slides',
      title: deck.activityName,
      subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
      grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
      topic: topic.trim(),
      language: isAr ? 'ar' : 'en',
      content: JSON.stringify(deck),
      formState: { gradeId: grades[gradeIdx].id, gradeIdx, subjectIdx, topic: topic.trim(), includeExamples, includePractice },
    });
    showToast(t('slidesSaved'));
  };

  // PDF reuses the lesson-plan slide layout, which is already RTL-correct and
  // print-tested. Without a plan there is nothing that layout can render, so
  // the button only appears when one came back.
  const exportPdf = async () => {
    if (!plan) return;
    try {
      await exportAsPDF(
        buildLessonPlanSlidesHTML(plan, topic.trim(), {
          subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
          grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        }, isAr),
        `${topic.trim() || 'slides'}.pdf`,
      );
    } catch {
      showToast(t('generationFailed'));
    }
  };

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <Pressable
      onPress={() => { onChange(!value); Haptics.selectionAsync(); }}
      style={[styles.toggle, {
        borderColor: value ? ACCENT : colors.border,
        backgroundColor: value ? ACCENT + '12' : colors.card,
        borderRadius: colors.radius,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }]}
    >
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={20}
        color={value ? ACCENT : colors.mutedForeground}
      />
      <Text style={[styles.toggleText, {
        color: value ? ACCENT : colors.mutedForeground,
        fontFamily: value ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
      }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <DemoModeBanner onDark isRTL={isRTL} />
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 22 }}>🖥️</Text>
            <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
              {t('slidesTitle')}
            </Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
            {t('slidesSubtitle')}
          </Text>
        </View>

        <View style={styles.form}>
          <PickerRow
            label={t('grade')}
            items={grades.map(g => (isAr ? g.nameAr : g.name))}
            index={gradeIdx}
            onChange={pickGrade}
            colors={colors}
            isRTL={isRTL}
          />
          <PickerRow
            label={t('subjects')}
            items={subjects.map(s => (isAr ? s.nameAr : s.name))}
            index={subjectIdx}
            onChange={setSubjectIdx}
            colors={colors}
            isRTL={isRTL}
          />

          <TopicSelector
            subjectId={subjects[subjectIdx].id}
            gradeId={grades[gradeIdx].id}
            value={topic}
            onChange={v => { setTopic(v); setError(''); }}
            lang={lang as 'ar' | 'en'}
            isRTL={isRTL}
            colors={colors}
            accent={ACCENT}
            hasError={!!error && !topic}
            t={t}
          />

          <View style={{ gap: 10, marginBottom: 18 }}>
            <Toggle label={t('slidesIncludeExamples')} value={includeExamples} onChange={setIncludeExamples} />
            <Toggle label={t('slidesIncludePractice')} value={includePractice} onChange={setIncludePractice} />
          </View>

          {error ? (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}

          <Button
            label={loading ? t('slidesBuilding') : t('slidesBuild')}
            onPress={generate}
            loading={loading}
            fullWidth
          />
        </View>

        {loading && (
          <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <ActivityIndicator color={ACCENT} />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14 }}>
              {t('slidesBuilding')}
            </Text>
          </View>
        )}

        {deck && !loading && (
          <View style={{ marginHorizontal: 20 }}>
            <View style={{ marginBottom: 12 }}>
              <GroundingNotice
                grounded={grounded}
                lessonTitle={groundedLesson}
                isRTL={isRTL}
                colors={colors}
                labels={{
                  grounded: (l: string) => t('groundedInCurriculum', l),
                  generic: t('notGroundedTitle'),
                  genericHint: t('notGroundedHint'),
                }}
              />
            </View>

            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.previewTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {deck.activityName}
              </Text>
              <Text style={[styles.previewMeta, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('slideCount', deck.slides.length)}
              </Text>

              {/* The outline is the product: a teacher decides whether to use
                  this deck by scanning slide titles, not by opening it. */}
              <View style={{ marginTop: 12, gap: 6 }}>
                {deck.slides.map((s, i) => (
                  <View key={i} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.slideNum, { backgroundColor: ACCENT + '18' }]}>
                      <Text style={{ color: ACCENT, fontFamily: 'Cairo_700Bold', fontSize: 11 }}>{i + 1}</Text>
                    </View>
                    <Text
                      style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}
                      numberOfLines={1}
                    >
                      {s.title}
                    </Text>
                    {s.durationSeconds > 0 && (
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>
                        {s.durationSeconds}s
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              onPress={present}
              style={({ pressed }) => [styles.ctaBtn, { backgroundColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.88 : 1 }]}
            >
              <Ionicons name="tv-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 15 }}>{t('presentOnScreen')}</Text>
            </Pressable>

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
              <Pressable
                onPress={save}
                style={[styles.secondaryBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Ionicons name="bookmark-outline" size={16} color={ACCENT} />
                <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('save')}</Text>
              </Pressable>
              {plan && (
                <Pressable
                  onPress={exportPdf}
                  style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons name="document-outline" size={16} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>PDF</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

function PickerRow({
  label, items, index, onChange, colors, isRTL,
}: {
  label: string;
  items: string[];
  index: number;
  onChange: (i: number) => void;
  colors: any;
  isRTL: boolean;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {items.map((item, i) => {
          const active = i === index;
          return (
            <Pressable
              key={item + i}
              onPress={() => onChange(i)}
              style={[styles.pill, {
                backgroundColor: active ? ACCENT : colors.card,
                borderColor: active ? ACCENT : colors.border,
                borderRadius: colors.radius,
              }]}
            >
              <Text style={[styles.pillText, {
                color: active ? '#fff' : colors.mutedForeground,
                fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
              }]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  form: { padding: 20 },
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  pillRow: { flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  pillText: { fontSize: 13 },
  toggle: { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5 },
  toggleText: { fontSize: 13 },
  loadingBox: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginHorizontal: 20, marginBottom: 16 },
  previewCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 17, marginBottom: 4 },
  previewMeta: { fontSize: 12 },
  slideNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ctaBtn: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginBottom: 10 },
  secondaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderWidth: 1.5 },
});
