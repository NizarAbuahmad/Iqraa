/**
 * Prompt Slides — build a projectable deck from the teacher's own free-text
 * description, not a curriculum topic.
 *
 * Deliberately a separate screen from `slides.tsx`: that screen is a state
 * machine built entirely around grounding a topic to a curriculum lesson
 * (`resolveGeneratorGrounding`, `buildLessonDeck`, book-figure lookups) — none
 * of which applies here. There is no lesson to ground and no book to prefer
 * over the model; the prompt itself is the entire spec. See the plan this
 * shipped from for the full reasoning.
 *
 * Two generation modes, both producing the same `ClassroomActivity` shape
 * `presentation.tsx`/`exportPptx.ts`/`services/share.ts` already render:
 *  - Free: a deterministic, non-AI template (`buildPromptSlidesTemplate`) —
 *    instant, always available, cannot follow the prompt's specific content.
 *  - AI: one live model call (`POST /generate/prompt-slides`), which can also
 *    add a few AI-generated images.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { PillSelector } from '@/components/ui/PillSelector';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { MaterialClassField } from '@/components/ui/MaterialClassField';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { aiErrorMessageKey, isAbortError } from '@/services/ai/aiProvenance';
import type { ActivitySlide, ClassroomActivity, PromptSlidesRequest } from '@/services/ai/AIService';
import { isolateForeignRuns } from '@/services/mathRender';
import { rebuildAnswerKey, withoutSlide } from '@/services/lessonSlides';
import { getPickerGrades, getPickerSubjects, resolvePickerIndex } from '@/services/curriculumData';
import type { ClassroomSetup } from '@/services/classroomRouting';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { buildDeckSlidesHTML, exportAsPDF } from '@/services/share';
import { deleteItem, getAllItems, saveItem, updateItem } from '@/services/workspace';
import { findMatchingItem } from '@/services/savedMaterialMatch';
import { confirm } from '@/services/confirm';
import { timerSecondsForSlide } from '@/services/presentationUtils';

const ACCENT = '#7C3AED';
const MAX_SLIDE_COUNT = 20;

type Mode = 'free' | 'ai';

export default function PromptSlidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();

  // Reopening a saved item from موادي pushes here with its `formState`
  // spread as params (see workspace/view.tsx's `editRoute`) — the same keys
  // `toggleSave` below writes, so the form comes back exactly as it was left,
  // not reset to defaults the way a curriculum-grounded screen's topic would.
  const params = useLocalSearchParams<{
    prompt?: string; mode?: string; slideCountText?: string;
    classroomSetup?: string; gradeIdx?: string; subjectIdx?: string;
  }>();

  const [prompt, setPrompt] = useState(params.prompt ?? '');
  const [mode, setMode] = useState<Mode>(params.mode === 'free' ? 'free' : 'ai');
  const [gradeIdx, setGradeIdx] = useState(() => resolvePickerIndex(params.gradeIdx, grades.length));
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(params.subjectIdx, subjects.length));
  const [slideCountText, setSlideCountText] = useState(params.slideCountText ?? '');
  const [classroomSetup, setClassroomSetup] = useState<ClassroomSetup>(
    params.classroomSetup === 'board' ? 'board' : 'screen',
  );

  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');
  const [deck, setDeck] = useState<ClassroomActivity | null>(null);
  /** Which mode actually produced the deck on screen — not the form's current
   *  selection, which the teacher may change before regenerating. Shown next
   *  to the deck rather than via the shared `AiSourceBadge`: that badge reads
   *  a single global "last generation" record, and Free mode deliberately
   *  never writes one (see `RemoteAIService.generatePromptSlides`), so it
   *  would keep showing whatever an unrelated screen left behind. */
  const [deckMode, setDeckMode] = useState<Mode | null>(null);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const savedContentRef = useRef('');
  const lookedUpKeyRef = useRef<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  const forgetSaved = () => { setSavedId(null); savedContentRef.current = ''; };

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) { setError(t('promptRequired')); return; }
    setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setDeck(null);
    forgetSaved();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const slideCount = Math.max(0, Math.min(MAX_SLIDE_COUNT, Math.floor(Number(slideCountText) || 0)));
    const req: PromptSlidesRequest = {
      prompt: trimmed,
      grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
      subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
      language: isAr ? 'arabic' : 'english',
      slideCount: slideCount > 0 ? slideCount : undefined,
      classroomSetup,
      mode,
    };
    try {
      const out = await aiService.generatePromptSlides(req, { signal: controller.signal });
      setDeck(out);
      setDeckMode(mode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      if (isAbortError(e)) setCancelled(true);
      else setError(t(aiErrorMessageKey(e)));
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const cancelGenerate = () => { abortRef.current?.abort(); };

  const present = () => {
    if (!deck) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingClassroomActivity(deck);
    router.push('/ai-tools/classroom/presentation' as any);
  };

  const deckIdentity = (built: ClassroomActivity) => ({
    type: 'prompt-slides' as const,
    title: built.activityName,
    subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
    grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
    // The model's own title, not the raw prompt — nothing downstream (e.g. a
    // curriculum lookup keyed on `topic`) should mistake this for a lesson name.
    topic: built.activityName,
    language: (isAr ? 'ar' : 'en') as 'ar' | 'en',
  });

  const toggleSave = async () => {
    if (!deck || savingBusy) return;
    setSavingBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (savedId) {
        await deleteItem(savedId);
        forgetSaved();
        showToast(t('slidesUnsaved'));
        return;
      }
      const content = JSON.stringify(deck);
      const item = await saveItem({
        ...deckIdentity(deck),
        content,
        formState: { prompt: prompt.trim(), mode, slideCountText, classroomSetup, gradeIdx, subjectIdx },
      });
      savedContentRef.current = content;
      setSavedId(item.id);
      showToast(t('slidesSaved'));
    } finally {
      setSavingBusy(false);
    }
  };

  useEffect(() => {
    if (!deck || savedId) return;
    const identity = deckIdentity(deck);
    const key = JSON.stringify(identity);
    if (lookedUpKeyRef.current === key) return;
    lookedUpKeyRef.current = key;
    let cancelledLookup = false;
    void (async () => {
      try {
        const existing = findMatchingItem(await getAllItems(), identity);
        if (cancelledLookup || !existing) return;
        savedContentRef.current = existing.content;
        setSavedId(existing.id);
      } catch {
        // Offline, or the workspace is unreachable — stays on "save".
      }
    })();
    return () => { cancelledLookup = true; };
  }, [deck, savedId]);

  useEffect(() => {
    if (!savedId || !deck) return;
    const content = JSON.stringify(deck);
    if (content === savedContentRef.current) return;
    savedContentRef.current = content;
    void updateItem(savedId, { title: deck.activityName, content }).catch(() => {});
  }, [deck, savedId]);

  const exportPdf = async () => {
    if (!deck) return;
    try {
      await exportAsPDF(buildDeckSlidesHTML(deck, isAr), `${deck.activityName || 'slides'}.pdf`);
    } catch {
      showToast(t('generationFailed'));
    }
  };

  const [exportingPptx, setExportingPptx] = useState(false);
  const exportPptx = async () => {
    if (!deck || exportingPptx) return;
    setExportingPptx(true);
    try {
      const { exportDeckAsPptx } = await import('@/services/exportPptx');
      await exportDeckAsPptx(deck, isAr, deck.activityName || 'slides');
    } catch {
      showToast(t('generationFailed'));
    } finally {
      setExportingPptx(false);
    }
  };

  const openEdit = (i: number) => {
    if (!deck) return;
    const s = deck.slides[i];
    setEditTitle(s.title);
    setEditContent(s.content);
    setEditAnswer(s.answer ?? '');
    setEditIdx(i);
  };

  const applyEdit = () => {
    if (editIdx === null || !deck) return;
    const editing = deck.slides[editIdx];
    const applyToSlide = (s: ActivitySlide): ActivitySlide => {
      const answer = editAnswer.trim();
      const next = { ...s, title: editTitle.trim() || s.title, content: editContent };
      if (s.type === 'question') {
        // Nothing to do — the answer for a question slide lives in
        // options/correctIndex, not `answer`, and this screen does not offer
        // editing those (see prompt-slides.tsx's own note on scope).
      } else if (s.answer !== undefined || answer) {
        if (answer) next.answer = answer; else delete next.answer;
      }
      return next;
    };
    setDeck(cur => {
      if (!cur) return cur;
      const slides = cur.slides.map(s => (s === editing ? applyToSlide(s) : s));
      return { ...cur, slides, answerKey: rebuildAnswerKey(slides, isAr) };
    });
    setEditIdx(null);
    showToast(t('slideUpdated'));
  };

  const removeSlide = async (i: number) => {
    if (!deck) return;
    const target = deck.slides[i];
    const ok = await confirm({
      title: t('deleteSlideTitle'),
      message: target.title,
      confirmLabel: t('deleteLabel'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setDeck(cur => {
      if (!cur) return cur;
      const slides = withoutSlide(cur.slides, target);
      return { ...cur, slides, answerKey: rebuildAnswerKey(slides, isAr) };
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#8B5CF6', '#6D28D9', '#3B1D8F']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.header, { paddingTop: topPad + 12 }]}
        >
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
                {t('promptSlidesTitle')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
                {t('promptSlidesSubtitle')}
              </Text>
            </View>
          </View>
          {/* What the tool can actually do, stated up front — the reference
              design puts counters here, but a deck count is not something this
              screen knows without a workspace query it does not otherwise need. */}
          <View style={[styles.heroPills, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {([
              ['albums-outline', t('promptSlidesPillSlides')],
              ['image-outline', t('promptSlidesPillImages')],
              ['download-outline', t('promptSlidesPillExport')],
            ] as const).map(([icon, label]) => (
              <View key={label} style={[styles.heroPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name={icon} size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroPillText}>{label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.form}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left', marginTop: 0 }]}>
            {t('promptSlidesFieldLabel')}
          </Text>
          <TextInput
            value={prompt}
            onChangeText={v => { setPrompt(v); setError(''); }}
            placeholder={t('promptSlidesPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.promptInput, {
              color: colors.foreground,
              borderColor: error && !prompt.trim() ? colors.destructive : colors.border,
              borderRadius: colors.radius,
              backgroundColor: colors.card,
              fontFamily: 'Almarai_400Regular',
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            }]}
          />
          {error && !prompt.trim() ? (
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}

          {/* Two cards rather than a pill row: this is the one choice on the
              screen that changes what the teacher gets (and whether it costs
              anything), so it carries its own explanation instead of a single
              hint line under a pill pair. */}
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('promptSlidesModeLabel')}
          </Text>
          <View style={{ gap: 10, marginBottom: 18 }}>
            {([
              ['ai', 'sparkles', t('promptSlidesModeAi'), t('promptSlidesModeAiHint')],
              ['free', 'document-text-outline', t('promptSlidesModeFree'), t('promptSlidesModeFreeHint')],
            ] as const).map(([value, icon, label, hint]) => {
              const on = mode === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => { setMode(value); Haptics.selectionAsync(); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.modeCard,
                    {
                      borderColor: on ? ACCENT : colors.border,
                      backgroundColor: on ? ACCENT + '0F' : colors.card,
                      borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.modeIcon, { backgroundColor: on ? ACCENT : colors.muted }]}>
                    <Ionicons name={icon} size={18} color={on ? '#fff' : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{
                      color: on ? ACCENT : colors.foreground,
                      fontFamily: 'Cairo_600SemiBold',
                      fontSize: 14,
                      textAlign: isRTL ? 'right' : 'left',
                    }}>
                      {label}
                    </Text>
                    <Text style={{
                      color: colors.mutedForeground,
                      fontFamily: 'Almarai_400Regular',
                      fontSize: 11,
                      lineHeight: 17,
                      textAlign: isRTL ? 'right' : 'left',
                    }}>
                      {hint}
                    </Text>
                  </View>
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={on ? ACCENT : colors.border}
                  />
                </Pressable>
              );
            })}
          </View>

          <PillSelector
            label={t('grade')}
            options={grades.map((g, i) => ({ value: i, label: isAr ? g.nameAr : g.name }))}
            value={gradeIdx}
            onChange={setGradeIdx}
            colors={colors}
            isRTL={isRTL}
            accent={ACCENT}
          />
          <PillSelector
            label={t('subjects')}
            options={subjects.map((s, i) => ({ value: i, label: isAr ? s.nameAr : s.name }))}
            value={subjectIdx}
            onChange={setSubjectIdx}
            colors={colors}
            isRTL={isRTL}
            accent={ACCENT}
          />
          <PillSelector
            label={isAr ? 'تجهيزات الصف' : 'Classroom setup'}
            options={[
              { value: 'screen' as ClassroomSetup, label: isAr ? 'شاشة عرض' : 'Projector' },
              { value: 'board' as ClassroomSetup, label: isAr ? 'سبورة فقط' : 'Board only' },
            ]}
            value={classroomSetup}
            onChange={setClassroomSetup}
            colors={colors}
            isRTL={isRTL}
            accent={ACCENT}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('promptSlidesSlideCountLabel')}
          </Text>
          <TextInput
            value={slideCountText}
            onChangeText={v => setSlideCountText(v.replace(/[^0-9]/g, '').slice(0, 2))}
            keyboardType="number-pad"
            placeholder={isAr ? 'تلقائي' : 'Auto'}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.slideCountInput, {
              color: colors.foreground, borderColor: colors.border, borderRadius: colors.radius,
              backgroundColor: colors.card, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left',
            }]}
          />

          <Button
            label={loading ? t('promptSlidesBuilding') : t('promptSlidesBuild')}
            onPress={generate}
            loading={loading}
            fullWidth
          />
        </View>

        <GenerationStatus
          phase={loading ? 'loading' : cancelled ? 'cancelled' : (error && prompt.trim()) ? 'error' : 'idle'}
          loadingLabel={t('promptSlidesBuilding')}
          errorDetail={error}
          onCancel={cancelGenerate}
          onRetry={generate}
          colors={colors}
          isRTL={isRTL}
          lang={lang as 'ar' | 'en'}
          accent={ACCENT}
          t={t}
        />

        {/* Nothing built yet. A labelled placeholder rather than blank space
            below the form, so the screen says what the next step produces. */}
        {!deck && !loading && !cancelled && !error && (
          <View style={[styles.emptyCard, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.emptyIcon, { backgroundColor: ACCENT }]}>
              <Ionicons name="sparkles" size={26} color="#fff" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}>
              {t('promptSlidesEmptyTitle')}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('promptSlidesEmptyHint')}
            </Text>
          </View>
        )}

        {deck && !loading && (
          <View style={{ marginHorizontal: 20 }}>
            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={[styles.previewTitle, { flex: 1, color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {deck.activityName}
                </Text>
                <View style={[styles.modeBadge, { backgroundColor: ACCENT + '15' }]}>
                  <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 11 }}>
                    {deckMode === 'free' ? t('promptSlidesModeFree') : t('promptSlidesModeAi')}
                  </Text>
                </View>
              </View>
              <Text style={[styles.previewMeta, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('slideCount', deck.slides.length)}
              </Text>

              <View style={{ marginTop: 12, gap: 6 }}>
                {deck.slides.map((s, i) => (
                  <View key={i} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); openEdit(i); }}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('editSlide')}: ${s.title}`}
                      style={({ pressed }) => [
                        { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <View style={[styles.slideNum, { backgroundColor: ACCENT + '18' }]}>
                        <Text style={{ color: ACCENT, fontFamily: 'Cairo_700Bold', fontSize: 11 }}>{i + 1}</Text>
                      </View>
                      <Text
                        style={{
                          flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13,
                          textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr',
                        }}
                        numberOfLines={1}
                      >
                        {isolateForeignRuns(s.title)}
                      </Text>
                      {timerSecondsForSlide(s) > 0 && (
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>
                          {timerSecondsForSlide(s)}s
                        </Text>
                      )}
                      <Ionicons name="create-outline" size={16} color={colors.mutedForeground} />
                    </Pressable>
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); void removeSlide(i); }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('deleteLabel')}: ${s.title}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                    </Pressable>
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

            <MaterialClassField materialId={savedId} onToast={showToast} />

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
              <Pressable
                onPress={toggleSave}
                disabled={savingBusy}
                accessibilityRole="button"
                accessibilityState={{ selected: !!savedId, disabled: savingBusy }}
                accessibilityLabel={savedId ? t('savedLabel') : t('save')}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: savedId ? ACCENT : 'transparent',
                    borderColor: ACCENT, borderRadius: colors.radius,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    opacity: pressed || savingBusy ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name={savedId ? 'bookmark' : 'bookmark-outline'} size={16} color={savedId ? '#fff' : ACCENT} />
                <Text style={{ color: savedId ? '#fff' : ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                  {savedId ? t('savedLabel') : t('save')}
                </Text>
              </Pressable>
              <Pressable
                onPress={exportPdf}
                style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Ionicons name="document-outline" size={16} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>PDF</Text>
              </Pressable>
              <Pressable
                onPress={exportPptx}
                disabled={exportingPptx}
                style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: exportingPptx ? 0.6 : 1 }]}
              >
                {exportingPptx
                  ? <ActivityIndicator size="small" color={colors.mutedForeground} />
                  : <Ionicons name="easel-outline" size={16} color={colors.mutedForeground} />}
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>PPTX</Text>
              </Pressable>
            </View>
          </View>
        )}

        {deck && !loading && <FeedbackWidget materialType="prompt-slides" toolId="prompt-slides" />}
      </ScrollView>

      <Modal visible={editIdx !== null} transparent animationType="fade" onRequestClose={() => setEditIdx(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('editSlide')}
            </Text>

            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('slideTitleField')}
              </Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                style={[styles.modalInput, {
                  color: colors.foreground, borderColor: colors.border, borderRadius: colors.radius,
                  fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left',
                }]}
              />

              <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('slideContentField')}
              </Text>
              <TextInput
                value={editContent}
                onChangeText={setEditContent}
                multiline
                style={[styles.modalInput, styles.modalInputMultiline, {
                  color: colors.foreground, borderColor: colors.border, borderRadius: colors.radius,
                  fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left',
                }]}
              />

              {editIdx !== null && deck?.slides[editIdx]?.type === 'challenge' && (
                <>
                  <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('slideAnswerField')}
                  </Text>
                  <TextInput
                    value={editAnswer}
                    onChangeText={setEditAnswer}
                    style={[styles.modalInput, {
                      color: colors.foreground, borderColor: colors.border, borderRadius: colors.radius,
                      fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left',
                    }]}
                  />
                </>
              )}
            </ScrollView>

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => setEditIdx(null)}
                style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={applyEdit}
                style={[styles.secondaryBtn, { borderColor: ACCENT, backgroundColor: ACCENT, borderRadius: colors.radius }]}
              >
                <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 22 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 4 },
  heroIcon: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroPills: { flexWrap: 'wrap', gap: 8, marginTop: 16 },
  heroPill: {
    alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroPillText: { color: 'rgba(255,255,255,0.9)', fontFamily: 'Cairo_500Medium', fontSize: 11 },
  modeCard: { alignItems: 'center', gap: 12, padding: 14, borderWidth: 1.5 },
  modeIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    marginHorizontal: 20, marginBottom: 12, paddingVertical: 34, paddingHorizontal: 20,
    borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', gap: 6,
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, textAlign: 'center' },
  emptyHint: { fontSize: 12, lineHeight: 19, textAlign: 'center' },
  form: { padding: 20 },
  promptInput: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 96, textAlignVertical: 'top', marginBottom: 8 },
  fieldLabel: { fontSize: 13, marginBottom: 6, marginTop: 4 },
  slideCountInput: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 16, width: 100 },
  previewCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 17 },
  previewMeta: { fontSize: 12 },
  modeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  slideNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ctaBtn: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginBottom: 10 },
  secondaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderWidth: 1.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 17, marginBottom: 12 },
  modalLabel: { fontSize: 12, marginBottom: 6, marginTop: 8 },
  modalInput: { borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalInputMultiline: { minHeight: 110, textAlignVertical: 'top' },
});
