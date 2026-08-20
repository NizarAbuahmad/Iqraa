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
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import type { ActivitySlide, ClassroomActivity, LessonPlanOutput } from '@/services/ai/AIService';
import { buildGeneratorContext, resolveGeneratorGrounding } from '@/services/kbContext';
import {
  buildLessonDeck, EXIT_TICKET_MAX, MID_LESSON_CHECK_MAX, rebuildAnswerKey,
} from '@/services/lessonSlides';
import {
  applyMediaEdit, extractGraphCommands, insertLessonResources, nextVideoSuggestion,
  shouldSearchForVideo, videoCaption,
} from '@/services/classMedia';
import { LessonResources } from '@/components/ui/LessonResources';
import type { LessonMediaItem } from '@/services/lessonMedia';
import type { DeckVideo } from '@/services/youtubeVideo';
import { summarizeVerification } from '@/services/quizVerification';
import { confirm } from '@/services/confirm';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { saveItem } from '@/services/workspace';
import { buildDeckSlidesHTML, exportAsPDF } from '@/services/share';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
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
  const subjects = getPickerSubjects();

  const [gradeIdx, setGradeIdx] = useState(() => resolvePickerIndex(undefined, grades.length));
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(undefined, subjects.length));
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

  // Per-slide editing — the deck is a draft the teacher owns, not a fixed
  // output. Edits live in the same deck state that Present/Save/PDF read, so
  // whatever the teacher fixed is what every downstream surface gets.
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [editMediaCaption, setEditMediaCaption] = useState('');
  const [editMediaError, setEditMediaError] = useState('');
  /**
   * Alternative videos from the same search that produced the deck's pick.
   * Held on the screen rather than on the slide: they are a browsing aid, not
   * deck content, and putting them in the slide would carry them into every
   * save and export for nothing.
   */
  const [videoOptions, setVideoOptions] = useState<DeckVideo[]>([]);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  /** What the teacher has pinned to this lesson, kept in sync by the picker. */
  const [attached, setAttached] = useState<LessonMediaItem[]>([]);
  /** True once the example-verification pass has resolved — the summary row
      stays silent while a check is still in flight. */
  const [verifyDone, setVerifyDone] = useState(false);

  const openEdit = (i: number) => {
    if (!deck) return;
    const s = deck.slides[i];
    setEditTitle(s.title);
    setEditContent(s.content);
    setEditAnswer(s.answer ?? '');
    setEditMediaUrl(s.mediaUrl ?? '');
    setEditMediaCaption(s.mediaCaption ?? '');
    setEditMediaError('');
    setEditIdx(i);
  };

  /**
   * Put the next search candidate into the fields — it does not save.
   *
   * Filling the form rather than applying straight to the deck lets the
   * teacher read the title before committing, and keep pressing for another.
   * The caption is rewritten too, because a suggestion the teacher chose is
   * theirs: `applyMediaEdit` will see a caption that differs from the slide's
   * and keep it, which is right — it describes the video now on the slide.
   *
   * A deck reopened from the workspace has no candidates in memory, so the
   * first press fetches them. That is one search, then free cycling.
   */
  const suggestAnotherVideo = async () => {
    if (editIdx === null || !deck) return;
    let options = videoOptions;
    if (options.length === 0) {
      setLoadingSuggestion(true);
      try {
        const { searchDeckVideos } = await import('@/services/youtubeVideo');
        const query = isAr
          ? `شرح ${deck.lesson} ${subjects[subjectIdx].nameAr} للصف العاشر`
          : `${deck.lesson} ${subjects[subjectIdx].name} grade 10 explained`;
        options = await searchDeckVideos(query, isAr ? 'ar' : 'en');
        setVideoOptions(options);
      } finally {
        setLoadingSuggestion(false);
      }
    }
    const next = nextVideoSuggestion(options, editMediaUrl);
    if (!next) { setEditMediaError(t('noOtherVideo')); return; }
    setEditMediaUrl(next.url);
    setEditMediaCaption(videoCaption(next));
    setEditMediaError('');
  };

  const applyEdit = () => {
    if (editIdx === null || !deck) return;

    // Media is validated before anything is written: a URL the app cannot
    // embed would project as a blank frame in front of a class and print as a
    // dead link. Refuse it here rather than storing it and finding out live.
    const editing = deck.slides[editIdx];
    let swapped: ActivitySlide | null = null;
    if (editing?.type === 'media') {
      const result = applyMediaEdit(editing, { url: editMediaUrl, caption: editMediaCaption });
      if (!result.ok) { setEditMediaError(t('mediaUrlUnsupported')); return; }
      swapped = result.slide;
    }

    const slides = deck.slides.map((s, i) => {
      if (i !== editIdx) return s;
      if (swapped) {
        return { ...swapped, title: editTitle.trim() || s.title, content: editContent };
      }
      const answer = editAnswer.trim();
      const next = { ...s, title: editTitle.trim() || s.title, content: editContent };
      // An emptied answer removes the reveal button rather than revealing "".
      if (s.answer !== undefined || answer) {
        if (answer) next.answer = answer; else delete next.answer;
      }
      // Changing the question or the answer invalidates whatever proof the
      // verifier gave the ORIGINAL pair — carrying the badge over would vouch
      // for text nobody checked. Title edits keep it; the math is untouched.
      if (next.content !== s.content || next.answer !== s.answer) {
        delete next.verified;
        delete next.verifiedBy;
        delete next.computedAnswer;
      }
      return next;
    });
    setDeck({ ...deck, slides, answerKey: rebuildAnswerKey(slides, isAr) });
    setEditIdx(null);
    showToast(t('slideUpdated'));
  };

  const removeSlide = async (i: number) => {
    if (!deck) return;
    const ok = await confirm({
      title: t('deleteSlideTitle'),
      message: deck.slides[i].title,
      confirmLabel: t('deleteLabel'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    const slides = deck.slides
      .filter((_, idx) => idx !== i)
      .map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    setDeck({ ...deck, slides, answerKey: rebuildAnswerKey(slides, isAr) });
  };

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

    const grounding = resolveGeneratorGrounding(trimmed, lang as 'ar' | 'en');
    setGrounded(grounding.grounded);
    setGroundedLesson(grounding.lesson ? (isAr ? grounding.lesson.titleAr : grounding.lesson.titleEn) : '');

    try {
      // The plan supplies only the connective tissue. If it fails we still have
      // a usable deck from the book, so a generation error must not throw away
      // curriculum content the teacher can already project.
      // Formative checks, generated alongside the plan rather than after it:
      // they are structural (the deck is assembled around them), so they have
      // to be in hand before `buildLessonDeck` runs. Requested in parallel so
      // adding them costs no extra wall-clock, and failing independently so a
      // check-generation error costs the deck nothing.
      const checksPromise = aiService
        .generateClassroomActivity({
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          activityType: 'quick-check',
          duration: 10,
          difficulty: 'standard',
          groupType: 'whole-class',
          teachingGoal: 'assessment',
          language: isAr ? 'arabic' : 'english',
          // Two mid-lesson checks plus a three-question exit ticket. Asking
          // for exactly what the deck places means no question is generated
          // and then thrown away.
          numQuestions: MID_LESSON_CHECK_MAX + EXIT_TICKET_MAX,
        })
        .then(a => a.slides)
        .catch((): ActivitySlide[] => []);

      let lessonPlan: LessonPlanOutput | null = null;
      try {
        lessonPlan = await aiService.generateLessonPlan({
          // Localised: this string is carried into generated content verbatim —
          // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
          // compared anywhere, only displayed and passed through, so translating it
          // is safe. `subject` is deliberately left in English: it feeds
          // isMathContext and ~30 other call sites.
          grade: isAr ? grades[gradeIdx]!.nameAr : grades[gradeIdx]!.name,
          subject: subjects[subjectIdx].name,
          topic: trimmed,
          language: isAr ? 'arabic' : 'english',
          additionalContext: buildGeneratorContext(trimmed, lang as 'ar' | 'en') || undefined,
        });
      } catch {
        lessonPlan = null;
      }

      if (!lessonPlan && !grounding.lesson) {
        setError(t('generationFailed'));
        return;
      }

      setPlan(lessonPlan);
      // A live graph slide when the lesson's own text carries plottable
      // functions — same conservative extractor Start Class already uses.
      const graphCommands = subjects[subjectIdx].id === 'mathematics'
        ? extractGraphCommands([
            trimmed,
            ...(grounding.lesson?.examplesAr ?? []),
            ...(grounding.lesson?.examplesEn ?? []),
            ...(grounding.lesson?.rulesAr ?? []),
            ...(grounding.lesson?.rulesEn ?? []),
            lessonPlan?.mainActivity ?? '',
          ].join(' \n '))
        : [];
      const checks = await checksPromise;
      const builtBase = buildLessonDeck(trimmed, isAr, {
        lesson: grounding.lesson,
        plan: lessonPlan,
        subject: isAr ? subjects[subjectIdx].nameAr : subjects[subjectIdx].name,
        grade: isAr ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        includeExamples,
        includePractice,
        graphCommands,
        checks,
      });
      // The teacher's own resources go in before anything is shown, unlike
      // the searched media which arrives later — they are local, so there is
      // nothing to wait for and no reason to make the deck flicker.
      const built = {
        ...builtBase,
        slides: insertLessonResources(builtBase.slides, attached, isAr),
      };
      setDeck(built);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);

      // Verify the worked examples' answers after the deck is on screen —
      // never blocks generation. Outcomes are matched back by slide object
      // identity, so a slide the teacher edited or deleted while the check
      // was in flight simply keeps no badge: a stale ✓ is worse than none.
      setVerifyDone(false);
      void (async () => {
        try {
          const { verifyDeckExamples } = await import('@/services/quizVerification');
          const { verifyMathItem } = await import('@/services/ai/verifyMath');
          const outcomes = await verifyDeckExamples(built.slides, verifyMathItem);
          setDeck(cur => {
            if (!cur) return cur;
            return {
              ...cur,
              slides: cur.slides.map(s => {
                const idx = built.slides.indexOf(s);
                const o = idx >= 0 ? outcomes[idx] : undefined;
                if (!o) return s;
                return {
                  ...s,
                  verified: true,
                  verifiedBy: o.verifiedBy,
                  ...(o.computedAnswer ? { computedAnswer: o.computedAnswer } : {}),
                };
              }),
            };
          });
          setVerifyDone(true);
        } catch {
          // Verification is a bonus, never a failure state for the deck.
        }
      })();

      // External media, all fetched after the deck is already usable: two
      // topic-relevant photos (a hero background for the title slide and one
      // for the section divider) plus one real explainer video. Never blocks
      // generation, and silently does nothing for whichever server key is
      // unconfigured or turns up nothing. All three land in one state update
      // so they share a single staleness guard rather than racing each other.
      void (async () => {
        try {
          const { searchDeckPhoto } = await import('@/services/unsplashImage');
          const { searchDeckVideos } = await import('@/services/youtubeVideo');
          const { attachBackgroundImage, buildMediaSlide, deckPhotoQueries, insertVideoSlide } =
            await import('@/services/classMedia');
          const [titleQuery, dividerQuery] = deckPhotoQueries(subjects[subjectIdx].id, subjects[subjectIdx].name);
          const captionFor = (photographer: string) => (isAr
            ? `📷 ${photographer} · Unsplash`
            : `📷 Photo by ${photographer} on Unsplash`);

          // The video query uses the lesson topic, not the subject: a generic
          // "mathematics" video is no use mid-lesson, where the point is to
          // explain THIS concept.
          const videoQuery = isAr
            ? `شرح ${trimmed} ${subjects[subjectIdx].nameAr} للصف العاشر`
            : `${trimmed} ${subjects[subjectIdx].name} grade 10 explained`;

          // The search fills a gap, it does not compete with the teacher. A
          // pinned video means no call at all — one fewer thing on the
          // projector, and 100 units of a 10,000/day quota unspent.
          const wantVideo = shouldSearchForVideo(attached);
          const [titlePhoto, dividerPhoto, videos] = await Promise.all([
            searchDeckPhoto(titleQuery),
            searchDeckPhoto(dividerQuery),
            wantVideo ? searchDeckVideos(videoQuery, isAr ? 'ar' : 'en') : Promise.resolve([]),
          ]);
          const video = videos[0] ?? null;
          // Keep the rest for the editor's "another suggestion" control. They
          // cost nothing extra — one search returned all of them.
          setVideoOptions(videos);
          if (!titlePhoto && !dividerPhoto && !video) return;

          setDeck(cur => {
            // Guard against a stale fetch landing on a deck the teacher has
            // since regenerated — same identity check the verify pass uses.
            if (!cur || cur.slides[0] !== built.slides[0]) return cur;
            let slides = cur.slides;
            if (titlePhoto) slides = attachBackgroundImage(slides, 0, titlePhoto.url, captionFor(titlePhoto.photographer));
            const dividerIdx = slides.findIndex(s => s.type === 'divider');
            if (dividerPhoto && dividerIdx >= 0) {
              slides = attachBackgroundImage(slides, dividerIdx, dividerPhoto.url, captionFor(dividerPhoto.photographer));
            }
            if (video) {
              // Two different jobs, so two different fields. `mediaCaption`
              // says what the video IS — the exports have no player to read a
              // title off, so they need it. `content` is the line shown above
              // the embed in the presenter, where repeating the title and
              // channel just duplicates YouTube's own chrome; there it only
              // needs to carry the warning. Either way the deck says plainly
              // that this is a search result, not curriculum-grounded content
              // the app stands behind — the teacher has to preview it.
              const videoSlide = buildMediaSlide(
                'video',
                video.url,
                videoCaption(video),
                isAr,
                0,
              );
              slides = insertVideoSlide(slides, {
                ...videoSlide,
                content: isAr ? 'فيديو خارجي — راجعه قبل العرض' : 'External video — preview before class',
              });
            }
            return { ...cur, slides };
          });
        } catch {
          // Missing media is a normal outcome, never a failure state for the deck.
        }
      })();
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
      formState: { gradeIdx, subjectIdx, topic: topic.trim(), includeExamples, includePractice },
    });
    showToast(t('slidesSaved'));
  };

  // Exports the DECK — same slides, same accents, same verification badges
  // the teacher just saw and edited on screen. This used to re-derive a
  // generic 6-slide summary from the lesson plan alone (buildLessonPlanSlidesHTML),
  // which meant a teacher exporting a curriculum-grounded deck with no plan
  // got no PDF at all, and one who edited a slide got a PDF that didn't
  // reflect the edit. Both buttons key off `deck`, not `plan`.
  const exportPdf = async () => {
    if (!deck) return;
    try {
      await exportAsPDF(buildDeckSlidesHTML(deck, isAr), `${topic.trim() || 'slides'}.pdf`);
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
      await exportDeckAsPptx(deck, isAr, topic.trim() || 'slides');
    } catch {
      showToast(t('generationFailed'));
    } finally {
      setExportingPptx(false);
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
          <AiSourceBadge onDark isRTL={isRTL} />
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
            onChange={setGradeIdx}
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

          {/* Directly under the lesson picker, because that is what these
              attach to: pin a video to «الاشتقاق» once and every future deck
              for that lesson carries it — and so does Class Mode, which has
              read this store all along. */}
          <LessonResources topic={topic.trim()} onChange={setAttached} />

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

              {/* Whether anything actually checked the example answers.
                  Silent until the verification pass resolves — saying nothing
                  is honest, "not verified" mid-flight is not. Derived from the
                  slides themselves so edits/deletions keep the count true. */}
              {(() => {
                const examples = deck.slides.filter(s => s.type === 'challenge' && s.answer);
                if (!verifyDone || examples.length === 0) return null;
                const v = summarizeVerification(
                  examples
                    .filter(s => s.verified && s.verifiedBy)
                    .map(s => ({ verifiedBy: s.verifiedBy!, computedAnswer: s.computedAnswer })),
                );
                return (
                  <View style={[styles.verifyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons
                      name={v.anySymbolic ? 'shield-checkmark' : 'library-outline'}
                      size={14}
                      color={v.anySymbolic ? '#10B981' : colors.mutedForeground}
                    />
                    <Text style={[styles.verifyText, {
                      color: v.anySymbolic ? '#10B981' : colors.mutedForeground,
                      textAlign: isRTL ? 'right' : 'left',
                    }]}>
                      {v.anySymbolic
                        ? t('quizVerifiedCount', v.symbolic, examples.length)
                        : t('quizVerifiedNone')}
                    </Text>
                  </View>
                );
              })()}

              {/* The outline is the product: a teacher decides whether to use
                  this deck by scanning slide titles, not by opening it. Each
                  row opens the editor — the deck is theirs to adjust. */}
              <View style={{ marginTop: 12, gap: 6 }}>
                {deck.slides.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => { Haptics.selectionAsync(); openEdit(i); }}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('editSlide')}: ${s.title}`}
                    style={({ pressed }) => [
                      { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
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
                    <Ionicons name="create-outline" size={16} color={colors.mutedForeground} />
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); void removeSlide(i); }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('deleteLabel')}: ${s.title}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </Pressable>
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

        {deck && !loading && <FeedbackWidget materialType="slides" toolId="slides" />}
      </ScrollView>

      {/* Per-slide editor */}
      <Modal visible={editIdx !== null} transparent animationType="fade" onRequestClose={() => setEditIdx(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('editSlide')}
            </Text>

            {/* The card is capped at 85% of the screen and the field list is
                type-dependent — a media slide adds two more. Without a scroll
                view the extra height clips silently and takes the Save button
                with it, which is unrecoverable for the teacher. */}
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

            {editIdx !== null && deck?.slides[editIdx]?.type === 'media' && (
              <>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('slideMediaUrlField')}
                </Text>
                <TextInput
                  value={editMediaUrl}
                  onChangeText={v => { setEditMediaUrl(v); setEditMediaError(''); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://www.youtube.com/watch?v=..."
                  placeholderTextColor={colors.mutedForeground}
                  // A URL is latin text: left-aligned even in the RTL layout,
                  // or it renders with the scheme at the wrong end.
                  style={[styles.modalInput, {
                    color: colors.foreground, borderColor: editMediaError ? '#D97706' : colors.border,
                    borderRadius: colors.radius, fontFamily: 'Almarai_400Regular', textAlign: 'left',
                  }]}
                />
                {editMediaError ? (
                  <Text style={[styles.modalHint, { color: '#B25E02', fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                    {editMediaError}
                  </Text>
                ) : (
                  <Text style={[styles.modalHint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('slideMediaUrlHint')}
                  </Text>
                )}

                {deck?.slides[editIdx]?.mediaKind === 'video' && (
                  <Pressable
                    onPress={suggestAnotherVideo}
                    disabled={loadingSuggestion}
                    style={[styles.suggestBtn, {
                      borderColor: colors.border, borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      opacity: loadingSuggestion ? 0.6 : 1,
                    }]}
                    accessibilityRole="button"
                  >
                    {loadingSuggestion
                      ? <ActivityIndicator size="small" color={ACCENT} />
                      : <Ionicons name="shuffle-outline" size={16} color={ACCENT} />}
                    <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                      {t('suggestAnotherVideo')}
                    </Text>
                  </Pressable>
                )}

                <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('slideMediaCaptionField')}
                </Text>
                <TextInput
                  value={editMediaCaption}
                  onChangeText={setEditMediaCaption}
                  placeholder={t('slideMediaCaptionPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, {
                    color: colors.foreground, borderColor: colors.border, borderRadius: colors.radius,
                    fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left',
                  }]}
                />
              </>
            )}

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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 17, marginBottom: 12 },
  modalLabel: { fontSize: 12, marginBottom: 6, marginTop: 8 },
  modalInput: { borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  suggestBtn: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 14, marginTop: 8, marginBottom: 4 },
  modalHint: { fontSize: 11, lineHeight: 17, marginTop: -4, marginBottom: 2 },
  modalInputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  verifyRow: { alignItems: 'center', gap: 6, marginTop: 8 },
  verifyText: { fontSize: 12, fontFamily: 'Almarai_400Regular', flex: 1 },
});
