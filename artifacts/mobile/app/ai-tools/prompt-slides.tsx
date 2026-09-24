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
 * The flow is: ask, build, illustrate.
 *  1. One round of tap-to-answer questions, when the server judges the
 *     description left something worth asking. Always skippable.
 *  2. One live model call (`POST /generate/prompt-slides`) for the deck text.
 *  3. The media passes the older Slides Maker has always run — Unsplash photos,
 *     a YouTube explainer, and graphs/charts drawn from the deck's own content
 *     (`services/promptSlidesMedia.ts`). Never blocking, always optional.
 *
 * Grade and subject are NOT asked for: they come from the teacher's profile and
 * reach the model as a hint the description can override.
 *
 * There is no offline mode. The template that used to stand in produced a page
 * of "edit this text" placeholders, which teachers read as a broken feature, so
 * a failed generation now shows an error instead of fabricating a deck.
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
import { useAuth } from '@/context/AuthContext';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { MaterialClassField } from '@/components/ui/MaterialClassField';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { aiErrorMessageKey, isAbortError } from '@/services/ai/aiProvenance';
import type {
  ActivitySlide, ClassroomActivity, PromptSlidesQuestion, PromptSlidesRequest,
} from '@/services/ai/AIService';
import { isolateForeignRuns } from '@/services/mathRender';
import { rebuildAnswerKey, withoutSlide } from '@/services/lessonSlides';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { narrowToSelection } from '@/services/teacherCatalogFilter';
import { MAX_SOURCE_CHARS, foldAnswersIntoPrompt, foldSourceIntoPrompt } from '@/services/promptSlidesAnswers';
import { attachDrawnVisuals, attachSearchedMedia, deckSearchQueries } from '@/services/promptSlidesMedia';
import { polishDeck } from '@/services/promptSlidesPolish';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { buildDeckSlidesHTML, exportAsPDF } from '@/services/share';
import { deleteItem, getAllItems, saveItem, updateItem } from '@/services/workspace';
import { findMatchingItem } from '@/services/savedMaterialMatch';
import { confirm } from '@/services/confirm';
import { timerSecondsForSlide } from '@/services/presentationUtils';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
const MAX_SLIDE_COUNT = 20;

export default function PromptSlidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  const { user } = useAuth();

  // Grade and subject used to be two pill rows on this screen, which is exactly
  // the tapping-through a "just describe it" tool exists to avoid. They come
  // from the teacher's own profile now — the same `narrowToSelection` the
  // curriculum browser uses, with its fall-back-to-everything behaviour — and
  // they reach the model as a HINT. A description naming another grade wins.
  const teacherGrade = narrowToSelection(getPickerGrades(), user?.gradeIds)[0];
  const teacherSubject = narrowToSelection(getPickerSubjects(), user?.subjectIds)[0];
  const gradeLabel = teacherGrade ? (isAr ? teacherGrade.nameAr : teacherGrade.name) : '';
  const subjectLabel = teacherSubject ? (isAr ? teacherSubject.nameAr : teacherSubject.name) : '';

  // Reopening a saved item from موادي pushes here with its `formState`
  // spread as params (see workspace/view.tsx's `editRoute`) — the same keys
  // `toggleSave` below writes, so the form comes back exactly as it was left.
  const params = useLocalSearchParams<{ prompt?: string; slideCountText?: string; source?: string }>();

  const [prompt, setPrompt] = useState(params.prompt ?? '');
  const [slideCountText, setSlideCountText] = useState(params.slideCountText ?? '');
  // The passage the teacher pasted for the deck to be built out of. Kept out
  // of the way until asked for — most decks are built from a description
  // alone, and this screen's whole pitch is that it asks for almost nothing.
  const [source, setSource] = useState(params.source ?? '');
  const [sourceOpen, setSourceOpen] = useState(!!params.source);

  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');
  const [deck, setDeck] = useState<ClassroomActivity | null>(null);

  /**
   * The one clarifying round. `asking` holds the questions the server sent
   * back; `answers` is question id → the option label the teacher tapped.
   * Both clear the moment generation starts, so a second Build never shows a
   * stale question from the previous prompt.
   */
  const [asking, setAsking] = useState<PromptSlidesQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [askingBusy, setAskingBusy] = useState(false);

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

  /**
   * Build pressed. Ask first, unless there is nothing worth asking.
   *
   * The questions call is allowed to fail, time out or come back empty — every
   * one of those goes straight to generating. A teacher waiting on slides must
   * never be blocked by an optional question.
   */
  const onBuild = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) { setError(t('promptRequired')); return; }
    if (asking.length > 0) { void generate(); return; }

    setError(''); setCancelled(false);
    setAskingBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const questions = await aiService.fetchPromptSlidesQuestions({
        // The source itself is deliberately not sent — this is the cheap nano
        // call, and 6000 characters of it would cost more than the answers are
        // worth. Its existence is, so the model stops asking what the deck
        // should be based on when the teacher has already said.
        prompt: source.trim()
          ? `${trimmed}\n\n${isAr ? '(ألصق المعلّم نصًا مصدريًا سيُبنى العرض منه.)' : '(The teacher has pasted a source text for the deck to be built from.)'}`
          : trimmed,
        grade: gradeLabel || undefined,
        subject: subjectLabel || undefined,
        language: isAr ? 'arabic' : 'english',
      });
      if (questions.length > 0) {
        setAsking(questions);
        setAnswers({});
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
        return;
      }
    } catch {
      // Questions are an enhancement; a failure here is not the teacher's
      // problem and must not surface as an error on the way to a deck.
    } finally {
      setAskingBusy(false);
    }
    void generate();
  };

  const generate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) { setError(t('promptRequired')); return; }

    // Whatever the teacher tapped rides along inside the description itself,
    // so the server contract and the pooling exclusion stay untouched.
    const answered = asking
      .map(q => ({ question: q.question, answer: answers[q.id] ?? '' }))
      .filter(a => a.answer);
    // The pasted source rides along the same way, and last: the description
    // and the teacher's answers say what to build, and the source is the
    // material to build it out of.
    const fullPrompt = foldSourceIntoPrompt(
      foldAnswersIntoPrompt(trimmed, answered, isAr), source, isAr,
    );

    setError(''); setCancelled(false);
    setAsking([]); setAnswers({});
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setDeck(null);
    forgetSaved();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const slideCount = Math.max(0, Math.min(MAX_SLIDE_COUNT, Math.floor(Number(slideCountText) || 0)));
    const req: PromptSlidesRequest = {
      prompt: fullPrompt,
      grade: gradeLabel,
      subject: subjectLabel,
      language: isAr ? 'arabic' : 'english',
      slideCount: slideCount > 0 ? slideCount : undefined,
      classroomSetup: 'screen',
    };
    try {
      const out = await aiService.generatePromptSlides(req, { signal: controller.signal });
      // Both of these cost nothing and need no network, so they land with the
      // deck rather than after it. Polish runs first: it drops the slides that
      // say nothing, and a dropped slide should not have had a graph inserted
      // after it.
      const built = attachDrawnVisuals(polishDeck(out), isAr);
      setDeck(built);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);

      // Photos and video arrive afterwards, exactly as the older Slides Maker
      // does it: never blocking the deck, and dropped entirely if the teacher
      // has regenerated in the meantime — the identity check is on the first
      // slide object, which a regeneration replaces.
      void (async () => {
        try {
          const { searchDeckPhoto } = await import('@/services/unsplashImage');
          const { searchDeckVideos } = await import('@/services/youtubeVideo');
          const { deckPhotoQueries } = await import('@/services/classMedia');
          const enriched = await attachSearchedMedia(built, {
            isAr,
            topic: trimmed,
            // The deck's own topic first, and the teacher's subject only as a
            // fallback. `deckPhotoQueries()` keys off the curriculum subject,
            // which in the older Slides Maker IS the deck's topic and here is
            // merely the teacher's profile — so a Mother's Day deck built by a
            // maths teacher searched for "mathematics equations chalkboard"
            // and got a picture with nothing to do with it.
            //
            // English either way: Unsplash is an English index and an Arabic
            // query returns nothing at all.
            photoQueries: deckSearchQueries(
              built,
              deckPhotoQueries(teacherSubject?.id ?? '', teacherSubject?.name ?? 'school'),
            ),
            searchPhoto: searchDeckPhoto,
            searchVideos: searchDeckVideos,
          });
          setDeck(cur => (cur && cur.slides[0] === built.slides[0] ? enriched : cur));
        } catch {
          // A deck without photos is still a deck.
        }
      })();
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
    subject: subjectLabel,
    grade: gradeLabel,
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
        formState: { prompt: prompt.trim(), slideCountText, source: source.trim() },
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
    } catch (e) {
      // Logged, not just toasted. A bare `catch {}` here meant a teacher
      // reporting "the export doesn't work" gave us nothing to act on and
      // nothing to reproduce from — the failure was thrown away at the one
      // point where it was still legible.
      console.error('[prompt-slides] PDF export failed', e);
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
    } catch (e) {
      console.error('[prompt-slides] PPTX export failed', e);
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
          colors={['#6D28D9', '#6D28D9', '#3B1D8F']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.header, { paddingTop: topPad + 12 }]}
        >
          <Pressable onPress={() => goBack()} hitSlop={10} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
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
              <Text style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
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
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}

          {/* The source passage — the one lever that improves what a slide
              SAYS without a bigger model, since summarising text in front of
              it is what a small model is actually good at. Collapsed by
              default: a teacher who has nothing to paste should not see a
              6000-character box asking them to. */}
          <Pressable
            onPress={() => { setSourceOpen(o => !o); Haptics.selectionAsync(); }}
            style={[styles.sourceToggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons
              name={sourceOpen ? 'chevron-down' : (isRTL ? 'chevron-back' : 'chevron-forward')}
              size={16}
              color={colors.primary}
            />
            <Text style={{ color: colors.primary, fontFamily: 'Cairo_500Medium', fontSize: 14 }}>
              {t('promptSlidesSourceToggle')}
            </Text>
            {!sourceOpen && source.trim() ? (
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            ) : null}
          </Pressable>

          {sourceOpen && (
            <>
              <TextInput
                value={source}
                onChangeText={v => setSource(v.slice(0, MAX_SOURCE_CHARS))}
                placeholder={t('promptSlidesSourcePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[styles.sourceInput, {
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  backgroundColor: colors.card,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                }]}
              />
              <Text style={[styles.sourceHint, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                {source.trim()
                  ? t('promptSlidesSourceCount', source.length, MAX_SOURCE_CHARS)
                  : t('promptSlidesSourceHint')}
              </Text>
            </>
          )}

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

          {/* The one clarifying round. Shown only when the server decided the
              description left something worth asking — and always skippable,
              because the teacher came here for slides, not a form. */}
          {asking.length > 0 && (
            <View style={{ gap: 12, marginBottom: 18 }}>
              {asking.map(q => (
                <View
                  key={q.id}
                  style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                >
                  <Text style={{
                    color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13,
                    textAlign: isRTL ? 'right' : 'left', marginBottom: 10,
                  }}>
                    {q.question}
                  </Text>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                    {q.options.map(opt => {
                      const on = answers[q.id] === opt.label;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setAnswers(cur => ({ ...cur, [q.id]: opt.label }));
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          style={[styles.answerChip, {
                            borderColor: on ? ACCENT : colors.border,
                            backgroundColor: on ? ACCENT : 'transparent',
                            borderRadius: 999,
                          }]}
                        >
                          <Text style={{
                            color: on ? palette.primaryForeground : colors.mutedForeground,
                            fontFamily: 'Cairo_500Medium', fontSize: 12,
                          }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Button
            label={
              askingBusy ? t('promptSlidesAsking')
                : loading ? t('promptSlidesBuilding')
                  : asking.length > 0 ? t('promptSlidesBuildWithAnswers')
                    : t('promptSlidesBuild')
            }
            onPress={onBuild}
            loading={loading || askingBusy}
            fullWidth
          />

          {asking.length > 0 && !loading && (
            <Pressable onPress={() => { setAnswers({}); void generate(); }} style={styles.skipBtn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                {t('promptSlidesSkipQuestions')}
              </Text>
            </Pressable>
          )}
        </View>

        <GenerationStatus
          phase={loading ? 'loading' : cancelled ? 'cancelled' : (error && prompt.trim()) ? 'error' : 'idle'}
          loadingLabel={t('promptSlidesBuilding')}
          errorDetail={error}
          onCancel={cancelGenerate}
          onRetry={onBuild}
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
            <View style={[styles.emptyIcon, { backgroundColor: ACCENT_FILL }]}>
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
                          flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21,
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
              style={({ pressed }) => [styles.ctaBtn, { backgroundColor: ACCENT_FILL, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.88 : 1 }]}
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
                <Ionicons name={savedId ? 'bookmark' : 'bookmark-outline'} size={16} color={savedId ? palette.primaryForeground : ACCENT} />
                <Text style={{ color: savedId ? palette.primaryForeground : ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
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
                style={[styles.secondaryBtn, { borderColor: ACCENT, backgroundColor: ACCENT_FILL, borderRadius: colors.radius }]}
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
  questionCard: { padding: 14, borderWidth: 1 },
  answerChip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5 },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
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
  sourceToggle: { alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 2 },
  sourceInput: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 120, textAlignVertical: 'top', marginBottom: 6 },
  sourceHint: { fontSize: 12, marginBottom: 12, lineHeight: 18, fontFamily: 'Almarai_400Regular' },
  slideCountInput: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 16, width: 100 },
  previewCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 17 },
  previewMeta: { fontSize: 12 },
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
