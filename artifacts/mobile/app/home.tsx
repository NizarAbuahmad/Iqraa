import React, { useCallback, useState } from 'react';
import {
  Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { SavedMaterial, getRecentItems } from '@/services/workspace';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { DEMO_MODE } from '@/services/ai/demoMode';
import {
  DEMO_CONTINUE,
  buildContinueCardFromItem,
  buildDemoContinueCard,
} from '@/services/continueTeaching';
import {
  buildGeneratorNav,
  extractLessonTopic,
  getVisibleHeroSuggestions,
  getVisibleHomeTools,
  getVisibleSmartTemplates,
  inferToolFromPrompt,
  type HomeToolId,
} from '@/services/homeAiTools';
import { TopicSelector, type TopicSelectionDetail } from '@/components/ui/TopicSelector';
import { getPickerSubjects } from '@/services/curriculumData';
import {
  loadLessonPick,
  markOnboarded,
  saveLessonPick,
  setCoachDismissed,
  wasCoachDismissed,
  wasOnboarded,
  type HomeLessonPick,
} from '@/services/lessonContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { resolveGeneratorGrounding } from '@/services/kbContext';
import { objectivesSlide } from '@/services/classDeck';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import {
  buildGraphSlide,
  buildMediaSlide,
  classifyMediaUrl,
  extractGraphCommands,
} from '@/services/classMedia';
import {
  addLessonMedia,
  getLessonMedia,
  removeLessonMedia,
  type LessonMediaItem,
} from '@/services/lessonMedia';

const NAVY = '#081B3A';
const TEAL = '#00A99D';

/** Soft accent tints for hero prep tabs */
const SUGGEST_ACCENT: Record<string, { bg: string; border: string; iconBg: string }> = {
  'lesson-plan': { bg: 'rgba(96,165,250,0.14)', border: 'rgba(96,165,250,0.45)', iconBg: 'rgba(96,165,250,0.28)' },
  simplify: { bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.45)', iconBg: 'rgba(251,191,36,0.28)' },
  activity: { bg: 'rgba(244,114,182,0.14)', border: 'rgba(244,114,182,0.45)', iconBg: 'rgba(244,114,182,0.28)' },
  worksheet: { bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.45)', iconBg: 'rgba(248,113,113,0.28)' },
  quiz: { bg: 'rgba(52,211,153,0.14)', border: 'rgba(52,211,153,0.45)', iconBg: 'rgba(52,211,153,0.28)' },
  homework: { bg: 'rgba(251,146,60,0.14)', border: 'rgba(251,146,60,0.45)', iconBg: 'rgba(251,146,60,0.28)' },
};
const SUGGEST_FALLBACK = { bg: 'rgba(255,255,255,0.10)', border: 'rgba(52,214,198,0.35)', iconBg: 'rgba(255,255,255,0.14)' };

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [recentItems, setRecentItems] = useState<SavedMaterial[]>([]);
  const [continueItem, setContinueItem] = useState<SavedMaterial | null>(null);
  const [prompt, setPrompt] = useState('');
  const [lessonPick, setLessonPick] = useState<HomeLessonPick | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftTopic, setDraftTopic] = useState('');
  const [draftSubjectId, setDraftSubjectId] = useState('mathematics');
  const [draftDetail, setDraftDetail] = useState<TopicSelectionDetail>({
    unitOrder: null, unitTitle: null, lessonTitle: null,
  });
  const pickerSubjects = getPickerSubjects();
  // Class Mode media attached to the CURRENT lesson (shown as deck slides).
  const [media, setMedia] = useState<LessonMediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaError, setMediaError] = useState('');
  /** Media entry is optional, so it starts closed. */
  const [mediaOpen, setMediaOpen] = useState(false);
  /** First-run "start here" card — teachers can't discover what they can't see. */
  const [coachVisible, setCoachVisible] = useState(false);

  const loadData = useCallback(async () => {
    const recent = await getRecentItems(4);
    setRecentItems(recent);
    const preferred =
      recent.find(i => i.language === lang)
      ?? recent[0]
      ?? null;
    setContinueItem(preferred);
    const pick = await loadLessonPick();
    setLessonPick(pick);
    // Media follows the lesson actually shown (pick, else last material,
    // else the demo lesson) so it is never orphaned.
    const shownTopic = pick?.topic
      ?? (recent.find(i => i.language === lang) ?? recent[0])?.topic
      ?? (lang === 'ar' ? DEMO_CONTINUE.lessonTitleAr : DEMO_CONTINUE.lessonTitleEn);
    setMedia(await getLessonMedia(shownTopic));
    // First-run onboarding: a brand-new teacher lands on home with no lesson
    // chosen — open the picker once so the whole app starts contextualised.
    // Gated on user so it runs only after the per-user storage scope is set
    // (user?.id in the deps re-runs this when auth lands).
    if (user && !pick && !(await wasOnboarded())) {
      await markOnboarded();
      setDraftTopic('');
      setDraftDetail({ unitOrder: null, unitTitle: null, lessonTitle: null });
      setPickerOpen(true);
    }
    if (user) setCoachVisible(!(await wasCoachDismissed()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, user?.id]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await new Promise(r => setTimeout(r, 350));
    setRefreshing(false);
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);
  const firstName = user?.firstName || user?.name?.split(' ')[0] || t('teacher');

  const demoContinue = DEMO_MODE && !continueItem;
  const continueCard = continueItem
    ? buildContinueCardFromItem(continueItem, lang, t as any)
    : demoContinue
      ? buildDemoContinueCard(lang, t as any)
      : null;

  // The teacher's explicit pick wins; otherwise fall back to the last saved
  // material, then to the demo lesson.
  const lessonTopic =
    lessonPick?.topic
    ?? continueCard?.focusTitle
    ?? (lang === 'ar' ? DEMO_CONTINUE.lessonTitleAr : DEMO_CONTINUE.lessonTitleEn);

  // Banner subject follows the picked lesson's subject (defaults to math).
  const pickedSubject = lessonPick?.subjectId
    ? pickerSubjects.find(s => s.id === lessonPick.subjectId)
    : undefined;
  const contextSubject = pickedSubject
    ? (lang === 'ar' ? pickedSubject.nameAr : pickedSubject.name)
    : (lang === 'ar' ? 'الرياضيات' : 'Mathematics');
  const contextGrade = lang === 'ar' ? 'الصف العاشر' : 'Grade 10';
  const unitNumber = lessonPick
    ? lessonPick.unitOrder
    : (continueItem?.formState?.unitNumber as number | undefined)
      ?? DEMO_CONTINUE.unitNumber;
  const contextUnit = unitNumber == null
    ? lessonTopic
    : `${t('unitNumberLabel', unitNumber)} • ${lessonTopic}`;

  const visibleTools = getVisibleHomeTools();
  const visibleSuggestions = getVisibleHeroSuggestions();
  const visibleTemplates = getVisibleSmartTemplates();

  const openGenerator = (toolId: HomeToolId, topicOverride?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const topic = (topicOverride ?? lessonTopic).trim();
    const nav = buildGeneratorNav(toolId, topic, lang);
    router.push({ pathname: nav.pathname as any, params: nav.params });
  };

  const runPrompt = (raw?: string) => {
    const text = (raw ?? prompt).trim();
    if (!text) {
      openGenerator('lesson-plan');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const toolId = inferToolFromPrompt(text);
    const topic = extractLessonTopic(text, lessonTopic);
    openGenerator(toolId, topic);
  };

  // Opens the unit→lesson picker (it used to push the CURRENT lesson's detail
  // page, which only displayed the lesson and offered no way to change it).
  const openChangeLesson = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftTopic('');
    setDraftSubjectId(lessonPick?.subjectId ?? 'mathematics');
    setDraftDetail({ unitOrder: null, unitTitle: null, lessonTitle: null });
    setPickerOpen(true);
  };

  const confirmLessonPick = async () => {
    const topic = draftTopic.trim();
    if (!topic) return;
    const pick: HomeLessonPick = { topic, unitOrder: draftDetail.unitOrder, subjectId: draftSubjectId };
    setLessonPick(pick);
    setPickerOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await saveLessonPick(pick);
  };

  /**
   * Class Mode entry: build a deck for the current lesson straight from the
   * curriculum book (objectives + verified Quick Check questions) and go to
   * the projector screen. No prep required — the teacher can start cold.
   */
  const startClass = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const topic = lessonTopic.trim();
    const grounding = resolveGeneratorGrounding(topic, lang as 'ar' | 'en');
    const subjectName = pickedSubject?.name ?? 'Mathematics';
    const activity = await aiService.generateClassroomActivity({
      grade: '10',
      subject: subjectName,
      topic,
      activityType: 'quick-check',
      duration: 15,
      difficulty: 'standard',
      groupType: 'whole-class',
      teachingGoal: 'warm-up',
      language: lang === 'ar' ? 'arabic' : 'english',
    });
    // Deck order: rules → objectives → [graph for math] → questions →
    // [teacher's media] → summary. Everything is optional; the deck stays
    // valid when a lesson has no objectives, no plottable function, and no
    // attached media.
    const isAr = lang === 'ar';
    const objSlide = objectivesSlide(grounding.lesson, topic, isAr, 0);

    // Plot what the class is actually about: the lesson's own examples AND
    // the functions inside the generated questions (curriculum objectives
    // are prose and rarely contain a plottable definition).
    const isMath = (pickedSubject?.id ?? 'mathematics') === 'mathematics';
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
    // preloaded when we found any, otherwise a blank calculator the teacher
    // can type into live.
    const graphSlide = isMath ? buildGraphSlide(graphCommands, topic, isAr, 0) : null;

    const media = await getLessonMedia(topic);
    const mediaSlides = media.map(m => buildMediaSlide(m.kind, m.url, m.caption, isAr, 0));

    const [intro, ...rest] = activity.slides;
    const summary = rest.length && rest[rest.length - 1]!.type === 'summary' ? rest.pop()! : null;

    const slides = [
      intro!,
      ...(objSlide ? [objSlide] : []),
      ...(graphSlide ? [graphSlide] : []),
      ...rest,
      ...mediaSlides,
      ...(summary ? [summary] : []),
    ].map((s, i) => ({ ...s, slideNumber: i + 1 }));

    setPendingClassroomActivity({ ...activity, slides });
    router.push('/ai-tools/classroom/presentation' as any);
  };

  const addMedia = async () => {
    const url = mediaUrl.trim();
    const kind = classifyMediaUrl(url);
    if (!kind) { setMediaError(t('addMediaInvalid')); return; }
    setMediaError('');
    await addLessonMedia(lessonTopic, { kind, url, caption: mediaCaption.trim() });
    setMedia(await getLessonMedia(lessonTopic));
    setMediaUrl('');
    setMediaCaption('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const dropMedia = async (url: string) => {
    await removeLessonMedia(lessonTopic, url);
    setMedia(await getLessonMedia(lessonTopic));
  };

  const openContinueTeaching = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (continueItem) {
      router.push({ pathname: '/workspace/view', params: { id: continueItem.id } });
      return;
    }
    router.push({
      pathname: '/curriculum/lesson-detail',
      params: {
        lessonId: DEMO_CONTINUE.lessonId,
        subjectColor: TEAL,
        openLessonPlan: DEMO_MODE ? '1' : '0',
        topicOverride: lessonTopic,
      },
    });
  };

  const openMaterial = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/workspace/view', params: { id } });
  };

  const typeBadge = (type: string, formState?: Record<string, any>) => {
    if (formState?.isHomework || formState?.materialKind === 'homework') {
      return lang === 'ar' ? '🏠 واجب' : '🏠 Homework';
    }
    if (type === 'lesson') return lang === 'ar' ? '📄 خطة درس' : '📄 Lesson plan';
    if (type === 'worksheet') return lang === 'ar' ? '📝 ورقة عمل' : '📝 Worksheet';
    if (type === 'quiz') return lang === 'ar' ? '❓ اختبار' : '❓ Quiz';
    if (type === 'activity') return lang === 'ar' ? '🎯 نشاط' : '🎯 Activity';
    if (type === 'flow') return lang === 'ar' ? '📄 مسار درس' : '📄 Lesson flow';
    return lang === 'ar' ? '📄 مادة' : '📄 Material';
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffH = Math.floor(diffMs / 3600000);
      const diffD = Math.floor(diffMs / 86400000);
      if (lang === 'ar') {
        if (diffH < 1) return 'منذ قليل';
        if (diffH === 1) return 'منذ ساعة';
        if (diffH === 2) return 'منذ ساعتين';
        if (diffH < 11) return `منذ ${diffH} ساعات`;
        if (diffH < 24) return `منذ ${diffH} ساعة`;
        if (diffD === 1) return 'منذ يوم';
        if (diffD === 2) return 'منذ يومين';
        if (diffD < 7) return `منذ ${diffD} أيام`;
        return d.toLocaleDateString('ar-JO', { day: 'numeric', month: 'short' });
      }
      if (diffH < 1) return 'Just now';
      if (diffH < 24) return `${diffH}h ago`;
      if (diffD < 7) return `${diffD}d ago`;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Compact top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 12, backgroundColor: colors.background, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greet, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('welcomeBackNamed', firstName)}
          </Text>
        </View>
        <AiSourceBadge isRTL={isRTL} />
      </View>

      {/* 0 ── First-run coach: the three steps of a teacher's week */}
      {coachVisible ? (
        <View style={styles.sectionPad}>
          <View style={[styles.coachCard, { backgroundColor: NAVY }]}>
            <View style={[styles.coachHead, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="sparkles" size={16} color={TEAL} />
              <Text style={[styles.coachTitle, { fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('coachTitle')}
              </Text>
            </View>
            {[t('coachStep1'), t('coachStep2'), t('coachStep3')].map((step, i) => (
              <View key={i} style={[styles.coachRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={styles.coachNum}>
                  <Text style={[styles.coachNumText, { fontFamily: 'Cairo_700Bold' }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.coachStep, { fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {step}
                </Text>
              </View>
            ))}
            <Pressable
              onPress={() => { setCoachVisible(false); void setCoachDismissed(true); }}
              style={({ pressed }) => [styles.coachBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.coachBtnText, { fontFamily: 'Cairo_600SemiBold' }]}>{t('coachDismiss')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 1 ── Compact Curriculum Context */}
      <View style={styles.sectionPad}>
        <View
          style={[
            styles.contextBanner,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.contextBody, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={[styles.contextFlag, { fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('jordanCurriculum')}
            </Text>
            <Text style={[styles.contextMeta, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {contextSubject} • {contextGrade}
            </Text>
            <Text
              style={[styles.contextLesson, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}
              numberOfLines={2}
            >
              {contextUnit}
            </Text>
            {/* Confirms attachments belong to THIS lesson — media is keyed by
                lesson, so a clip added under a different lesson is invisible
                here, which otherwise looks like "nothing happened". */}
            {media.length > 0 ? (
              <View
                style={[
                  styles.mediaBadge,
                  { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: TEAL + '55', backgroundColor: TEAL + '14' },
                ]}
              >
                <Ionicons name="albums-outline" size={13} color={TEAL} />
                <Text style={{ color: TEAL, fontFamily: 'Cairo_600SemiBold', fontSize: 11.5 }}>
                  {t('mediaAttachedCount', media.length)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.contextActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {/* Front door to Class Mode: prep → projector in one tap. */}
              <Pressable
                onPress={startClass}
                style={({ pressed }) => [
                  styles.startClassBtn,
                  {
                    opacity: pressed ? 0.88 : 1,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('startClass')}
              >
                <Ionicons name="tv" size={15} color="#fff" />
                <Text style={styles.startClassBtnText}>{t('startClass')}</Text>
              </Pressable>

              <Pressable
                onPress={openChangeLesson}
                style={({ pressed }) => [
                  styles.changeLessonBtn,
                  {
                    opacity: pressed ? 0.88 : 1,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('changeLesson')}
              >
                <Ionicons name="swap-horizontal" size={15} color="#fff" />
                <Text style={styles.changeLessonBtnText}>
                  {t('changeLesson')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* 2 ── AI Hero Prompt */}
      <View style={styles.sectionPad}>
        <View style={[styles.hero, { backgroundColor: NAVY }]}>
          <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('homeHeroTitle')}
          </Text>
          <Text style={[styles.heroSub, { fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('homeHeroSubtitle')}
          </Text>

          <View style={styles.promptBox}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder={t('homeHeroPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.45)"
              multiline
              style={[
                styles.promptInput,
                {
                  fontFamily: 'Almarai_400Regular',
                  textAlign: isRTL ? 'right' : 'left',
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
            />
            <View style={{ alignSelf: isRTL ? 'flex-start' : 'flex-end' }}>
              <Pressable
                onPress={() => runPrompt()}
                style={({ pressed }) => [
                  styles.promptSend,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('homeGenerate')}
              >
                <Ionicons name="sparkles" size={20} color={NAVY} />
              </Pressable>
            </View>
          </View>

          {/* 3 ── Prep type tabs (right-aligned in RTL) */}
          <View
            style={[
              styles.suggestWrap,
              {
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'flex-start',
              },
            ]}
          >
            {visibleSuggestions.map((s, i) => {
              const accent = SUGGEST_ACCENT[s.id] ?? SUGGEST_FALLBACK;
              return (
                <Pressable
                  key={`${s.id}-${i}`}
                  onPress={() => {
                    const label = lang === 'ar' ? s.labelAr : s.labelEn;
                    const starter = lang === 'ar'
                      ? `أنشئ ${label.replace(/^[^\s]+\s/, '')} عن ${lessonTopic}`
                      : `Create a ${label} about ${lessonTopic}`;
                    setPrompt(starter);
                    openGenerator(s.id, lessonTopic);
                  }}
                  style={({ pressed }) => [
                    styles.suggestChip,
                    {
                      backgroundColor: accent.bg,
                      borderColor: accent.border,
                      opacity: pressed ? 0.82 : 1,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      paddingLeft: isRTL ? 12 : 6,
                      paddingRight: isRTL ? 6 : 12,
                    },
                  ]}
                >
                  <View style={[styles.suggestIcon, { backgroundColor: accent.iconBg }]}>
                    <Text style={styles.suggestEmoji}>{s.emoji}</Text>
                  </View>
                  <Text style={[styles.suggestChipText, { fontFamily: 'Cairo_600SemiBold' }]}>
                    {lang === 'ar' ? s.labelAr : s.labelEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* 4 ── AI Tools grid */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('homeAiToolsTitle')}
        </Text>
        <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }]}>
          {lang === 'ar' ? 'قبل الحصة · أثناءها · بعدها' : 'Before · during · after class'}
        </Text>
        <View style={[styles.toolsGrid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {visibleTools.map(tool => (
            <Pressable
              key={tool.id}
              onPress={() => openGenerator(tool.id)}
              style={({ pressed }) => [
                styles.toolCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.toolEmoji}>{tool.emoji}</Text>
              <Text
                style={[styles.toolLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: 'center' }]}
                numberOfLines={2}
              >
                {lang === 'ar' ? tool.labelAr : tool.labelEn}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 5 ── Continue Teaching (compact) */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('continueWorking')}
        </Text>
        {continueCard ? (
          <Pressable
            onPress={openContinueTeaching}
            style={({ pressed }) => [
              styles.continueRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.88 : 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}
                numberOfLines={1}
              >
                {continueCard.primaryHeading}
              </Text>
              <Text
                style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}
                numberOfLines={1}
              >
                {continueCard.editedLabel}
              </Text>
            </View>
            <View style={[styles.continueBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>{t('resumeWork')}</Text>
              <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={14} color="#fff" />
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => openGenerator('lesson-plan')}
            style={[styles.continueRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
              {t('continueEmptyDesc')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 6 ── Smart Templates */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('smartTemplatesTitle')}
        </Text>
        <View style={{ gap: 8 }}>
          {visibleTemplates.map(tpl => (
            <Pressable
              key={tpl.id}
              onPress={() => {
                const hint = lang === 'ar' ? tpl.topicHintAr : tpl.topicHintEn;
                openGenerator(tpl.toolId, `${hint}: ${lessonTopic}`);
              }}
              style={({ pressed }) => [
                styles.templateRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.88 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
                • {lang === 'ar' ? tpl.labelAr : tpl.labelEn}
              </Text>
              <Ionicons name="sparkles-outline" size={16} color={TEAL} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* 7 ── Recent Documents (lighter) */}
      <View style={styles.section}>
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', marginBottom: 0, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('recentMaterials')}
          </Text>
          {recentItems.length > 0 && (
            <Pressable onPress={() => router.push('/workspace')}>
              <Text style={{ color: TEAL, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                {lang === 'ar' ? 'عرض الكل' : 'View all'}
              </Text>
            </Pressable>
          )}
        </View>

        {recentItems.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left', marginTop: 4 }}>
            {t('recentEmptyDesc')}
          </Text>
        ) : (
          <View style={{ gap: 8, marginTop: 4 }}>
            {recentItems.map(m => (
              <Pressable
                key={m.id}
                onPress={() => openMaterial(m.id)}
                style={({ pressed }) => [
                  styles.recentRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.88 : 1,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={[styles.badge, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
                    <Text style={[styles.badgeText, { fontFamily: 'Cairo_500Medium' }]}>
                      {typeBadge(m.type, m.formState)}
                    </Text>
                  </View>
                  <Text
                    style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}
                    numberOfLines={1}
                  >
                    {m.title}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                    {formatDate(m.savedAt)}
                  </Text>
                </View>
                <Text style={{ color: TEAL, fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>
                  {t('openDocument')}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ── Change-lesson picker (unit → lesson from the curriculum KB) ── */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={[
              styles.pickerHeader,
              { borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10} style={{ width: 64 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14 }}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Text>
            </Pressable>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 16 }}>
              {t('changeLesson')}
            </Text>
            <View style={{ width: 64 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: 'Almarai_400Regular',
                fontSize: 13,
                marginBottom: 14,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {lang === 'ar'
                ? 'اختر المادة ثم الوحدة ثم الدرس من المنهاج الأردني — الصف العاشر.'
                : 'Pick the subject, unit, then lesson — Jordan curriculum, Grade 10.'}
            </Text>

            {/* Subject pills */}
            <Text
              style={{
                color: colors.foreground,
                fontFamily: 'Cairo_500Medium',
                fontSize: 14,
                marginBottom: 8,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {lang === 'ar' ? 'المادة' : 'Subject'}
            </Text>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {pickerSubjects.map(s => {
                const active = draftSubjectId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      // Changing subject invalidates the unit/lesson draft.
                      setDraftSubjectId(s.id);
                      setDraftTopic('');
                      setDraftDetail({ unitOrder: null, unitTitle: null, lessonTitle: null });
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: active ? TEAL : colors.border,
                      backgroundColor: active ? TEAL + '16' : colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? TEAL : colors.mutedForeground,
                        fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                        fontSize: 13.5,
                      }}
                    >
                      {lang === 'ar' ? s.nameAr : s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TopicSelector
              subjectId={draftSubjectId}
              gradeId="grade-10"
              value={draftTopic}
              onChange={setDraftTopic}
              onSelectionDetail={setDraftDetail}
              lang={lang as 'ar' | 'en'}
              isRTL={isRTL}
              colors={colors}
              accent={TEAL}
              t={t}
            />
            {/* Class Mode media for the lesson shown in the banner (which
                falls back to the demo lesson before the first pick). */}
            {lessonTopic.trim() ? (
              <View style={{ marginTop: 26 }}>
                {/*
                  Collapsed by default, and labelled optional.

                  Two empty full-width inputs sat between picking a lesson and
                  confirming it, taking more room and more visual weight than
                  «اعتماد الدرس» itself — so adding a link read as a required
                  step in choosing a lesson, which it never was. As one quiet
                  row it stays available without standing in the way, and the
                  «اختياري» chip says so outright rather than leaving it to be
                  inferred from a placeholder.
                */}
                <Pressable
                  onPress={() => setMediaOpen(o => !o)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: mediaOpen }}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Ionicons
                    name={mediaOpen ? 'chevron-down' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                    size={16}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: 'Cairo_600SemiBold',
                      fontSize: 14,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {t('addMediaTitle')}
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.muted,
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: 'Almarai_400Regular',
                        fontSize: 11,
                      }}
                    >
                      {t('addMediaOptional')}
                    </Text>
                  </View>
                </Pressable>
                {mediaOpen ? (
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: 'Almarai_400Regular',
                      fontSize: 12,
                      marginTop: 6,
                      marginBottom: 10,
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    {t('addMediaHint')}
                  </Text>
                ) : null}

                {media.map(m => (
                  <View
                    key={m.url}
                    style={[
                      styles.mediaRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      },
                    ]}
                  >
                    <Ionicons
                      name={m.kind === 'video' ? 'logo-youtube' : 'image-outline'}
                      size={18}
                      color={m.kind === 'video' ? '#EF4444' : TEAL}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: colors.foreground,
                        fontFamily: 'Almarai_400Regular',
                        fontSize: 12.5,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {m.caption || m.url}
                    </Text>
                    <Pressable onPress={() => { void dropMedia(m.url); }} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                ))}

                {mediaOpen ? (
                  <>
                  <TextInput
                    value={mediaUrl}
                    onChangeText={(v) => { setMediaUrl(v); setMediaError(''); }}
                    placeholder={t('addMediaPlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    style={[
                      styles.mediaInput,
                      {
                        backgroundColor: colors.card,
                        borderColor: mediaError ? '#EF4444' : colors.border,
                        color: colors.foreground,
                        textAlign: isRTL ? 'right' : 'left',
                      },
                    ]}
                  />
                  <TextInput
                    value={mediaCaption}
                    onChangeText={setMediaCaption}
                    placeholder={t('addMediaCaption')}
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.mediaInput,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        color: colors.foreground,
                        textAlign: isRTL ? 'right' : 'left',
                      },
                    ]}
                  />
                  {mediaError ? (
                    <Text
                      style={{
                        color: '#EF4444',
                        fontFamily: 'Almarai_400Regular',
                        fontSize: 12,
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {mediaError}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => { void addMedia(); }}
                    disabled={!mediaUrl.trim()}
                    style={({ pressed }) => [
                      styles.mediaAddBtn,
                      {
                        borderColor: mediaUrl.trim() ? TEAL : colors.border,
                        opacity: pressed ? 0.85 : 1,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      },
                    ]}
                  >
                    <Ionicons name="add" size={16} color={mediaUrl.trim() ? TEAL : colors.mutedForeground} />
                    <Text
                      style={{
                        color: mediaUrl.trim() ? TEAL : colors.mutedForeground,
                        fontFamily: 'Cairo_600SemiBold',
                        fontSize: 13,
                      }}
                    >
                      {t('addMediaAdd')}
                    </Text>
                  </Pressable>
                  </>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={confirmLessonPick}
              disabled={!draftTopic.trim()}
              style={({ pressed }) => [
                styles.pickerConfirm,
                {
                  backgroundColor: draftTopic.trim() ? TEAL : colors.muted,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: draftTopic.trim() ? '#fff' : colors.mutedForeground,
                  fontFamily: 'Cairo_600SemiBold',
                  fontSize: 15,
                }}
              >
                {lang === 'ar' ? 'اعتماد الدرس' : 'Set lesson'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'flex-start',
    gap: 10,
  },
  greet: { fontSize: 20, letterSpacing: -0.2 },

  sectionPad: { paddingHorizontal: 20, paddingTop: 8 },
  section: { paddingHorizontal: 20, paddingTop: 22, gap: 12 },
  sectionTitle: { fontSize: 16 },

  contextBanner: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contextBody: {
    gap: 4,
    width: '100%',
  },
  contextFlag: { color: NAVY, fontSize: 13 },
  contextMeta: { fontSize: 12 },
  contextLesson: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  changeLessonBtn: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: TEAL,
    marginTop: 8,
  },
  changeLessonBtnText: {
    color: '#fff',
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12.5,
  },
  contextActions: { alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  coachCard: { borderRadius: 16, padding: 16, gap: 10 },
  coachHead: { alignItems: 'center', gap: 7, marginBottom: 2 },
  coachTitle: { color: '#fff', fontSize: 15, flex: 1 },
  coachRow: { alignItems: 'flex-start', gap: 10 },
  coachNum: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  coachNumText: { color: '#fff', fontSize: 11 },
  coachStep: { color: 'rgba(255,255,255,0.86)', fontSize: 12.5, lineHeight: 19, flex: 1 },
  coachBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
  },
  coachBtnText: { color: '#fff', fontSize: 13 },
  mediaBadge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: 8,
  },
  mediaRow: {
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  mediaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Almarai_400Regular',
    fontSize: 13,
    marginBottom: 8,
  },
  mediaAddBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 11,
  },
  startClassBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#B45309',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  startClassBtnText: {
    color: '#fff',
    fontFamily: 'Cairo_700Bold',
    fontSize: 12.5,
  },
  pickerHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  pickerConfirm: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
  },

  hero: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  heroTitle: { color: '#fff', fontSize: 22, letterSpacing: -0.3, lineHeight: 30 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 21 },
  promptBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    gap: 10,
    minHeight: 110,
  },
  promptInput: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 64,
    paddingTop: 4,
    width: '100%',
  },
  promptSend: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestWrap: {
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  suggestChip: {
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    paddingVertical: 6,
    borderRadius: 22,
  },
  suggestIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestEmoji: { fontSize: 13 },
  suggestChipText: { color: '#fff', fontSize: 12.5, letterSpacing: -0.1 },

  toolsGrid: { flexWrap: 'wrap', gap: 10 },
  toolCard: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    maxWidth: '32.5%',
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  toolEmoji: { fontSize: 24 },
  toolLabel: { fontSize: 12, lineHeight: 16 },

  continueRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 12,
  },
  continueBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    gap: 4,
  },

  templateRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 10,
  },

  recentRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    backgroundColor: 'rgba(0,169,157,0.10)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { color: TEAL, fontSize: 11 },
});
