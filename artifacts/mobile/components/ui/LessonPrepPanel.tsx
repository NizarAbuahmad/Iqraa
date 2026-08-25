/**
 * Lesson preparation, in place.
 *
 * The curriculum browser used to hand "حضّر خطة درس" to the AI Tools screen,
 * which is a blank generator form: it re-asked for the grade, the subject and
 * the topic the teacher had just walked through three screens to choose, threw
 * away the lesson's objectives and period length, and — because it was handed
 * the English title while the KB is searched in Arabic — came back saying the
 * plan was not grounded in the curriculum. Preparing a lesson you are already
 * looking at should not start with a form, and should not leave the lesson.
 *
 * So the panel prepares it here, from what the lesson already knows
 * (`services/lessonPrep.ts`), and keeps the teacher on the lesson page with the
 * objectives and the textbook context still above them. The pickers are not
 * gone, only demoted: everything the form offered — duration, teaching style,
 * adaptations — is behind "خيارات التحضير", and the full tool is one link away
 * for a topic that is not this lesson.
 *
 * The plan itself is rendered by `LessonPlanView`, the same component the tool
 * screen and chat use, so the three cannot drift.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import type { LessonPlanOutput } from '@/services/ai/AIService';
import {
  buildLessonPrepRequest,
  lessonPrepPickerIndices,
  resolveLessonPrepContext,
  type TeachingStyle,
} from '@/services/lessonPrep';
import { saveItem, updateItem } from '@/services/workspace';
import { useFavorite } from '@/hooks/useFavorite';
import {
  buildLessonPlanHTML,
  buildLessonPlanSlidesHTML,
  copyToClipboard,
  exportAsPDF,
  exportAsWord,
  formatLessonPlanText,
  shareAsText,
} from '@/services/share';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { Button } from '@/components/ui/Button';
import { ClassPickerSheet } from '@/components/ui/ClassPickerSheet';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { LessonPlanView } from '@/components/ui/LessonPlanView';
import { RelatedResourcesPanel } from '@/components/ui/RelatedResourcesPanel';
import { Toast } from '@/components/ui/Toast';

/** Same ladder the lesson-plan tool offers, so a saved plan can reopen there. */
const DURATION_VALUES = [30, 45, 60, 90];
const STYLE_IDS: TeachingStyle[] = ['direct', 'inquiry', 'collaborative'];

/** Nearest standard slot, for handing a curriculum duration to the tool form. */
function nearestDurationIdx(duration: number): number {
  let best = 0;
  for (let i = 1; i < DURATION_VALUES.length; i++) {
    if (Math.abs(DURATION_VALUES[i]! - duration) < Math.abs(DURATION_VALUES[best]! - duration)) {
      best = i;
    }
  }
  return best;
}

type Props = {
  lessonId: string;
  /** Subject colour of the lesson being prepared. */
  accent: string;
  /** Start generating as soon as the panel appears. */
  autoGenerate?: boolean;
};

export function LessonPrepPanel({ lessonId, accent, autoGenerate = true }: Props) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();

  const context = resolveLessonPrepContext(lessonId, lang as 'ar' | 'en');

  const [duration, setDuration] = useState<number>(context?.duration ?? 45);
  const [styleIdx, setStyleIdx] = useState(0);
  const [adaptations, setAdaptations] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LessonPlanOutput | null>(null);
  const [grounded, setGrounded] = useState<boolean | null>(null);
  const [groundedLesson, setGroundedLesson] = useState<string | null>(null);
  /** Fields the teacher changed — a plan that has been edited is not purely machine-written. */
  const [editedFields, setEditedFields] = useState<ReadonlySet<string>>(new Set());

  const [savedId, setSavedId] = useState<string | undefined>();
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showExport, setShowExport] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingWord, setLoadingWord] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, toggle: handleToggleFavorite } =
    useFavorite(savedId, key => showToast(t(key)), Haptics.ImpactFeedbackStyle.Light);
  // Holds the new material's id after a first save — that is what opens the
  // "which class?" sheet. Re-saving an edit does not re-ask.
  const [classPromptFor, setClassPromptFor] = useState<string | null>(null);

  const generate = async () => {
    const built = buildLessonPrepRequest({
      lessonId,
      lang: lang as 'ar' | 'en',
      duration,
      teachingStyle: STYLE_IDS[styleIdx],
      adaptations,
    });
    if (!built) { setError(t('generationFailed')); return; }

    setError('');
    setLoading(true);
    setResult(null);
    setGrounded(null);
    setGroundedLesson(null);
    setEditedFields(new Set());
    setSaveLabel(savedId ? 'updated' : 'save');
    try {
      const out = await aiService.generateLessonPlan(built.request);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGrounded(built.grounded);
      setGroundedLesson(built.groundedLessonTitle);
      setResult(out);
    } catch {
      setError(t('generationFailed'));
    } finally {
      setLoading(false);
    }
  };

  // One automatic run when the teacher opens the panel. Regenerating after that
  // is deliberate — changing an option does not silently spend another call.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoGenerate || autoRan.current || !context) return;
    autoRan.current = true;
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  if (!context) return null;

  const applyEdit = <K extends keyof LessonPlanOutput>(field: K, value: LessonPlanOutput[K]) => {
    setResult(prev => (prev ? { ...prev, [field]: value } : prev));
    setEditedFields(prev => new Set(prev).add(field as string));
    setSaveLabel(savedId ? 'updated' : 'save');
  };

  const exportTitle = lang === 'ar' ? `خطة درس: ${context.topic}` : `Lesson Plan: ${context.topic}`;
  const exportMeta = { subject: context.subjectLabel, grade: context.gradeName, duration };

  const handleSave = async () => {
    if (!result) return;
    const formState = {
      ...lessonPrepPickerIndices(context),
      topic: context.topic,
      durationIdx: nearestDurationIdx(duration),
      duration,
      styleIdx,
      objectives: context.objectives,
      adaptations,
      lessonId,
    };
    const payload = {
      title: exportTitle,
      subject: context.subjectName,
      grade: context.gradeName,
      topic: context.topic,
      language: lang as 'ar' | 'en',
      content: JSON.stringify(result),
      formState,
    };
    if (savedId) {
      await updateItem(savedId, payload);
      setSaveLabel('updated');
    } else {
      const saved = await saveItem({ type: 'lesson', ...payload });
      setSavedId(saved.id);
      setSaveLabel('saved');
      setClassPromptFor(saved.id);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleShareText = async () => {
    if (!result) return;
    await shareAsText(
      formatLessonPlanText(result, exportTitle, exportMeta, lang === 'ar'),
      exportTitle,
    );
  };

  const handleCopy = async () => {
    if (!result) return;
    await copyToClipboard(formatLessonPlanText(result, exportTitle, exportMeta, lang === 'ar'));
    showToast(t('copiedToClipboard'));
  };

  const handlePDF = async () => {
    if (!result) return;
    setLoadingPDF(true);
    try {
      await exportAsPDF(
        buildLessonPlanHTML(result, exportTitle, exportMeta, lang === 'ar'),
        exportTitle.replace(/[^\w\s]/g, '').trim(),
      );
    } catch {
      showToast(t('generationFailed'));
    } finally {
      setLoadingPDF(false);
    }
  };

  const handleWord = async () => {
    if (!result) return;
    setLoadingWord(true);
    try {
      await exportAsWord(
        formatLessonPlanText(result, exportTitle, exportMeta, lang === 'ar'),
        exportTitle.replace(/[^\w\s]/g, '').trim(),
        lang === 'ar',
      );
    } catch {
      showToast(t('generationFailed'));
    } finally {
      setLoadingWord(false);
    }
  };

  const handleSlides = async () => {
    if (!result) return;
    setLoadingSlides(true);
    try {
      await exportAsPDF(
        buildLessonPlanSlidesHTML(result, exportTitle, exportMeta, lang === 'ar'),
        (exportTitle + '-slides').replace(/[^\w\s-]/g, '').trim(),
      );
    } catch {
      showToast(t('generationFailed'));
    } finally {
      setLoadingSlides(false);
    }
  };

  const openFullTool = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { gradeIdx, subjectIdx } = lessonPrepPickerIndices(context);
    router.push({
      pathname: '/ai-tools/lesson-plan',
      params: {
        topic: context.topic,
        gradeIdx: String(gradeIdx),
        subjectIdx: String(subjectIdx),
        durationIdx: String(nearestDurationIdx(duration)),
        styleIdx: String(styleIdx),
        objectives: context.objectives,
        adaptations,
      },
    });
  };

  const saveBtnLabel =
    saveLabel === 'saved' ? t('savedSuccess')
      : saveLabel === 'updated' ? t('updatedSuccess')
        : savedId ? t('updateInWorkspace')
          : t('saveToWorkspace');

  const durationChoices = DURATION_VALUES.includes(context.duration)
    ? DURATION_VALUES
    : [...DURATION_VALUES, context.duration].sort((a, b) => a - b);
  const styleLabels = [t('teachingStyleDirect'), t('teachingStyleInquiry'), t('teachingStyleCollaborative')];
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: accent + '35', borderRadius: 14 }]}>
      {/* Header — what is being prepared, and from what */}
      <View style={[styles.head, { flexDirection: rowDir }]}>
        <View style={[styles.headIcon, { backgroundColor: accent + '18' }]}>
          <Ionicons name="sparkles" size={16} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
            {t('prepInlineTitle')}
          </Text>
          <Text style={[styles.headMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {`${context.subjectLabel} · ${context.gradeName} · ${duration} ${t('min')}`}
          </Text>
        </View>
      </View>
      {/* Its own row: sharing the header line squeezed the meta into a wrap. */}
      <View style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginTop: 8 }}>
        <AiSourceBadge isRTL={isRTL} />
      </View>

      {/* Options — everything the old form asked for, none of it in the way */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setShowOptions(o => !o); }}
        style={[styles.optionsToggle, { flexDirection: rowDir, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
      >
        <Ionicons name={showOptions ? 'chevron-up' : 'options-outline'} size={15} color={colors.mutedForeground} />
        <Text style={[styles.optionsToggleText, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>
          {t('prepInlineOptions')}
        </Text>
      </Pressable>

      {showOptions && (
        <View style={styles.options}>
          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
            {t('durationLabel')}
          </Text>
          <View style={[styles.chips, { flexDirection: rowDir }]}>
            {durationChoices.map(d => (
              <Chip
                key={d}
                label={`${d} ${t('min')}`}
                selected={d === duration}
                accent={accent}
                colors={colors}
                onPress={() => setDuration(d)}
              />
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
            {t('teachingStyleLabel')}
          </Text>
          <View style={[styles.chips, { flexDirection: rowDir }]}>
            {styleLabels.map((label, i) => (
              <Chip
                key={label}
                label={label}
                selected={i === styleIdx}
                accent={accent}
                colors={colors}
                onPress={() => setStyleIdx(i)}
              />
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
            {t('adaptationsLabel')}
          </Text>
          <View style={[styles.inputBox, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
              placeholder={t('adaptationsPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              value={adaptations}
              onChangeText={setAdaptations}
              multiline
            />
          </View>
        </View>
      )}

      {/* Generate — only shown before the first plan; afterwards it is Regenerate below */}
      {!result && !loading && (
        <View style={{ marginTop: 12 }}>
          <Button label={t('generateLessonPlanBtn')} onPress={generate} fullWidth />
        </View>
      )}

      {loading && (
        <View style={[styles.loadingBox, { backgroundColor: colors.muted, borderRadius: colors.radius, flexDirection: rowDir }]}>
          <ActivityIndicator color={accent} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('craftingLessonPlan')}
          </Text>
        </View>
      )}

      {error ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {error}
        </Text>
      ) : null}

      {/* What the plan is anchored to — stated both ways, never assumed */}
      {result && grounded !== null && (
        <View style={{ marginTop: 12 }}>
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
      )}

      {result && (
        <>
          <View style={[styles.readyRow, { backgroundColor: accent + '15', borderColor: accent + '30', borderRadius: colors.radius, flexDirection: rowDir }]}>
            <Ionicons name="checkmark-circle" size={18} color={accent} />
            <Text style={[styles.readyText, { color: accent, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('lessonPlanReady')}
            </Text>
          </View>

          <LessonPlanView
            plan={result}
            colors={colors}
            isRTL={isRTL}
            t={t}
            accent={accent}
            onEdit={applyEdit}
            editedFields={editedFields}
          />
        </>
      )}

      {result && !loading && (
        <>
          <FeedbackWidget materialType="lesson" toolId="lesson-plan" />
          <RelatedResourcesPanel toolId="lesson-plan" topic={context.topic} isRTL={isRTL} />

          <View style={{ gap: 10, marginTop: 4 }}>
            <ActionButton
              icon={(saveLabel === 'saved' || saveLabel === 'updated') ? 'checkmark-circle' : 'bookmark-outline'}
              label={saveBtnLabel}
              onPress={handleSave}
              accent={accent}
              filled={saveLabel === 'saved' || saveLabel === 'updated'}
              colors={colors}
              isRTL={isRTL}
            />
            {!!savedId && (
              <ActionButton
                icon={favorited ? 'star' : 'star-outline'}
                label={favorited ? t('inFavorites') : t('addToFavorites')}
                onPress={handleToggleFavorite}
                accent={favorited ? '#F59E0B' : colors.mutedForeground}
                colors={colors}
                isRTL={isRTL}
              />
            )}
            <ActionButton
              icon="share-outline"
              label={t('exportBtn')}
              onPress={() => setShowExport(true)}
              accent={colors.mutedForeground}
              colors={colors}
              isRTL={isRTL}
            />
            <ActionButton
              icon="refresh-outline"
              label={t('regenerateBtn')}
              onPress={generate}
              accent={accent}
              colors={colors}
              isRTL={isRTL}
            />
          </View>
        </>
      )}

      {/* The full generator, for a topic that is not this lesson */}
      <Pressable onPress={openFullTool} style={[styles.fullToolLink, { flexDirection: rowDir }]}>
        <Ionicons name="open-outline" size={14} color={accent} />
        <Text style={[styles.fullToolText, { color: accent, fontFamily: 'Cairo_500Medium' }]}>
          {t('prepInlineOpenFullTool')}
        </Text>
      </Pressable>

      <ExportMenu
        visible={showExport}
        onClose={() => setShowExport(false)}
        onShare={handleShareText}
        onCopy={handleCopy}
        onPDF={handlePDF}
        onWord={handleWord}
        onSlides={handleSlides}
        isRTL={isRTL}
        loadingPDF={loadingPDF}
        loadingWord={loadingWord}
        loadingSlides={loadingSlides}
        labels={{
          title: t('exportTitle'),
          shareLabel: t('exportShare'), shareSub: t('exportShareSub'),
          copyLabel: t('exportCopy'), copySub: t('exportCopySub'),
          pdfLabel: t('exportPDF'), pdfSub: t('exportPDFSub'),
          wordLabel: t('exportWord'), wordSub: t('exportWordSub'),
          slidesLabel: t('exportSlides'), slidesSub: t('exportSlidesSub'),
          cancel: t('cancel'),
        }}
      />
      <ClassPickerSheet
        visible={classPromptFor !== null}
        onClose={() => setClassPromptFor(null)}
        onPick={(classId, className) => {
          const materialId = classPromptFor;
          setClassPromptFor(null);
          if (!materialId) return;
          void updateItem(materialId, { classGroupId: classId })
            .then(ok => showToast(ok ? t('savedToClass', className) : t('saveToClassFailed')));
        }}
      />
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

function Chip({ label, selected, accent, colors, onPress }: {
  label: string; selected: boolean; accent: string;
  colors: ReturnType<typeof useColors>; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? accent + '18' : colors.background,
          borderColor: selected ? accent : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, {
        color: selected ? accent : colors.mutedForeground,
        fontFamily: selected ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
      }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({ icon, label, onPress, accent, filled, colors, isRTL }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
  accent: string; filled?: boolean; colors: ReturnType<typeof useColors>; isRTL: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: filled ? accent : 'transparent',
          borderColor: accent,
          borderRadius: colors.radius,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={filled ? '#fff' : accent} />
      <Text style={[styles.actionBtnText, { color: filled ? '#fff' : accent, fontFamily: 'Cairo_600SemiBold' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1.5, padding: 16, marginBottom: 24 },
  head: { alignItems: 'center', gap: 10 },
  headIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 15 },
  headMeta: { fontSize: 12, marginTop: 2 },
  optionsToggle: { alignItems: 'center', gap: 6, marginTop: 12 },
  optionsToggleText: { fontSize: 12 },
  options: { marginTop: 10, gap: 4 },
  fieldLabel: { fontSize: 12, marginBottom: 6, marginTop: 6 },
  chips: { flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 12 },
  inputBox: { borderWidth: 1.5, padding: 12, marginTop: 2 },
  textInput: { fontSize: 14, padding: 0, minHeight: 48 },
  loadingBox: { alignItems: 'center', gap: 12, padding: 16, marginTop: 12 },
  loadingText: { fontSize: 13 },
  error: { fontSize: 13, marginTop: 10 },
  readyRow: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 12, marginBottom: 4 },
  readyText: { fontSize: 13 },
  actionBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderWidth: 1.5 },
  actionBtnText: { fontSize: 13 },
  fullToolLink: { alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 14, padding: 4 },
  fullToolText: { fontSize: 12 },
});
