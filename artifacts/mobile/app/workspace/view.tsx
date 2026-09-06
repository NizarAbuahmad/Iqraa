import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { SavedMaterial, getItem } from '@/services/workspace';
import { useFavorite } from '@/hooks/useFavorite';
import {
  ActivityOutput, ActivityStep, ClassroomActivity, LessonFlowOutput, LessonPlanOutput,
  QuizOutput, SimplifiedExplanationOutput, WorksheetOutput,
} from '@/services/ai/AIService';
import { looksLikeActivityContent } from '@/services/materialShape';
import { arCountPhrase } from '@/services/arCount';
// One map, not two. This screen kept its own copy of the same five colours;
// adding a sixth to a private copy is exactly the drift `materialKind.ts` was
// extracted to stop — a card in موادي and the material it opens must not
// disagree about what colour an activity is.
import { MATERIAL_COLOR } from '@/constants/materialKind';
import { activityTypeLabel } from '@/constants/activityType';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { normalizeQuestionOptions, optionLetter } from '@/services/optionLabels';
import { bookFigureRefsForLesson } from '@/services/bookFigureUri';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { resolveGeneratorGrounding } from '@/services/kbContext';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import {
  buildActivityHTML, buildLessonFlowHTML, buildLessonPlanHTML, buildQuizHTML,
  buildSimplifiedExplanationHTML, buildWorksheetHTML,
  copyToClipboard, exportAsPDF, exportAsWord,
  formatActivityText, formatLessonPlanText, formatQuizText,
  formatSimplifiedExplanationText, formatWorksheetText,
  shareAsText,
} from '@/services/share';
import { SimplifiedExplanationView } from '@/components/ui/SimplifiedExplanationView';

export default function WorkspaceViewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const [item, setItem] = useState<SavedMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingWord, setLoadingWord] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, setFavorited, toggle: handleToggleFavorite } =
    useFavorite(item?.id, key => showToast(t(key)));

  useEffect(() => {
    if (id) {
      getItem(id).then(m => {
        setItem(m);
        setFavorited(m?.isFavorite ?? false);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: 12 }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15 }}>
          {t('noContentAvailable')}
        </Text>
        <Pressable onPress={() => router.back()} style={{ padding: 12 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Cairo_500Medium' }}>{t('back')}</Text>
        </Pressable>
      </View>
    );
  }

  let content:
    | LessonPlanOutput | WorksheetOutput | QuizOutput | ClassroomActivity | ActivityOutput
    | null = null;
  try { content = JSON.parse(item.content); } catch { /* noop */ }

  /**
   * The kind this material is rendered, exported and edited as.
   *
   * Normally just `item.type`. The exception is every activity saved before
   * the workspace could render one: those went in as `'lesson'` because the
   * honest type crashed the viewer. They are still in teachers' workspaces, so
   * the shape decides when the stored type says lesson — see materialShape.ts.
   */
  const kind = item.type === 'lesson' && looksLikeActivityContent(content)
    ? 'activity'
    : item.type;

  const accent = MATERIAL_COLOR[kind as keyof typeof MATERIAL_COLOR] ?? colors.primary;

  const editRoute =
    kind === 'lesson' ? '/ai-tools/lesson-plan'
      : kind === 'activity' ? '/ai-tools/activity'
        : kind === 'worksheet' ? '/ai-tools/worksheet'
          : kind === 'flow' ? '/ai-tools/lesson-flow'
            : kind === 'slides' ? '/ai-tools/slides'
              : kind === 'explainer' ? '/ai-tools/simplify'
                : '/ai-tools/quiz';

  const isAr = lang === 'ar';
  const getPlainText = () => {
    if (!content) return item.title;
    const meta = { subject: item.subject, grade: item.grade };
    if (kind === 'lesson') return formatLessonPlanText(content as LessonPlanOutput, item.title, meta, isAr);
    if (kind === 'activity') return formatActivityText(content as ActivityOutput, item.title, meta, isAr);
    if (kind === 'worksheet') return formatWorksheetText(content as WorksheetOutput, item.title, meta, isAr);
    if (kind === 'flow') return item.title; // flow exports as PDF only
    if (kind === 'slides') return formatDeckOutline(content as ClassroomActivity, isAr);
    if (kind === 'explainer') return formatSimplifiedExplanationText(content as unknown as SimplifiedExplanationOutput, item.title, meta, isAr);
    return formatQuizText(content as QuizOutput, item.title, meta, isAr);
  };
  /**
   * The book figures for this material's lesson, re-resolved from the saved
   * `topic` — the same grounding `useGeneratorExport` does on the generator
   * screens, so a paper printed from موادي carries the same «من الكتاب
   * المدرسي» appendix as the one printed the moment it was generated.
   *
   * It did not, before: these four builders were called without the argument,
   * so the figures were a property of *when* you exported rather than of the
   * material — and a quiz saved for next week's exam printed without the
   * diagrams its own questions refer to. Re-resolved rather than stored,
   * because a saved material predates the field and would have none.
   */
  const getExportFigures = () =>
    bookFigureRefsForLesson(resolveGeneratorGrounding(item.topic ?? '', lang).lesson?.id, isAr);

  const getHTML = () => {
    if (!content) return '<p></p>';
    const meta = { subject: item.subject, grade: item.grade };
    const figures = getExportFigures();
    if (kind === 'lesson') return buildLessonPlanHTML(content as LessonPlanOutput, item.title, meta, isAr, figures);
    if (kind === 'activity') return buildActivityHTML(content as ActivityOutput, item.title, meta, isAr, figures);
    if (kind === 'worksheet') return buildWorksheetHTML(content as WorksheetOutput, item.title, meta, isAr, figures);
    if (kind === 'flow') return buildLessonFlowHTML(content as unknown as LessonFlowOutput, isAr, figures);
    if (kind === 'slides') return buildDeckHTML(content as ClassroomActivity, isAr);
    if (kind === 'explainer') return buildSimplifiedExplanationHTML(content as unknown as SimplifiedExplanationOutput, item.title, meta, isAr, figures);
    return buildQuizHTML(content as QuizOutput, item.title, meta, isAr, figures);
  };

  const handleShareText = async () => { await shareAsText(getPlainText(), item.title); };
  const handleCopy = async () => { await copyToClipboard(getPlainText()); showToast(t('copiedToClipboard')); };
  const handlePDF = async () => {
    setLoadingPDF(true);
    try { await exportAsPDF(getHTML(), item.title.replace(/[^\w\s]/g, '').trim()); }
    catch { showToast(t('error')); } finally { setLoadingPDF(false); }
  };
  const handleWord = async () => {
    setLoadingWord(true);
    try { await exportAsWord(getPlainText(), item.title.replace(/[^\w\s]/g, '').trim(), isAr); }
    catch { showToast(t('error')); } finally { setLoadingWord(false); }
  };

  const exportLabels = {
    title: t('exportTitle'),
    shareLabel: t('exportShare'), shareSub: t('exportShareSub'),
    copyLabel: t('exportCopy'), copySub: t('exportCopySub'),
    pdfLabel: t('exportPDF'), pdfSub: t('exportPDFSub'),
    wordLabel: t('exportWord'), wordSub: t('exportWordSub'),
    cancel: t('cancel'),
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: accent, paddingTop: topPad + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {item.title}
        </Text>
        <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.metaPill, { color: 'rgba(255,255,255,0.9)', fontFamily: 'Almarai_400Regular' }]}>
            {item.subject}
          </Text>
          <Text style={[styles.metaPill, { color: 'rgba(255,255,255,0.9)', fontFamily: 'Almarai_400Regular' }]}>
            {item.grade}
          </Text>
        </View>
      </View>

      {/* Action bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={() => router.push({ pathname: editRoute as any, params: { savedId: item.id, ...item.formState } })}
          style={[styles.actionBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="create-outline" size={16} color={accent} />
          <Text style={[{ color: accent, fontFamily: 'Cairo_500Medium', fontSize: 13 }]}>{t('editItem')}</Text>
        </Pressable>
        <Pressable
          onPress={handleToggleFavorite}
          style={[styles.actionBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons
            name={favorited ? 'star' : 'star-outline'}
            size={16}
            color={favorited ? '#F59E0B' : colors.mutedForeground}
          />
          <Text style={[{ color: favorited ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13 }]}>
            {favorited ? t('inFavorites') : t('favoriteShort')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowExport(true)}
          style={[styles.actionBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="share-outline" size={16} color={colors.mutedForeground} />
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13 }]}>{t('exportBtn')}</Text>
        </Pressable>
        {/* A saved deck's whole point is being projected again — the workspace
            is where a teacher returns to it the morning of the lesson. */}
        {kind === 'slides' && content && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPendingClassroomActivity(content as ClassroomActivity);
              router.push('/ai-tools/classroom/presentation' as any);
            }}
            style={[styles.actionBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="tv-outline" size={16} color="#0EA5E9" />
            <Text style={[{ color: '#0EA5E9', fontFamily: 'Cairo_500Medium', fontSize: 13 }]}>
              {t('presentOnScreen')}
            </Text>
          </Pressable>
        )}
        {kind === 'flow' && content && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const flow = content as unknown as LessonFlowOutput;
              router.push({
                pathname: '/ai-tools/classroom' as any,
                params: { topic: flow.topic ?? item.topic },
              });
            }}
            style={[styles.actionBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="tv-outline" size={16} color="#4F46E5" />
            <Text style={[{ color: '#4F46E5', fontFamily: 'Cairo_500Medium', fontSize: 13 }]}>
              {lang === 'ar' ? 'الفصل' : 'Classroom'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      <View style={{ padding: 20 }}>
        {/* `{}` is truthy, so a material saved with empty content passed this
            guard and then died inside whichever view mapped over an array that
            was not there — a full-screen error boundary for one unreadable row.
            ponytail: only catches *empty* content. Content of the wrong shape
            for its type still crashes; validate per type if that ever happens
            from something other than a hand-written fixture. */}
        {!content || Object.keys(content).length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }}>
            {t('noContentAvailable')}
          </Text>
        ) : kind === 'lesson' ? (
          <LessonView plan={content as LessonPlanOutput} colors={colors} isRTL={isRTL} t={t} accent={accent} />
        ) : kind === 'activity' ? (
          <ActivityView activity={content as ActivityOutput} colors={colors} isRTL={isRTL} t={t} accent={accent} isAr={isAr} />
        ) : kind === 'worksheet' ? (
          <WorksheetView ws={content as WorksheetOutput} colors={colors} isRTL={isRTL} t={t} accent={accent} />
        ) : kind === 'flow' ? (
          <FlowView flow={content as unknown as LessonFlowOutput} colors={colors} isRTL={isRTL} lang={lang} accent={accent} />
        ) : kind === 'slides' ? (
          <SlidesDeckView deck={content as ClassroomActivity} colors={colors} isRTL={isRTL} isAr={isAr} accent={accent} />
        ) : kind === 'explainer' ? (
          <SimplifiedExplanationView explainer={content as unknown as SimplifiedExplanationOutput} colors={colors} isRTL={isRTL} t={t} accent={accent} />
        ) : (
          <QuizView quiz={content as QuizOutput} colors={colors} isRTL={isRTL} t={t} accent={accent} lang={lang} />
        )}

        {/* The same «من الكتاب المدرسي» figures the export appendix prints,
            shown before you export rather than only after. `getExportFigures`
            already resolved them above for the PDF; this screen was the one
            place that computed them and then showed the teacher nothing, so
            a saved worksheet looked like it had lost its diagrams until you
            exported it to find out otherwise.

            Only the four kinds whose exports carry the appendix. A `slides`
            deck already has the figures as its own slides, and
            so claiming them here would promise what the export does not
            deliver. */}
        {content && ['lesson', 'activity', 'worksheet', 'quiz', 'flow', 'explainer'].includes(kind) && (
          <BookFiguresPanel
            figures={getExportFigures()}
            isRTL={isRTL}
            colors={colors}
            labels={{ title: t('bookFiguresTitle'), note: t('bookFiguresNote') }}
          />
        )}
      </View>
    </ScrollView>

    <ExportMenu
      visible={showExport}
      onClose={() => setShowExport(false)}
      onShare={handleShareText}
      onCopy={handleCopy}
      onPDF={handlePDF}
      onWord={handleWord}
      isRTL={isRTL}
      loadingPDF={loadingPDF}
      loadingWord={loadingWord}
      labels={exportLabels}
    />
    <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

// ─── Lesson Plan renderer ─────────────────────────────────────────────────────

function LessonView({ plan, colors, isRTL, t, accent }: {
  plan: LessonPlanOutput; colors: any; isRTL: boolean; t: any; accent: string;
}) {
  const sections: Array<{ key: Exclude<keyof LessonPlanOutput, 'sources'>; titleKey: string; icon: string }> = [
    { key: 'objectives', titleKey: 'sectionObjectives', icon: 'flag-outline' },
    { key: 'materials', titleKey: 'sectionMaterials', icon: 'bag-outline' },
    { key: 'introduction', titleKey: 'sectionIntroduction', icon: 'play-outline' },
    { key: 'mainActivity', titleKey: 'sectionMainActivity', icon: 'people-outline' },
    { key: 'guidedPractice', titleKey: 'sectionGuidedPractice', icon: 'hand-left-outline' },
    { key: 'independentPractice', titleKey: 'sectionIndependentPractice', icon: 'person-outline' },
    { key: 'closure', titleKey: 'sectionClosure', icon: 'stop-circle-outline' },
    { key: 'assessment', titleKey: 'sectionAssessment', icon: 'checkmark-done-outline' },
    { key: 'differentiation', titleKey: 'sectionDifferentiation', icon: 'layers-outline' },
    { key: 'homework', titleKey: 'sectionHomework', icon: 'home-outline' },
  ];
  return (
    <>
      {sections.map(s => {
        const val = plan[s.key];
        if (!val) return null;
        return (
          <ContentSection key={s.key} title={t(s.titleKey)} icon={s.icon as any} isRTL={isRTL} accent={accent} colors={colors}>
            {Array.isArray(val)
              ? val.map((item: string, i: number) => (
                <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' }]}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginTop: 7, flexShrink: 0 }} />
                  <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{item}</Text>
                </View>
              ))
              : <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }]}>{val as string}</Text>
            }
          </ContentSection>
        );
      })}
    </>
  );
}

// ─── Activity renderer ────────────────────────────────────────────────────────

/**
 * A class activity as the teacher saved it.
 *
 * Deliberately the same sections, order and accent as the Activity screen's
 * own result view: a teacher who saved it there and opens it here should be
 * looking at the same document, not a workspace-flavoured summary of it. The
 * steps carry their own card because the numbering and the per-step minutes
 * are how the activity is actually run.
 */
function ActivityView({ activity, colors, isRTL, t, accent, isAr }: {
  activity: ActivityOutput; colors: any; isRTL: boolean; t: any; accent: string; isAr: boolean;
}) {
  return (
    <>
      <View
        style={[
          {
            backgroundColor: accent + '10',
            borderColor: accent + '30',
            borderWidth: 1,
            borderRadius: colors.radius,
            padding: 14,
            marginBottom: 16,
          },
        ]}
      >
        <Text style={[{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 11, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }]}>
          {isAr ? 'الهدف' : 'Objective'}
        </Text>
        <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }]}>
          {activity.objective}
        </Text>
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }]}>
          {[activity.groupSize, `${activity.totalDuration} ${t('min')}`, activityTypeLabel(activity.activityType, t)]
            .filter(Boolean)
            .map(label => (
              <Text key={label} style={{ fontSize: 12, color: accent, fontFamily: 'Cairo_500Medium' }}>
                {label}
              </Text>
            ))}
        </View>
      </View>

      {activity.materials?.length > 0 && (
        <ContentSection title={t('sectionMaterials')} icon="bag-outline" isRTL={isRTL} accent={accent} colors={colors}>
          {activity.materials.map((m, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginTop: 7, flexShrink: 0 }} />
              <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{m}</Text>
            </View>
          ))}
        </ContentSection>
      )}

      {activity.steps?.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 8 }]}>
            <Ionicons name="list-outline" size={15} color={accent} />
            <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('sectionActivitySteps')}
            </Text>
          </View>
          {activity.steps.map((step: ActivityStep, i: number) => (
            <View
              key={step.stepNumber ?? i}
              style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 14, marginBottom: 8 }]}
            >
              <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 8 }]}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Cairo_700Bold' }}>{step.stepNumber ?? i + 1}</Text>
                </View>
                <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
                  {step.title}
                </Text>
                <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11 }]}>
                  {step.durationMin} {t('activityMin')}
                </Text>
              </View>
              <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }]}>
                {step.description}
              </Text>
            </View>
          ))}
        </View>
      )}

      {activity.teacherTips?.length > 0 && (
        <ContentSection title={t('sectionTeacherTips')} icon="bulb-outline" isRTL={isRTL} accent={accent} colors={colors}>
          {activity.teacherTips.map((tip, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginTop: 7, flexShrink: 0 }} />
              <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{tip}</Text>
            </View>
          ))}
        </ContentSection>
      )}

      {!!activity.differentiation && (
        <ContentSection title={t('sectionDifferentiation')} icon="layers-outline" isRTL={isRTL} accent={accent} colors={colors}>
          <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }]}>
            {activity.differentiation}
          </Text>
        </ContentSection>
      )}

      {!!activity.assessment && (
        <ContentSection title={t('sectionAssessment')} icon="checkmark-done-outline" isRTL={isRTL} accent={accent} colors={colors}>
          <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }]}>
            {activity.assessment}
          </Text>
        </ContentSection>
      )}
    </>
  );
}

// ─── Worksheet renderer ───────────────────────────────────────────────────────

function WorksheetView({ ws, colors, isRTL, t, accent }: {
  ws: WorksheetOutput; colors: any; isRTL: boolean; t: any; accent: string;
}) {
  return (
    <>
      <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginBottom: 16, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }]}>
        {ws.instructions}
      </Text>
      {ws.sections.map(sec => (
        <View key={sec.title} style={{ marginBottom: 20 }}>
          <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }]}>{sec.title}</Text>
          {sec.questions.map((q, i) => (
            <View key={i} style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 14, marginBottom: 8, flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }]}>
              <Text style={[{ color: accent, fontFamily: 'Cairo_600SemiBold', fontSize: 14, width: 20 }]}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }]}>{q.text}</Text>
                {q.options?.map(o => (
                  <View key={o} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 6 }]}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.border, flexShrink: 0 }} />
                    <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, flex: 1 }]}>{o}</Text>
                  </View>
                ))}
                <Text style={[{ color: accent, fontFamily: 'Cairo_500Medium', fontSize: 11, marginTop: 8, textAlign: isRTL ? 'right' : 'left' }]}>{q.points} {t('pts')}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
      {ws.answerKey.length > 0 && (
        <ContentSection title={t('answerKeyTitle')} icon="key-outline" isRTL={isRTL} accent={accent} colors={colors}>
          {ws.answerKey.map(item => (
            <View key={item.num} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' }]}>
              <Text style={{ color: accent, fontFamily: 'Cairo_600SemiBold', fontSize: 13, width: 22 }}>{item.num}.</Text>
              <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>{item.answer}</Text>
            </View>
          ))}
        </ContentSection>
      )}
    </>
  );
}

// ─── Quiz renderer ────────────────────────────────────────────────────────────

function QuizView({ quiz, colors, isRTL, t, accent, lang }: {
  quiz: QuizOutput; colors: any; isRTL: boolean; t: any; accent: string; lang: string;
}) {
  const TYPE_LABEL: Record<string, string> = {
    multiple_choice: t('typeMultipleChoice'),
    true_false: t('typeTrueFalse'),
    short_answer: t('typeShortAnswer'),
  };
  return (
    <>
      <View style={[{ backgroundColor: accent + '15', borderColor: accent + '40', borderWidth: 1, borderRadius: colors.radius, padding: 16, marginBottom: 16 }]}>
        <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 16, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }]}>{quiz.title}</Text>
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: accent + '18', borderRadius: 20 }}>
            <Ionicons name="time-outline" size={12} color={accent} />
            <Text style={{ color: accent, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>{quiz.duration} {t('min')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: accent + '18', borderRadius: 20 }}>
            <Ionicons name="star-outline" size={12} color={accent} />
            <Text style={{ color: accent, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>{quiz.totalPoints} {t('pts')}</Text>
          </View>
        </View>
      </View>
      {/* Normalised on read, not just on generation: quizzes saved before the
          renderer owned the lettering still carry the model's "أ)" in their
          stored option text, and this screen is where a teacher reviews them. */}
      {quiz.questions.map(normalizeQuestionOptions).map((q, i) => (
        <View key={q.id} style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 16, marginBottom: 12 }]}>
          <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 10 }]}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 12 }}>{i + 1}</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: accent + '18' }}>
              <Text style={{ color: accent, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>{TYPE_LABEL[q.type] ?? q.type}</Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11 }}>{q.points} {t('pts')}</Text>
          </View>
          <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }]}>{q.text}</Text>
          {q.options?.map((opt, oi) => (
            <View key={oi} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 6, backgroundColor: colors.muted, borderRadius: 8 }]}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, width: 20 }}>{optionLetter(oi, lang === 'ar')}.</Text>
              <Text style={[{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }]}>{opt}</Text>
            </View>
          ))}
          <View style={[{ padding: 10, marginTop: 4, backgroundColor: '#10B981' + '15', borderRadius: 8, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }]}>
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
            <Text style={[{ color: '#10B981', fontFamily: 'Cairo_500Medium', fontSize: 12, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{t('answer')}: {q.correctAnswer}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

// ─── Lesson Flow renderer ─────────────────────────────────────────────────────

const FLOW_TEAL = '#00A99D';
const FLOW_NAVY = '#081B3A';

/** Plain-text outline of a saved deck — what share/copy hands over. */
function formatDeckOutline(deck: ClassroomActivity, isAr: boolean): string {
  const lines = [
    deck.activityName,
    deck.lesson,
    '',
    ...deck.slides.map(s => `${s.slideNumber}. ${s.title}\n${s.content}`),
  ];
  if (deck.answerKey.length > 0) {
    lines.push('', isAr ? 'مفتاح الإجابات:' : 'Answer key:', ...deck.answerKey);
  }
  return lines.join('\n');
}

/** Print/PDF form of a saved deck: one slide per page, so it projects or prints
 *  the same way the presentation screen shows it. */
function buildDeckHTML(deck: ClassroomActivity, isAr: boolean): string {
  const e = (s: string) => (s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dir = isAr ? 'rtl' : 'ltr';
  const slides = deck.slides.map(s => `
    <section class="slide">
      <h2>${e(s.title)}</h2>
      ${s.content.split('\n').filter(Boolean).map(line => `<p>${e(line)}</p>`).join('')}
      ${s.answer ? `<p class="answer">${isAr ? 'الإجابة' : 'Answer'}: ${e(s.answer)}</p>` : ''}
    </section>`).join('');

  return `<!DOCTYPE html><html dir="${dir}" lang="${isAr ? 'ar' : 'en'}"><head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4 landscape; margin: 0; }
      body { margin: 0; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: ${dir}; }
      .slide { page-break-after: always; box-sizing: border-box; width: 100%; min-height: 96vh;
               padding: 48px 56px; border-bottom: 1px solid #e5e7eb; }
      h2 { font-size: 34px; color: #0EA5E9; margin: 0 0 24px; }
      p { font-size: 22px; line-height: 1.7; color: #111827; margin: 0 0 12px; }
      .answer { color: #16a34a; font-weight: 700; }
    </style></head><body>${slides}</body></html>`;
}

function SlidesDeckView({ deck, colors, isRTL, isAr, accent }: {
  deck: ClassroomActivity; colors: any; isRTL: boolean; isAr: boolean; accent: string;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
        {isAr ? arCountPhrase(deck.slides.length, 'شريحة', 'شريحتان', 'شرائح') : `${deck.slides.length} slides`}
      </Text>
      {deck.slides.map(s => (
        <View
          key={s.slideNumber}
          style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 14 }}
        >
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accent + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: accent, fontFamily: 'Cairo_700Bold', fontSize: 11 }}>{s.slideNumber}</Text>
            </View>
            <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
              {s.title}
            </Text>
            {s.durationSeconds > 0 && (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>{s.durationSeconds}s</Text>
            )}
          </View>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
            {s.content}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FlowView({ flow, colors, isRTL, lang, accent }: {
  flow: LessonFlowOutput; colors: any; isRTL: boolean; lang: string; accent: string;
}) {
  const sections: Array<{
    label: string; icon: keyof typeof Ionicons.glyphMap; color: string;
    render: () => React.ReactNode;
  }> = [
    {
      label: lang === 'ar' ? 'الأهداف التعليمية' : 'Learning Objectives',
      icon: 'flag-outline', color: FLOW_NAVY,
      render: () => (
        <View style={{ gap: 6 }}>
          {flow.objectives.map((obj, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: FLOW_NAVY, marginTop: 7, flexShrink: 0 }} />
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>{obj}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      label: lang === 'ar' ? 'النشاط التمهيدي' : 'Warm-up Activity',
      icon: 'flame-outline', color: '#E67E22',
      render: () => (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 13, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>{flow.warmup.title}</Text>
          {flow.warmup.steps.map((s, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.muted, borderRadius: 8, padding: 10 }]}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#E67E22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}>{s.title}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 2, lineHeight: 17, textAlign: isRTL ? 'right' : 'left' }}>{s.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    },
    {
      label: lang === 'ar' ? 'النشاط التفاعلي' : 'Interactive Activity',
      icon: 'flash-outline', color: '#4F46E5',
      render: () => (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 13, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>{flow.activity.title}</Text>
          {flow.activity.steps.map((s, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.muted, borderRadius: 8, padding: 10 }]}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}>{s.title}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 2, lineHeight: 17, textAlign: isRTL ? 'right' : 'left' }}>{s.description}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
    },
    {
      label: lang === 'ar' ? 'التدريب الموجّه' : 'Guided Practice',
      icon: 'pencil-outline', color: FLOW_TEAL,
      render: () => (
        <View style={{ backgroundColor: FLOW_TEAL + '10', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: FLOW_TEAL + '30' }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: isRTL ? 'right' : 'left' }}>{flow.guidedPractice}</Text>
        </View>
      ),
    },
    {
      label: lang === 'ar' ? 'ورقة العمل' : 'Student Worksheet',
      icon: 'document-text-outline', color: '#8B5CF6',
      render: () => (
        <View style={{ gap: 6 }}>
          {flow.worksheet.sections.flatMap(sec => sec.questions).slice(0, 5).map((q, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.muted, borderRadius: 8, padding: 10 }]}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>{q.text}</Text>
            </View>
          ))}
        </View>
      ),
    },
    {
      label: lang === 'ar' ? 'بطاقة الخروج' : 'Exit Ticket',
      icon: 'ticket-outline', color: '#F59E0B',
      render: () => (
        <View style={{ gap: 6 }}>
          {flow.exitTicket.questions.slice(0, 3).map((q, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.muted, borderRadius: 8, padding: 10 }]}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>{q.text}</Text>
            </View>
          ))}
        </View>
      ),
    },
  ];

  return (
    <>
      {/* Meta badge */}
      <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }]}>
        {[flow.grade, flow.subject, lang === 'ar' ? arCountPhrase(flow.duration, 'دقيقة', 'دقيقتان', 'دقائق') : `${flow.duration} min`].map(tag => (
          <View key={tag} style={{ backgroundColor: FLOW_TEAL + '15', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: FLOW_TEAL, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>{tag}</Text>
          </View>
        ))}
      </View>
      {sections.map(sec => (
        <ContentSection key={sec.label} title={sec.label} icon={sec.icon} isRTL={isRTL} accent={sec.color} colors={colors}>
          {sec.render()}
        </ContentSection>
      ))}
    </>
  );
}

// ─── Shared section wrapper ───────────────────────────────────────────────────

function ContentSection({ title, icon, isRTL, accent, colors, children }: {
  title: string; icon: keyof typeof Ionicons.glyphMap; isRTL: boolean;
  accent: string; colors: any; children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 8 }]}>
        <Ionicons name={icon} size={15} color={accent} />
        <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
      </View>
      <View style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, padding: 14 }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  headerTitle: { fontSize: 22, marginBottom: 6, lineHeight: 30 },
  metaRow: { gap: 10, flexWrap: 'wrap' },
  metaPill: { fontSize: 13, opacity: 0.9 },
  actionBar: { flexDirection: 'row', padding: 12, paddingHorizontal: 20, borderBottomWidth: 1, gap: 16 },
  actionBtn: { alignItems: 'center', gap: 6, paddingVertical: 4 },
});
