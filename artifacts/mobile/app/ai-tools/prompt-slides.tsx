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
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { contentLang } from '@/services/contentLanguage';
import { useAuth } from '@/context/AuthContext';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { aiErrorMessageKey, isAbortError } from '@/services/ai/aiProvenance';
import type { ClassroomActivity, PromptSlidesQuestion, PromptSlidesRequest } from '@/services/ai/AIService';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { narrowToSelection } from '@/services/teacherCatalogFilter';
import { MAX_SOURCE_CHARS, foldAnswersIntoPrompt, foldSourceIntoPrompt } from '@/services/promptSlidesAnswers';
import { attachDrawnVisuals, attachSearchedMedia, deckSearchQueries } from '@/services/promptSlidesMedia';
import { polishDeck } from '@/services/promptSlidesPolish';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import { normalizeSlideCountText, slideCountFromText } from '@/services/slideCountInput';
import { useDeckWorkspace } from '@/hooks/useDeckWorkspace';
import { parseSavedDeck } from '@/services/savedDeck';
import { getItem } from '@/services/workspace';
import { useSlideEditor } from '@/hooks/useSlideEditor';
import { DeckOutline } from '@/components/slides/DeckOutline';
import { DeckActions } from '@/components/slides/DeckActions';
import { SlideEditModal } from '@/components/slides/SlideEditModal';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

/** What a deck was built from — saved as its form state. */
type PromptForm = { prompt: string; slideCountText: string; source: string };

export default function PromptSlidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang: uiLang } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  const { user } = useAuth();

  // Grade and subject used to be two pill rows on this screen, which is exactly
  // the tapping-through a "just describe it" tool exists to avoid. They come
  // from the teacher's own profile now — the same `narrowToSelection` the
  // curriculum browser uses, with its fall-back-to-everything behaviour — and
  // they reach the model as a HINT. A description naming another grade wins.
  const teacherGrade = narrowToSelection(getPickerGrades(), user?.gradeIds)[0];
  const teacherSubjects = narrowToSelection(getPickerSubjects(), user?.subjectIds);
  const teacherSubject = teacherSubjects[0];
  // An English-only teacher's decks are built in English. With other subjects
  // too, nothing here says which one the prompt is about, so the UI decides.
  const isAr = contentLang(teacherSubjects.length === 1 ? teacherSubject?.id : null, uiLang) === 'ar';
  const gradeLabel = teacherGrade ? (isAr ? teacherGrade.nameAr : teacherGrade.name) : '';
  const subjectLabel = teacherSubject ? (isAr ? teacherSubject.nameAr : teacherSubject.name) : '';

  // Reopening a saved item from موادي pushes here with its `formState`
  // spread as params (see workspace/view.tsx's `editRoute`) — the same keys
  // `toggleSave` below writes, so the form comes back exactly as it was left.
  const params = useLocalSearchParams<{ prompt?: string; slideCountText?: string; source?: string; savedId?: string }>();

  const [prompt, setPrompt] = useState(params.prompt ?? '');
  const [slideCountText, setSlideCountText] = useState(params.slideCountText ?? '');
  // The passage the teacher pasted for the deck to be built out of. Kept out
  // of the way until asked for — most decks are built from a description
  // alone, and this screen's whole pitch is that it asks for almost nothing.
  const [source, setSource] = useState(params.source ?? '');
  const [sourceOpen, setSourceOpen] = useState(!!params.source);

  const [loading, setLoading] = useState(false);
  /**
   * One controller for whichever request is in flight — the clarifying
   * questions or the deck. The questions call used to take no signal at all,
   * so neither Cancel nor leaving the screen could stop it.
   */
  const abortRef = useRef<AbortController | null>(null);
  useAbortOnUnmount(abortRef);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');
  const [deck, setDeck] = useState<ClassroomActivity | null>(null);
  /** Freshest deck, edits included, for the snapshot a regenerate restores on failure. */
  const deckRef = useRef<ClassroomActivity | null>(null);
  deckRef.current = deck;
  /**
   * The prompt, count and source the deck on screen was built from. Save
   * reads these rather than the live fields, which stay editable after a deck
   * is built — see `generationScope.ts` for the same rule on Slides.
   */
  const [builtFrom, setBuiltFrom] = useState<PromptForm | null>(null);

  /**
   * The one clarifying round. `asking` holds the questions the server sent
   * back; `answers` is question id → the option label the teacher tapped.
   * Both clear once a deck is built from them — not when generation starts:
   * clearing them first meant a failed or cancelled build sent the teacher
   * back through the questions with their answers gone.
   */
  const [asking, setAsking] = useState<PromptSlidesQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [askingBusy, setAskingBusy] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

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

  const workspace = useDeckWorkspace({
    deck,
    identity: deckIdentity,
    // What the deck was built from, not what the fields say now.
    formState: () => builtFrom ?? { prompt: prompt.trim(), slideCountText, source: source.trim() },
    exportName: d => d.activityName,
    isAr,
    t,
    showToast,
    logTag: 'prompt-slides',
  });
  const forgetSaved = workspace.forget;
  const editor = useSlideEditor({ deck, setDeck, isAr, t, showToast });

  /**
   * A deck reopened from موادي. «تعديل» sends `savedId` with the prompt, count
   * and source, and this screen used to read only those: the deck itself — its
   * slides, its edits — was never loaded, so the teacher had a prefilled form
   * and one press from replacing what they had built. Load the stored deck and
   * its workspace link; an item that is gone or unreadable leaves the form and
   * says so.
   */
  useEffect(() => {
    const id = params.savedId;
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const item = await getItem(id).catch(() => null);
      if (cancelled) return;
      // A teacher who pressed Build before the read came back keeps theirs.
      if (deckRef.current || abortRef.current) return;
      const loaded = item ? parseSavedDeck(item.content) : null;
      if (!loaded) { showToast(t('savedDeckUnreadable')); return; }
      if (params.prompt) {
        setBuiltFrom({ prompt: params.prompt, slideCountText: params.slideCountText ?? '', source: params.source ?? '' });
      }
      workspace.adopt(id, loaded, deckIdentity(loaded));
      setDeck(loaded);
    })();
    return () => { cancelled = true; };
  }, [params.savedId]);

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
    const controller = new AbortController();
    abortRef.current = controller;
    setAskingBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const questions = await aiService.fetchPromptSlidesQuestions({
        // The source itself is deliberately not sent — this is the cheap nano
        // call, and 6000 characters of it would cost more than the answers are
        // worth. Its existence is, so the model stops asking what the deck
        // should be based on when the teacher has already said.
        // The questions are asked of the teacher, so in the UI language.
        prompt: source.trim()
          ? `${trimmed}\n\n${uiLang === 'ar' ? '(ألصق المعلّم نصًا مصدريًا سيُبنى العرض منه.)' : '(The teacher has pasted a source text for the deck to be built from.)'}`
          : trimmed,
        grade: gradeLabel || undefined,
        subject: subjectLabel || undefined,
        language: uiLang === 'ar' ? 'arabic' : 'english',
      }, { signal: controller.signal });
      // The call swallows every failure into `[]`, the abort included, so a
      // Cancel would otherwise read as "nothing to ask" and build the deck.
      if (controller.signal.aborted) { setCancelled(true); return; }
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
      if (abortRef.current === controller) abortRef.current = null;
      setAskingBusy(false);
    }
    void generate();
  };

  /**
   * `withAnswers: false` is "skip the questions". It used to clear `answers`
   * and then call this, which still read the answers from its own closure —
   * so skipping sent them anyway.
   */
  const generate = async ({ withAnswers = true }: { withAnswers?: boolean } = {}) => {
    const trimmed = prompt.trim();
    if (!trimmed) { setError(t('promptRequired')); return; }

    // Whatever the teacher tapped rides along inside the description itself,
    // so the server contract and the pooling exclusion stay untouched.
    const answered = (withAnswers ? asking : [])
      .map(q => ({ question: q.question, answer: answers[q.id] ?? '' }))
      .filter(a => a.answer);
    // The pasted source rides along the same way, and last: the description
    // and the teacher's answers say what to build, and the source is the
    // material to build it out of.
    const fullPrompt = foldSourceIntoPrompt(
      foldAnswersIntoPrompt(trimmed, answered, isAr), source, isAr,
    );

    setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    // The deck on screen and everything tied to it, so a failed or cancelled
    // regenerate puts it back instead of leaving the teacher with nothing.
    const previous = deckRef.current ? {
      deck: deckRef.current,
      workspace: workspace.snapshot(),
      builtFrom,
    } : null;
    setLoading(true); setDeck(null);
    forgetSaved();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const form: PromptForm = { prompt: trimmed, slideCountText, source: source.trim() };
    const req: PromptSlidesRequest = {
      prompt: fullPrompt,
      grade: gradeLabel,
      subject: subjectLabel,
      language: isAr ? 'arabic' : 'english',
      // «١٠» is ten: the field used to keep only latin digits.
      slideCount: slideCountFromText(slideCountText),
      classroomSetup: 'screen',
    };
    try {
      const out = await aiService.generatePromptSlides(req, { signal: controller.signal });
      // Both of these cost nothing and need no network, so they land with the
      // deck rather than after it. Polish runs first: it drops the slides that
      // say nothing, and a dropped slide should not have had a graph inserted
      // after it.
      const built = attachDrawnVisuals(polishDeck(out, isAr), isAr);
      setAsking([]); setAnswers({});
      setBuiltFrom(form);
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
      if (previous) {
        setDeck(previous.deck);
        workspace.restore(previous.workspace);
        setBuiltFrom(previous.builtFrom);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
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
              <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
                {t('promptSlidesTitle')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.95)', fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 23, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
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
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left', marginTop: 0 }]}>
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
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
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
            <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>
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

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('promptSlidesSlideCountLabel')}
          </Text>
          <TextInput
            value={slideCountText}
            onChangeText={v => setSlideCountText(normalizeSlideCountText(v))}
            keyboardType="number-pad"
            placeholder={uiLang === 'ar' ? 'تلقائي' : 'Auto'}
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
                    color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13,
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
                            fontFamily: 'ReadexPro_500Medium', fontSize: 12,
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
            <Pressable onPress={() => { void generate({ withAnswers: false }); }} style={styles.skipBtn}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
                {t('promptSlidesSkipQuestions')}
              </Text>
            </Pressable>
          )}
        </View>

        <GenerationStatus
          phase={loading || askingBusy ? 'loading' : cancelled ? 'cancelled' : (error && prompt.trim()) ? 'error' : 'idle'}
          loadingLabel={askingBusy ? t('promptSlidesAsking') : t('promptSlidesBuilding')}
          errorDetail={error}
          onCancel={cancelGenerate}
          // Straight to the deck with the answers the teacher already gave:
          // `onBuild` would ask the questions again.
          onRetry={() => { void generate(); }}
          colors={colors}
          isRTL={isRTL}
          lang={uiLang}
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
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>
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
                <Text style={[styles.previewTitle, { flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {deck.activityName}
                </Text>
              </View>
              <Text style={[styles.previewMeta, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('slideCount', deck.slides.length)}
              </Text>

              <DeckOutline
                slides={deck.slides}
                onEdit={editor.openEdit}
                onRemove={i => { void editor.removeSlide(i); }}
                isRTL={isRTL}
                colors={colors}
                t={t}
              />
            </View>

            <DeckActions workspace={workspace} onPresent={present} showToast={showToast} isRTL={isRTL} colors={colors} t={t} />
          </View>
        )}

        {deck && !loading && <FeedbackWidget materialType="prompt-slides" toolId="prompt-slides" />}
      </ScrollView>

      <SlideEditModal editor={editor} isRTL={isRTL} colors={colors} t={t} />

      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  heroIcon: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroPills: { flexWrap: 'wrap', gap: 8, marginTop: 16 },
  heroPill: {
    alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroPillText: { color: 'rgba(255,255,255,0.9)', fontFamily: 'ReadexPro_500Medium', fontSize: 11 },
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
  emptyHint: { fontSize: 13, lineHeight: 21, textAlign: 'center' },
  form: { padding: 20 },
  promptInput: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 96, textAlignVertical: 'top', marginBottom: 8 },
  fieldLabel: { fontSize: 13, marginBottom: 6, marginTop: 4 },
  sourceToggle: { alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 2 },
  sourceInput: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 120, textAlignVertical: 'top', marginBottom: 6 },
  sourceHint: { fontSize: 13, marginBottom: 12, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
  slideCountInput: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, marginBottom: 16, width: 100 },
  previewCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 17 },
  previewMeta: { fontSize: 12 },
});
