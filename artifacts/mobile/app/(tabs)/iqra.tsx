import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

/** Safe when NativeTabs (or non-tab hosts) omit BottomTabBarHeight context. */
function useSafeTabBarHeight(): number {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useBottomTabBarHeight();
  } catch {
    return 0;
  }
}
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  KBLesson,
  getLessonById,
  getTopicSuggestions,
  KB_CONFIDENT_SCORE,
  searchKBRanked,
  searchKBSemantic,
} from '@/services/knowledgeBase';
import { getPickerSubjects } from '@/services/curriculumData';
import { loadLessonPick, saveLessonPick } from '@/services/lessonContext';
import {
  buildResponse,
  deduplicateByUnit,
  detectSubjectAmbiguity,
  filterResultsBySubject,
} from '@/services/kbContext';
import { Toast } from '@/components/ui/Toast';
import { remoteAIService } from '@/services/ai/RemoteAIService';
import { DEMO_MODE } from '@/services/ai/demoMode';
import {
  generateChatArtifact,
  resolveArtifactTopic,
} from '@/services/ai/chatArtifacts';
import {
  buildPrepProgressView,
  buildTeachingAssistantReply,
  emptyChatSessionMemory,
  isReferentialQuery,
  artifactFromQuery,
  recordGeneratedResource,
  type ChatSessionMemory,
  type ClarificationOption,
  type PrepProgressView,
  type SessionArtifact,
  type TeachingAction,
} from '@/services/ai/teachingAssistant';
import { classifyChatIntent } from '@/services/ai/intentRouter';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { DemoModeBanner } from '@/components/ui/DemoModeBanner';
import { CurrentLessonCard } from '@/components/ui/CurrentLessonCard';
import { ChatEmptyState, type StarterCard } from '@/components/ui/ChatEmptyState';
import { RichMessageText } from '@/components/ui/RichMessageText';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { CHAT_BUBBLE_MAX_WIDTH, CHAT_MAX_WIDTH } from '@/constants/layout';
import { DocumentAttachButtons, DocumentAttachmentBar } from '@/components/ui/DocumentAttachmentBar';
import { ExportMenu } from '@/components/ui/ExportMenu';
import {
  addAndProcessFiles,
  clearSessionDocuments,
  getDocumentContextBundle,
  getSessionDocuments,
  pickTeachingDocuments,
  primaryTopicFromDocuments,
  subscribeSessionDocuments,
  type SessionDocument,
} from '@/services/documents';
import {
  buildCurrentLessonView,
  buildLessonSuggestions,
  isBareArtifactShortcut,
  isConfidentKbHit,
  pinLesson,
  resourceRoute,
  seedDefaultLessonMemory,
  shouldReuseActiveLesson,
  type LessonSuggestion,
} from '@/services/lessonCopilot';
import {
  copyToClipboard,
  exportAsPDF,
  exportAsWord,
  shareAsText,
} from '@/services/share';

function promptForTeachingAction(
  type: TeachingAction['type'],
  topic: string,
  lang: 'ar' | 'en',
): string {
  const prompts: Record<TeachingAction['type'], { ar: string; en: string }> = {
    'lesson-plan': {
      ar: `حضّر خطة درس كاملة عن: ${topic}`,
      en: `Prepare a full lesson plan about: ${topic}`,
    },
    worksheet: {
      ar: `أنشئ ورقة عمل صفية عن: ${topic}`,
      en: `Create an in-class worksheet about: ${topic}`,
    },
    homework: {
      ar: `أنشئ واجباً منزلياً عن: ${topic}`,
      en: `Create homework about: ${topic}`,
    },
    quiz: {
      ar: `جهّز اختباراً قصيراً عن: ${topic}`,
      en: `Create a short quiz about: ${topic}`,
    },
    activity: {
      ar: `اقترح نشاطاً صفياً عن: ${topic}`,
      en: `Suggest a classroom activity about: ${topic}`,
    },
  };
  return prompts[type][lang];
}

function ephemeralFromTeachingActions(
  actions: TeachingAction[],
  topic: string,
  lang: 'ar' | 'en',
): EphemeralSuggestion[] {
  return actions.map(action => ({
    id: `ta-${action.type}`,
    label: `${action.emoji} ${lang === 'ar' ? action.labelAr : action.labelEn}`,
    prompt: promptForTeachingAction(action.type, topic, lang),
    toolType: action.type,
  }));
}

// ─── Types ──────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant';
type Mode = 'teacher' | 'student';

type ChatAttachment = {
  id: string;
  name: string;
  kind: string;
};

interface Message {
  id: string;
  role: Role;
  text: string;
  sources?: KBLesson[];
  /** Topic used for generator navigation — not rendered as chips in the timeline. */
  lessonTopic?: string;
  quickTopic?: string;
  /** Kept for prep logic; action chips are ephemeral (composer), not in-bubble. */
  teachingActions?: TeachingAction[];
  curriculumLessonId?: string;
  subjectColor?: string;
  /** Out-of-scope topic suggestions (ephemeral — only last assistant uses them via composer). */
  suggestions?: { text: string; lessonId: string }[];
  clarificationSubjects?: string[];
  pedagogicalClarification?: ClarificationOption[];
  clarificationQuery?: string;
  showLessonPrep?: boolean;
  /** File / image attachments shown inside a user bubble. */
  attachments?: ChatAttachment[];
  timestamp: Date;
}

/** One-shot shortcuts under the composer — never stored inside message bubbles. */
type EphemeralSuggestion = {
  id: string;
  label: string;
  prompt: string;
  lessonId?: string;
  subjectColor?: string;
  toolType?: 'worksheet' | 'quiz' | 'lesson-plan' | 'activity' | 'homework';
};

// ─── Teaching-context subject options (investor MVP: Grade 10 Math only) ─────
// All MVP subjects with KB content — kept in lockstep with the home picker
// (was hardcoded to mathematics only, which is why the chat's change-lesson
// sheet showed a single subject while home showed three).
const CONTEXT_SUBJECTS = getPickerSubjects().map(s => ({
  subjectId: s.id,
  gradeId: 'grade-10',
  labelAr: s.nameAr,
  labelEn: s.name,
}));

// ─── Suggested questions per mode/language ───────────────────────────────────
interface Suggestion {
  text: string;
  /** When set, tapping this chip bypasses search and fetches the lesson directly. */
  lessonId?: string;
}

const SUGGESTIONS: Record<Mode, Record<'ar' | 'en', Suggestion[]>> = {
  teacher: {
    ar: [
      { text: 'ما هو الاقتران العكسي؟',               lessonId: 'kbl-math-s2-nccd-u5_l4' },
      { text: 'اشرح قواعد الاشتقاق',                  lessonId: 'kbl-math-s2-nccd-u6_l2' },
      { text: 'قاعدة الاحتمال للحوادث المتنافية',     lessonId: 'kbl-math-s2-nccd-u8_l4' },
      { text: 'ما هو تركيب الاقترانات؟',              lessonId: 'kbl-math-s2-nccd-u5_l3' },
      { text: 'كيف أقدّر ميل المنحنى؟',               lessonId: 'kbl-math-s2-nccd-u6_l1' },
      { text: 'ما هي المتجهات في المستوى الإحداثي؟',  lessonId: 'kbl-math-s2-nccd-u7_l1' },
    ],
    en: [
      { text: 'What is an inverse function?',           lessonId: 'kbl-math-s2-nccd-u5_l4' },
      { text: 'Explain differentiation rules',          lessonId: 'kbl-math-s2-nccd-u6_l2' },
      { text: 'Probability of mutually exclusive events', lessonId: 'kbl-math-s2-nccd-u8_l4' },
      { text: 'What is function composition?',          lessonId: 'kbl-math-s2-nccd-u5_l3' },
      { text: 'How do I estimate the slope of a curve?', lessonId: 'kbl-math-s2-nccd-u6_l1' },
      { text: 'What are vectors in the coordinate plane?', lessonId: 'kbl-math-s2-nccd-u7_l1' },
    ],
  },
  student: {
    ar: [
      { text: 'كيف أجد مجال الاقتران النسبي؟',        lessonId: 'kbl-math-s2-nccd-u5_l2' },
      { text: 'كيف أجد المشتقة؟',                     lessonId: 'kbl-math-s2-nccd-u6_l2' },
      { text: 'كيف أحل مسائل الاحتمال؟',              lessonId: 'kbl-math-s2-nccd-u8_l4' },
      { text: 'ما هو الاقتران العكسي؟',               lessonId: 'kbl-math-s2-nccd-u5_l4' },
      { text: 'كيف أجد القيم العظمى والصغرى؟',       lessonId: 'kbl-math-s2-nccd-u6_l3' },
      { text: 'ما هي أشكال الانتشار؟',                lessonId: 'kbl-math-s2-nccd-u8_l1' },
    ],
    en: [
      { text: 'How to find the domain of a rational function?', lessonId: 'kbl-math-s2-nccd-u5_l2' },
      { text: 'How do I find a derivative?',            lessonId: 'kbl-math-s2-nccd-u6_l2' },
      { text: 'How do I solve probability problems?',   lessonId: 'kbl-math-s2-nccd-u8_l4' },
      { text: 'What is an inverse function?',           lessonId: 'kbl-math-s2-nccd-u5_l4' },
      { text: 'How do I find max and min values?',      lessonId: 'kbl-math-s2-nccd-u6_l3' },
      { text: 'What are scatter plots?',                lessonId: 'kbl-math-s2-nccd-u8_l1' },
    ],
  },
};

// ─── Context Banner ───────────────────────────────────────────────────────────
function ContextBanner({
  colors, isRTL, lang, t, onContextChange, onAsk, hidePill, externalOpen, onExternalOpenChange, onGlobalPick,
}: {
  colors: any; isRTL: boolean; lang: 'ar' | 'en';
  t: (k: any) => string;
  onContextChange: (ctx: string) => void;
  onAsk: (topic: string) => void;
  /** When true, only the change-lesson modal is rendered (card owns the chrome). */
  hidePill?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  /** Confirmed picks propagate to the app-wide current-lesson context. */
  onGlobalPick?: (pick: { topic: string; subjectId: string }) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [subjIdx, setSubjIdx] = useState(0);
  const [topic, setTopicInternal] = useState('');
  // Draft topic while modal is open; only committed on confirm
  const [draftTopic, setDraftTopic] = useState('');
  const [draftSubjIdx, setDraftSubjIdx] = useState(0);

  const subj = CONTEXT_SUBJECTS[draftSubjIdx];
  const isOpen = externalOpen ?? modalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setModalOpen(v);
  };

  const openModal = () => {
    setDraftTopic(topic);
    setDraftSubjIdx(subjIdx);
    setOpen(true);
  };

  useEffect(() => {
    if (externalOpen) {
      setDraftTopic(topic);
      setDraftSubjIdx(subjIdx);
    }
  }, [externalOpen]);

  const handleConfirm = () => {
    setSubjIdx(draftSubjIdx);
    setTopicInternal(draftTopic);
    onContextChange(draftTopic);
    setOpen(false);
    if (draftTopic.trim()) {
      onGlobalPick?.({ topic: draftTopic.trim(), subjectId: subj.subjectId });
      onAsk(draftTopic.trim());
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleClear = () => {
    setTopicInternal('');
    setSubjIdx(0);
    onContextChange('');
  };

  return (
    <>
      {/* ── Compact pill shown in header (optional — CurrentLessonCard replaces it) ── */}
      {!hidePill ? (
      <View style={[ctxStyles.container, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
        <View style={[ctxStyles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16, paddingVertical: 8 }]}>
          <Pressable
            onPress={openModal}
            style={[ctxStyles.pill, {
              backgroundColor: topic ? colors.primary + '18' : colors.muted,
              borderColor: topic ? colors.primary + '50' : colors.border,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flex: 1,
            }]}
          >
            <Ionicons name="location-outline" size={13} color={topic ? colors.primary : colors.mutedForeground} />
            <Text
              numberOfLines={1}
              style={[ctxStyles.pillText, {
                color: topic ? colors.primary : colors.mutedForeground,
                fontFamily: topic ? 'Inter_500Medium' : 'Inter_400Regular',
                textAlign: isRTL ? 'right' : 'left',
                flex: 1,
              }]}
            >
              {topic ? `${t('currentlyTeaching')}: ${topic}` : t('setTeachingContext')}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.mutedForeground} style={{ marginStart: 4 }} />
          </Pressable>
          {topic ? (
            <Pressable onPress={handleClear} hitSlop={8} style={ctxStyles.clearBtn}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>
      ) : null}

      {/* ── Full-screen Modal with scrollable picker + CTA ── */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <View style={[ctxStyles.modal, { backgroundColor: colors.background }]}>
          {/* Modal header */}
          <View style={[ctxStyles.modalHeader, { borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable onPress={handleCancel} hitSlop={10} style={ctxStyles.modalCancel}>
              <Text style={[ctxStyles.modalCancelText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Text>
            </Pressable>
            <Text style={[ctxStyles.modalTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
              {t('setTeachingContext')}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Scrollable body */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={ctxStyles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Subject pills */}
            <Text style={[ctxStyles.modalSectionLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {lang === 'ar' ? 'المادة' : 'Subject'}
            </Text>
            <View style={[ctxStyles.subjRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {CONTEXT_SUBJECTS.map((s, i) => (
                <Pressable
                  key={s.subjectId}
                  onPress={() => { setDraftSubjIdx(i); setDraftTopic(''); }}
                  style={[ctxStyles.subjPill, {
                    backgroundColor: draftSubjIdx === i ? colors.primary : colors.muted,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: draftSubjIdx === i ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={[ctxStyles.subjText, {
                    color: draftSubjIdx === i ? colors.primaryForeground : colors.mutedForeground,
                    fontFamily: draftSubjIdx === i ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  }]}>
                    {lang === 'ar' ? s.labelAr : s.labelEn}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Topic selector */}
            <Text style={[ctxStyles.modalSectionLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left', marginTop: 18 }]}>
              {lang === 'ar' ? 'الدرس' : 'Lesson'}
            </Text>
            <TopicSelector
              subjectId={subj.subjectId}
              gradeId={subj.gradeId}
              value={draftTopic}
              onChange={setDraftTopic}
              lang={lang}
              isRTL={isRTL}
              colors={colors}
              accent={colors.primary}
              t={t}
            />
          </ScrollView>

          {/* CTA at bottom */}
          <View style={[ctxStyles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              onPress={handleConfirm}
              disabled={!draftTopic.trim()}
              style={({ pressed }) => [
                ctxStyles.askBtn,
                {
                  backgroundColor: draftTopic.trim() ? colors.primary : colors.muted,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={draftTopic.trim() ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[ctxStyles.askBtnText, {
                color: draftTopic.trim() ? colors.primaryForeground : colors.mutedForeground,
                fontFamily: 'Inter_700Bold',
              }]}>
                {draftTopic.trim()
                  ? (lang === 'ar' ? `ابدأ التحضير: ${draftTopic}` : `Ask IQRA about: ${draftTopic}`)
                  : (lang === 'ar' ? 'اختر الدرس أولاً' : 'Select a lesson first')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
// Subject label map for clarification chips
const SUBJECT_LABELS: Record<string, { ar: string; en: string; icon: string }> = {
  mathematics: { ar: 'الرياضيات', en: 'Mathematics', icon: '📐' },
  chemistry:   { ar: 'الكيمياء',  en: 'Chemistry',   icon: '🧪' },
};

/** Compact guided preparation checklist — Demo Mode, session-only. */
function LessonPrepProgressCard({
  progress,
  colors,
  isRTL,
}: {
  progress: PrepProgressView;
  colors: any;
  isRTL: boolean;
}) {
  if (progress.allReady) {
    return (
      <View
        style={[
          prepStyles.card,
          { backgroundColor: colors.success + '1A', borderColor: colors.success + '55' },
        ]}
      >
        <Text
          style={[
            prepStyles.readyText,
            { color: colors.success, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          {isRTL ? '🎉 الدرس جاهز للتدريس.' : '🎉 The lesson is ready to teach.'}
        </Text>
        {progress.recommendation ? (
          <Text
            style={[
              prepStyles.recommend,
              { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
            ]}
          >
            {progress.recommendation}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        prepStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text
        style={[
          prepStyles.heading,
          { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
        ]}
      >
        {isRTL ? 'ما أنجزناه:' : 'Completed:'}
      </Text>
      {progress.done.map(item => (
        <View key={item.id} style={[prepStyles.itemRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text
            style={[
              prepStyles.line,
              { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr', flex: 1 },
            ]}
          >
            {item.label}
          </Text>
        </View>
      ))}
      {progress.remaining.length > 0 ? (
        <>
          <Text
            style={[
              prepStyles.heading,
              {
                color: colors.foreground,
                marginTop: 8,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            {isRTL ? 'ما تبقّى للحصة:' : 'Still needed for the lesson:'}
          </Text>
          {progress.remaining.map(item => (
            <View key={item.id} style={[prepStyles.itemRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="ellipse-outline" size={13} color={colors.mutedForeground} />
              <Text
                style={[
                  prepStyles.line,
                  { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr', flex: 1 },
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </>
      ) : null}
      {progress.recommendation ? (
        <Text
          style={[
            prepStyles.recommend,
            { color: colors.primary, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          {progress.recommendation}
        </Text>
      ) : null}
    </View>
  );
}

const prepStyles = StyleSheet.create({
  card: {
    marginTop: 8,
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  heading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginBottom: 2,
  },
  line: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  itemRow: { alignItems: 'center', gap: 6, marginVertical: 1 },
  recommend: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  readyText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    lineHeight: 20,
  },
});

function MessageBubble({
  message, colors, isRTL, onLongPress, onClarifySubject, onPedagogicalClarify, prepProgress,
  isGroupStart = true, onCopy, onExport, copyLabel, exportLabel,
}: {
  message: Message; colors: any; isRTL: boolean;
  onLongPress?: (text: string) => void;
  onClarifySubject?: (originalQuery: string, subjectId: string) => void;
  onPedagogicalClarify?: (originalQuery: string, option: ClarificationOption) => void;
  /** Live session prep progress — shown under the latest meaningful reply. */
  prepProgress?: PrepProgressView | null;
  /** First message of a same-author run — only that one carries the avatar. */
  isGroupStart?: boolean;
  onCopy?: (text: string) => void;
  onExport?: (text: string) => void;
  copyLabel?: string;
  exportLabel?: string;
}) {
  const isUser = message.role === 'user';
  const timeLabel = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const enterStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  if (isUser) {
    // User bubbles always sit on the trailing edge (right) — ChatGPT/WhatsApp style.
    // Do NOT flip justifyContent for RTL (that was pinning bubbles to the far left).
    return (
      <Animated.View style={[styles.rowUser, enterStyle]}>
        <View style={[styles.bubbleUser, { backgroundColor: colors.primary }]}>
          {message.attachments && message.attachments.length > 0 ? (
            <View style={[styles.attachList, isRTL && { alignItems: 'flex-end' }]}>
              {message.attachments.map(a => (
                <View
                  key={a.id}
                  style={[styles.attachChip, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
                >
                  <Ionicons
                    name={a.kind === 'image' ? 'image-outline' : 'document-outline'}
                    size={14}
                    color={colors.primaryForeground}
                  />
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.primaryForeground, fontFamily: 'Inter_500Medium', fontSize: 12, maxWidth: 180 }}
                  >
                    {a.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {message.text ? (
            <Text style={[styles.bubbleText, { color: colors.primaryForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
              {message.text}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.timestampOutside, { color: colors.mutedForeground }]}>{timeLabel}</Text>
      </Animated.View>
    );
  }

  // Assistant — avatar + bubble only. Tool shortcuts live in the composer (ephemeral).
  return (
    <Animated.View style={[styles.rowAssistant, isRTL && styles.rowAssistantRTL, enterStyle]}>
      {isGroupStart ? (
        <View style={[styles.avatar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <BrandLogo variant="mark" width={20} height={18} />
        </View>
      ) : (
        <View style={styles.avatarSpacer} />
      )}
      <View style={{ flex: 1, maxWidth: CHAT_BUBBLE_MAX_WIDTH, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <Pressable
          onLongPress={() => onLongPress?.(message.text)}
          delayLongPress={500}
          style={[styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <RichMessageText text={message.text} colors={colors} isRTL={isRTL} />
        </Pressable>

        {/* Message actions — long-press alone was undiscoverable, especially on web */}
        <View style={[styles.msgActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.timestampOutside, { color: colors.mutedForeground }]}>{timeLabel}</Text>
          {message.text.trim().length > 40 ? (
            <>
              <Pressable
                onPress={() => onCopy?.(message.text)}
                hitSlop={6}
                style={({ pressed }) => [styles.msgActionBtn, { opacity: pressed ? 0.6 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                accessibilityRole="button"
                accessibilityLabel={copyLabel}
              >
                <Ionicons name="copy-outline" size={13} color={colors.mutedForeground} />
                <Text style={[styles.msgActionText, { color: colors.mutedForeground }]}>{copyLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => onExport?.(message.text)}
                hitSlop={6}
                style={({ pressed }) => [styles.msgActionBtn, { opacity: pressed ? 0.6 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                accessibilityRole="button"
                accessibilityLabel={exportLabel}
              >
                <Ionicons name="share-outline" size={13} color={colors.mutedForeground} />
                <Text style={[styles.msgActionText, { color: colors.mutedForeground }]}>{exportLabel}</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* Clarification choices only — these are part of the dialogue turn, not tool launchers */}
        {message.clarificationSubjects && message.clarificationSubjects.length > 0 && (
          <View style={[styles.suggestionChipsRow, isRTL && { flexDirection: 'row-reverse' }]}>
            {message.clarificationSubjects.map((subjectId) => {
              const labels = SUBJECT_LABELS[subjectId];
              if (!labels) return null;
              const label = `${labels.icon} ${isRTL ? labels.ar : labels.en}`;
              return (
                <Pressable
                  key={subjectId}
                  onPress={() => onClarifySubject?.(message.clarificationQuery!, subjectId)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    {
                      backgroundColor: colors.primary + '18',
                      borderColor: colors.primary + '70',
                      opacity: pressed ? 0.7 : 1,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    },
                  ]}
                >
                  <Text style={[styles.suggestionChipText, { color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {message.pedagogicalClarification && message.pedagogicalClarification.length > 0 && (
          <View style={[styles.suggestionChipsRow, isRTL && { flexDirection: 'row-reverse' }]}>
            {message.pedagogicalClarification.map(option => (
              <Pressable
                key={option.id}
                onPress={() => onPedagogicalClarify?.(message.clarificationQuery ?? '', option)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  {
                    backgroundColor: colors.primary + '18',
                    borderColor: colors.primary + '70',
                    opacity: pressed ? 0.7 : 1,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  },
                ]}
              >
                <Text style={[styles.suggestionChipText, { color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13 }]}>
                  {isRTL ? option.labelAr : option.labelEn}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {prepProgress && message.showLessonPrep ? (
          <LessonPrepProgressCard progress={prepProgress} colors={colors} isRTL={isRTL} />
        ) : null}
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function IqraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeTabBarHeight();
  const { t, lang, isRTL } = useLanguage();
  const params = useLocalSearchParams<{
    initialMessage?: string;
    lessonId?: string;
    subjectColor?: string;
  }>();

  const [mode, setMode] = useState<Mode>('teacher');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [teachingCtx, setTeachingCtx] = useState('');
  /** Session memory for collaborative Demo Mode chat (active lesson + prior asks). */
  const [sessionMemory, setSessionMemory] = useState<ChatSessionMemory>(() =>
    seedDefaultLessonMemory(emptyChatSessionMemory()),
  );
  const [sessionDocs, setSessionDocs] = useState<SessionDocument[]>(() => getSessionDocuments());
  /** Composer-only shortcuts — cleared as soon as the teacher taps one or sends a message. */
  const [ephemeralSuggestions, setEphemeralSuggestions] = useState<EphemeralSuggestion[]>([]);
  /** Status line while the assistant is working (lesson plan vs generic). */
  const [thinkingLabel, setThinkingLabel] = useState('');
  const [lessonCardCollapsed, setLessonCardCollapsed] = useState(false);
  const [changeLessonOpen, setChangeLessonOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [exportVisible, setExportVisible] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingWord, setLoadingWord] = useState(false);
  // Deep-link state: curriculum lesson to surface as "Open lesson" chip
  const [deepLinkLessonId, setDeepLinkLessonId] = useState<string | null>(params.lessonId ?? null);
  const [deepLinkColor, setDeepLinkColor] = useState<string | null>(params.subjectColor ?? null);
  // Auto-send: initial message from deep-link, fired once after welcome message appears
  const [autoMessagePending, setAutoMessagePending] = useState<string | null>(params.initialMessage ?? null);
  const [inputFocused, setInputFocused] = useState(false);
  /** Hides the "jump to latest" pill while the teacher is reading the newest turn. */
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<FlatList>(null);
  /** Guards duplicate sends without relying on a stale useCallback closure. */
  const thinkingRef = useRef(false);
  /** Mirrors `atBottom` for callbacks that must not re-subscribe on every scroll. */
  const atBottomRef = useRef(true);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 720;
  /** Centred column on desktop web; full-bleed on phones. */
  const centered = useMemo(
    () => ({ width: '100%' as const, maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' as const }),
    [],
  );

  // Web has no notch and no native header — the 67pt allowance left a band of
  // dead space above the brand row in the browser.
  const topPad = insets.top > 0
    ? insets.top
    : (Platform.OS === 'web' ? 14 : 67);

  // Welcome message on mount / language change — reset session, keep one default active lesson
  useEffect(() => {
    setSessionMemory(seedDefaultLessonMemory(emptyChatSessionMemory()));
    clearSessionDocuments();
    setEphemeralSuggestions([]);
    setLessonCardCollapsed(false);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: t('iqraWelcomeDocs'),
        timestamp: new Date(),
      },
    ]);
  }, [lang, t]);

  // Adopt the app-wide "current lesson" (picked on home) as the chat's
  // starting context — overriding the demo seed above, so home, tools and
  // chat all agree on one lesson. Runs after the seed effect (declaration
  // order) and again on language change, which re-seeds.
  useEffect(() => {
    void loadLessonPick().then(pick => {
      if (!pick?.topic) return;
      setTeachingCtx(prev => (prev.trim() ? prev : pick.topic));
      const hits = searchKBSemantic(pick.topic, lang as 'ar' | 'en');
      if (hits[0]) {
        setSessionMemory(prev => pinLesson(prev, hits[0]!, 'soft'));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    setSessionDocs(getSessionDocuments());
    return subscribeSessionDocuments(() => setSessionDocs(getSessionDocuments()));
  }, []);

  const handleDocumentsReady = useCallback((docs: SessionDocument[]) => {
    if (!docs.length) return;
    const names = docs.map(d => d.name).join(lang === 'ar' ? '، ' : ', ');
    const topic = primaryTopicFromDocuments(docs, names);
    const stamp = Date.now();
    const uploadMsg: Message = {
      id: `docs-upload-${stamp}`,
      role: 'user',
      text: lang === 'ar' ? 'رفعت الملفات التالية' : 'Uploaded the following files',
      attachments: docs.map(d => ({
        id: d.id,
        name: d.name,
        kind: d.kind,
      })),
      timestamp: new Date(),
    };
    const note: Message = {
      id: `docs-ready-${stamp}`,
      role: 'assistant',
      text: t('docReadyMessage', names),
      timestamp: new Date(),
      quickTopic: topic,
    };
    setMessages(prev => {
      const withoutPrior = prev.filter(
        m => !m.id.startsWith('docs-ready-') && !m.id.startsWith('docs-upload-'),
      );
      return [...withoutPrior, uploadMsg, note];
    });
    // Bias session topic toward uploads so "خطة درس" uses the file, not the soft-pinned lesson
    setSessionMemory(prev => ({
      ...prev,
      activeTopicAr: topic,
      activeTopicEn: topic,
      lessonPin: prev.lessonPin === 'hard' ? 'hard' : 'soft',
    }));
    setSessionDocs(getSessionDocuments());
    atBottomRef.current = true;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
  }, [lang, t]);

  // Sync deep-link params whenever the tab is navigated to with new params.
  // Tab screens stay mounted, so useState initializers only run once — this
  // effect re-applies fresh params each time the user taps "Ask iQra" on a
  // different lesson without unmounting the screen.
  useEffect(() => {
    if (params.initialMessage) {
      setDeepLinkLessonId(params.lessonId ?? null);
      setDeepLinkColor(params.subjectColor ?? null);
      setAutoMessagePending(params.initialMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.initialMessage, params.lessonId, params.subjectColor]);

  const sendMessage = useCallback(
    async (
      text: string,
      pinnedLessonId?: string,
      scopeSubjectId?: string,
      attachments?: ChatAttachment[],
    ) => {
      const q = text.trim();
      if (!q && !(attachments && attachments.length)) return;
      if (thinkingRef.current) {
        showToast(t('iqraChatBusy'));
        return;
      }

      setInput('');
      setEphemeralSuggestions([]);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Capture and consume the deep-link state so "Open lesson" chip appears once
      const msgLessonId = deepLinkLessonId;
      const msgColor    = deepLinkColor;
      setDeepLinkLessonId(null);
      setDeepLinkColor(null);

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: q,
        attachments,
        timestamp: new Date(),
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      if (!q) {
        atBottomRef.current = true;
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      thinkingRef.current = true;
      setIsThinking(true);

      // Demo-mode replies are near-instant, which makes the thinking bubble
      // flash imperceptibly. A short dwell keeps the "اقرأ يكتب…" moment
      // visible; real AI latency will replace this entirely.
      if (DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 750));
      }

      // 0. Intent Router — BEFORE curriculum context / Teaching Assistant.
      //    Greetings & small talk must never trigger lesson generation.
      const route = classifyChatIntent(q, lang as 'ar' | 'en');
      if (route.intent === 'artifact') {
        setThinkingLabel(
          /خطة|lesson\s*plan/i.test(q) ? t('iqraGeneratingLessonPlan') : t('iqraGeneratingArtifact'),
        );
      } else {
        setThinkingLabel(t('iqraTyping'));
      }

      try {
      if (!route.useTeachingPipeline) {
        const socialMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: route.socialReply ?? t('iqraOutOfScope'),
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, socialMsg]);
        return;
      }

      // Docs first — soft-pinned curriculum must not steal uploaded materials.
      const docBundleEarly = getDocumentContextBundle(lang as 'ar' | 'en');
      const hasDocsEarly =
        docBundleEarly.readyCount > 0 && !!docBundleEarly.promptBlock.trim();

      // 1. Local KB retrieval — confidence-gated; soft default lesson must not steal topics.
      const ranked = pinnedLessonId
        ? []
        : searchKBRanked(q, lang as 'ar' | 'en');
      const confidentHit = isConfidentKbHit(ranked);

      let results: KBLesson[];
      if (pinnedLessonId) {
        const pinned = getLessonById(pinnedLessonId);
        results = pinned
          ? [pinned]
          : deduplicateByUnit(searchKBSemantic(q, lang as 'ar' | 'en'), 3);
      } else {
        results = deduplicateByUnit(
          ranked.length ? ranked.map(r => r.lesson) : searchKBSemantic(q, lang as 'ar' | 'en'),
          3,
        );
      }

      // Prefer explicit teaching-context lesson when available
      if (!pinnedLessonId && teachingCtx.trim()) {
        const ctxHits = searchKBSemantic(teachingCtx.trim(), lang as 'ar' | 'en');
        if (ctxHits[0]) {
          results = [ctxHits[0], ...results.filter(r => r.id !== ctxHits[0]!.id)].slice(0, 3);
        }
      }

      // Reuse active lesson only when pin strength + intent allow it
      const reuseActive = shouldReuseActiveLesson({
        memory: sessionMemory,
        intent: route.intent,
        query: q,
        hasConfidentKbHit: confidentHit,
        hasDocuments: hasDocsEarly,
      });
      if (!pinnedLessonId && reuseActive && sessionMemory.activeLessonId) {
        const active = getLessonById(sessionMemory.activeLessonId);
        if (active) {
          results = [active, ...results.filter(r => r.id !== active.id)].slice(0, 3);
        }
      }

      // With uploads + soft pin only: clear KB results so generators/TA ground on documents
      if (
        hasDocsEarly
        && !pinnedLessonId
        && sessionMemory.lessonPin !== 'hard'
        && !confidentHit
      ) {
        results = [];
      }

      // Confident KB hit on a different lesson → treat as hard pin going forward
      let pendingHardPin: KBLesson | null = null;
      if (
        !pinnedLessonId
        && confidentHit
        && ranked[0]
        && ranked[0].lesson.id !== sessionMemory.activeLessonId
        && !isReferentialQuery(q)
        && route.intent !== 'refinement'
      ) {
        pendingHardPin = ranked[0].lesson;
        results = [ranked[0].lesson, ...results.filter(r => r.id !== ranked[0]!.lesson.id)].slice(0, 3);
      }

      // Refinement with no prior lesson context → ask, don't invent a topic
      if (
        route.intent === 'refinement'
        && !pinnedLessonId
        && !sessionMemory.activeLessonId
        && !teachingCtx.trim()
        && results.length === 0
      ) {
        const clarifyMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: lang === 'ar'
            ? 'بكل سرور — أي درس أو مادة تريد أن نعدّل فيها؟'
            : 'Happy to refine — which lesson or material should I adjust?',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, clarifyMsg]);
        return;
      }

      // Scope to a specific subject when the teacher answered a clarification chip
      if (scopeSubjectId) {
        results = filterResultsBySubject(results, scopeSubjectId);
      }

      // 1b. Ambiguity check — only when nothing is pinned (soft default does not count)
      const hasHardContext = Boolean(
        pinnedLessonId
        || scopeSubjectId
        || teachingCtx
        || sessionMemory.lessonPin === 'hard',
      );
      if (!hasHardContext && results.length > 0) {
        const ambiguousSubjects = detectSubjectAmbiguity(results);
        if (ambiguousSubjects) {
          const clarifyMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: t('iqraClarifySubject'),
            clarificationSubjects: ambiguousSubjects,
            clarificationQuery: q,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, clarifyMsg]);
          return;
        }
      }

      const hasKBMatch = results.length > 0;
      const docBundle = docBundleEarly;
      const hasDocs = hasDocsEarly;
      const docNames = docBundle.documents
        .filter(d => d.status === 'ready')
        .map(d => d.name);

      // 2. Build KB + document context for remote path
      const teachingPrefix = teachingCtx
        ? (lang === 'ar'
          ? `[سياق التدريس: المعلم يدرّس حاليًا "${teachingCtx}"]\n\n`
          : `[Teaching context: Teacher is currently teaching "${teachingCtx}"]\n\n`)
        : '';

      const kbPart = hasKBMatch
        ? teachingPrefix + buildResponse(q, results, lang as 'ar' | 'en', mode)
        : (teachingCtx ? teachingPrefix.trim() : '');
      const kbContext = [docBundle.promptBlock, kbPart].filter(Boolean).join('\n\n') || undefined;

      // 3. Build conversation history (last 10 messages for context window)
      const history = updatedMessages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }));

      let responseText: string;
      let outOfScopeSuggestions: { text: string; lessonId: string }[] | undefined;
      let teachingActions: TeachingAction[] | undefined;
      let pedagogicalClarification: ClarificationOption[] | undefined;
      let clarificationQuery: string | undefined;
      let lessonTopic: string | undefined;
      let quickTopic: string | undefined;

      const runTeachingAssistant = () =>
        buildTeachingAssistantReply({
          query: q,
          lessons: results,
          lang: lang as 'ar' | 'en',
          mode,
          teachingContext: teachingCtx || sessionMemory.activeTopicAr || sessionMemory.activeTopicEn,
          memory: sessionMemory,
          documentContext: hasDocs ? docBundle.promptBlock : null,
          documentNames: docNames,
          routeIntent:
            route.intent === 'artifact' || route.intent === 'refinement' || route.intent === 'teaching'
              ? route.intent
              : 'teaching',
        });

      const artifactType =
        artifactFromQuery(q)
        ?? (route.intent === 'refinement' ? sessionMemory.lastGeneratedResource : null);

      const softBareArtifact =
        route.intent === 'artifact'
        && isBareArtifactShortcut(q)
        && sessionMemory.lessonPin === 'soft'
        && !!sessionMemory.activeLessonId
        && !confidentHit
        && !hasDocs;

      if (!hasKBMatch && !hasDocs && !(softBareArtifact && artifactType)) {
        // Artifact shortcuts like "خطة" must not die silently — ask for the lesson topic.
        if (route.intent === 'artifact') {
          responseText = t('iqraArtifactNeedTopic');
        } else {
          responseText = t('iqraOutOfScope');
        }
        outOfScopeSuggestions = getTopicSuggestions(3, lang as 'ar' | 'en');
      } else if (
        artifactType
        && (route.intent === 'artifact' || route.intent === 'refinement')
        && mode === 'teacher'
        && (hasKBMatch || hasDocs || softBareArtifact)
      ) {
        // Real generators (same as AI Tools) — not thin chat outlines
        // Resolve topic from the typed ask FIRST so soft-pinned "تركيب الاقترانات"
        // cannot override "خطة درس عن الأسس والمعادلات".
        const topicForArt = resolveArtifactTopic({
          lang: lang as 'ar' | 'en',
          query: q,
          lesson: null,
          activeTopicAr: sessionMemory.activeTopicAr,
          activeTopicEn: sessionMemory.activeTopicEn,
          docTopic: hasDocs
            ? primaryTopicFromDocuments(docBundle.documents, docNames[0] || q)
            : null,
          preferDocuments: hasDocs && sessionMemory.lessonPin !== 'hard',
        });
        const topicRanked = searchKBRanked(topicForArt, lang as 'ar' | 'en');
        const topicConfident = isConfidentKbHit(topicRanked);
        // Unit-level asks (الدائرة) often tie several lessons — still prefer that unit
        const topicStrong =
          topicConfident
          || ((topicRanked[0]?.score ?? 0) >= KB_CONFIDENT_SCORE);
        let lessonForArt = topicStrong
          ? topicRanked[0]!.lesson
          : (hasDocs && sessionMemory.lessonPin !== 'hard'
            ? null
            : (
              results[0]
              ?? (softBareArtifact && sessionMemory.activeLessonId
                ? getLessonById(sessionMemory.activeLessonId)
                : null)
              ?? null
            ));
        // Soft pin only when the teacher did not name a different topic
        if (
          softBareArtifact
          && !topicStrong
          && sessionMemory.activeLessonId
        ) {
          lessonForArt = getLessonById(sessionMemory.activeLessonId) ?? lessonForArt;
        }
        const finalTopic = resolveArtifactTopic({
          lang: lang as 'ar' | 'en',
          query: q,
          lesson: lessonForArt,
          activeTopicAr: sessionMemory.activeTopicAr,
          activeTopicEn: sessionMemory.activeTopicEn,
          docTopic: hasDocs
            ? primaryTopicFromDocuments(docBundle.documents, docNames[0] || q)
            : null,
          preferDocuments: hasDocs && sessionMemory.lessonPin !== 'hard',
        });
        try {
          const generated = await generateChatArtifact({
            artifact: artifactType,
            topic: finalTopic,
            lesson: lessonForArt,
            lang: lang as 'ar' | 'en',
            documentContext: hasDocs ? docBundle.promptBlock : null,
            fromSoftPin: softBareArtifact && !topicStrong,
          });
          responseText = generated.text;
          lessonTopic = generated.topic;
          quickTopic = generated.topic;
          teachingActions = undefined;
          setSessionMemory(prev => {
            let next = prev;
            if (pendingHardPin) next = pinLesson(next, pendingHardPin, 'hard');
            else if (lessonForArt && (prev.lessonPin === 'soft' || softBareArtifact)) {
              next = pinLesson(next, lessonForArt, softBareArtifact ? 'soft' : 'hard');
            } else if (lessonForArt && prev.lessonPin === 'none') {
              next = pinLesson(next, lessonForArt, 'hard');
            }
            return recordGeneratedResource(next, artifactType);
          });
        } catch (genErr) {
          console.error('[iqra chat] artifact generation failed', genErr);
          const ta = runTeachingAssistant();
          responseText = ta.text || t('iqraChatError');
          teachingActions = ta.actions;
          if (ta.activeLesson) {
            lessonTopic = lang === 'ar' ? ta.activeLesson.titleAr : ta.activeLesson.titleEn;
            quickTopic = lessonTopic;
          }
          setSessionMemory(prev => ({ ...prev, ...ta.memoryPatch }));
        }
      } else if (DEMO_MODE) {
        const ta = runTeachingAssistant();
        responseText = ta.text || t('iqraOfflineFallback');
        teachingActions = ta.actions;
        if (ta.needsClarification) {
          pedagogicalClarification = ta.clarificationOptions;
          clarificationQuery = ta.clarificationQuery;
          teachingActions = [];
        }
        if (ta.activeLesson) {
          lessonTopic = lang === 'ar' ? ta.activeLesson.titleAr : ta.activeLesson.titleEn;
          quickTopic = lessonTopic;
        } else if (hasDocs) {
          quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
          lessonTopic = quickTopic;
        }
        setSessionMemory(prev => {
          let next: ChatSessionMemory = {
            ...prev,
            ...ta.memoryPatch,
            generatedResources: ta.memoryPatch.generatedResources ?? prev.generatedResources,
            lastGeneratedResource:
              ta.memoryPatch.lastGeneratedResource ?? prev.lastGeneratedResource,
            prepCompleted: ta.memoryPatch.prepCompleted ?? prev.prepCompleted,
            prepLessonId: ta.memoryPatch.prepLessonId ?? prev.prepLessonId,
            lastCompletedPrepStep:
              ta.memoryPatch.lastCompletedPrepStep ?? prev.lastCompletedPrepStep,
          };
          if (pendingHardPin) next = pinLesson(next, pendingHardPin, 'hard');
          return next;
        });
      } else {
        try {
          responseText = await remoteAIService.chat({
            messages: history,
            context: kbContext,
            mode,
            language: lang as 'ar' | 'en',
          });
          if (!responseText.trim()) {
            const ta = runTeachingAssistant();
            responseText = ta.text || t('iqraNoResults');
            teachingActions = ta.actions;
            if (ta.activeLesson) {
              lessonTopic = lang === 'ar' ? ta.activeLesson.titleAr : ta.activeLesson.titleEn;
              quickTopic = lessonTopic;
            } else if (hasDocs) {
              quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
              lessonTopic = quickTopic;
            }
            setSessionMemory(prev => {
              let next = { ...prev, ...ta.memoryPatch };
              if (pendingHardPin) next = pinLesson(next, pendingHardPin, 'hard');
              return next;
            });
          } else if (results[0]) {
            lessonTopic = lang === 'ar' ? results[0].titleAr : results[0].titleEn;
            quickTopic = lessonTopic;
            if (pendingHardPin) {
              setSessionMemory(prev => pinLesson(prev, pendingHardPin, 'hard'));
            }
          } else if (hasDocs) {
            quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
            lessonTopic = quickTopic;
          }
        } catch (remoteErr) {
          console.error('[iqra chat] remote AI failed', remoteErr);
          const ta = runTeachingAssistant();
          responseText = ta.text || t('iqraOfflineFallback');
          teachingActions = ta.actions;
          if (ta.activeLesson) {
            lessonTopic = lang === 'ar' ? ta.activeLesson.titleAr : ta.activeLesson.titleEn;
            quickTopic = lessonTopic;
          } else if (hasDocs) {
            quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
            lessonTopic = quickTopic;
          }
          setSessionMemory(prev => {
            let next = { ...prev, ...ta.memoryPatch };
            if (pendingHardPin) next = pinLesson(next, pendingHardPin, 'hard');
            return next;
          });
        }
      }

      // Ensure teacher actions always have a topic when KB or docs matched
      if (!quickTopic && hasKBMatch && results[0]) {
        quickTopic = lang === 'ar' ? results[0].titleAr : results[0].titleEn;
        lessonTopic = quickTopic;
      }
      if (!quickTopic && hasDocs) {
        quickTopic = primaryTopicFromDocuments(docBundle.documents, docNames[0] || q);
        lessonTopic = quickTopic;
      }

      const showLessonPrep = Boolean(
        DEMO_MODE
        && mode === 'teacher'
        && (hasKBMatch || hasDocs)
        && !pedagogicalClarification
        && (quickTopic || (teachingActions && teachingActions.length > 0)),
      );

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        sources: results,
        lessonTopic,
        quickTopic,
        teachingActions: mode === 'teacher' ? teachingActions : undefined,
        curriculumLessonId: msgLessonId ?? undefined,
        subjectColor: msgColor ?? undefined,
        suggestions: outOfScopeSuggestions,
        pedagogicalClarification,
        clarificationQuery,
        showLessonPrep,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Composer shortcuts only — never persist as floating chips in the timeline
      const nextEphemeral: EphemeralSuggestion[] = [];
      if (mode === 'teacher' && teachingActions?.length && quickTopic) {
        nextEphemeral.push(
          ...ephemeralFromTeachingActions(teachingActions, quickTopic, lang as 'ar' | 'en'),
        );
      }
      if (outOfScopeSuggestions?.length) {
        nextEphemeral.push(
          ...outOfScopeSuggestions.map(s => ({
            id: `sug-${s.lessonId}`,
            label: s.text,
            prompt: s.text,
            lessonId: s.lessonId,
          })),
        );
      }
      if (msgLessonId) {
        nextEphemeral.push({
          id: `open-lesson-${msgLessonId}`,
          label: lang === 'ar' ? '📖 افتح الدرس' : '📖 Open lesson',
          prompt: '',
          lessonId: msgLessonId,
          subjectColor: msgColor ?? undefined,
        });
      }
      setEphemeralSuggestions(nextEphemeral);
      } catch (err) {
        console.error('[iqra chat] sendMessage failed', err);
        const errMsg: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: t('iqraChatError'),
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errMsg]);
        showToast(t('iqraChatError'));
      } finally {
        thinkingRef.current = false;
        setIsThinking(false);
        setThinkingLabel('');
        atBottomRef.current = true;
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [deepLinkColor, deepLinkLessonId, lang, messages, mode, sessionMemory, t, teachingCtx],
  );

  // Auto-send deep-link message once welcome message is in place
  useEffect(() => {
    if (autoMessagePending && messages.length === 1 && messages[0].id === 'welcome') {
      const msg = autoMessagePending;
      setAutoMessagePending(null);
      sendMessage(msg);
    }
  }, [messages, autoMessagePending, sendMessage]);

  // Handle subject-clarification chip taps (ambiguous query flow)
  const handleClarifySubject = useCallback(
    (originalQuery: string, subjectId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sendMessage(originalQuery, undefined, subjectId);
    },
    [sendMessage],
  );

  // First-time vs review clarification — continue same lesson without retyping context
  const handlePedagogicalClarify = useCallback(
    (originalQuery: string, option: ClarificationOption) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const tag = option.id === 'review'
        ? (lang === 'ar' ? 'مراجعة قبل الاختبار' : 'review before the test')
        : (lang === 'ar' ? 'شرح لأول مرة' : 'first-time explanation');
      const next = originalQuery.trim()
        ? `${originalQuery.trim()} — ${tag}`
        : tag;
      // Mark lesson clarified immediately so the next turn answers fully
      setSessionMemory(prev => ({
        ...prev,
        clarifiedLessonIds: prev.activeLessonId
          ? [...new Set([...prev.clarifiedLessonIds, prev.activeLessonId])]
          : prev.clarifiedLessonIds,
      }));
      sendMessage(next, sessionMemory.activeLessonId ?? undefined);
    },
    [lang, sendMessage, sessionMemory.activeLessonId],
  );

  // One-shot composer shortcuts → user bubble in the timeline, then disappear
  const handleEphemeralPress = useCallback(
    (suggestion: EphemeralSuggestion) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEphemeralSuggestions([]);

      // Deep-link "Open lesson" — navigate once; not a chat turn
      if (suggestion.id.startsWith('open-lesson-') && suggestion.lessonId) {
        router.push({
          pathname: '/curriculum/lesson-detail',
          params: {
            lessonId: suggestion.lessonId,
            subjectColor: suggestion.subjectColor ?? colors.primary,
          },
        });
        return;
      }

      if (suggestion.prompt.trim()) {
        sendMessage(suggestion.prompt, suggestion.lessonId);
      }
    },
    [colors.primary, sendMessage],
  );

  const handleLessonSuggestion = useCallback((s: LessonSuggestion) => {
    const prompt = lang === 'ar' ? s.promptAr : s.promptEn;
    if (s.toolType) {
      // Recording happens after the reply; prompt carries the intent
    }
    sendMessage(prompt, s.lessonId ?? sessionMemory.activeLessonId ?? undefined);
  }, [lang, sendMessage, sessionMemory.activeLessonId]);

  const handleResourcePress = useCallback((type: SessionArtifact, done: boolean) => {
    const topic =
      (lang === 'ar' ? sessionMemory.activeTopicAr : sessionMemory.activeTopicEn)
      ?? '';
    if (done && topic) {
      const hw = type === 'homework' ? { isHomework: '1' } : {};
      router.push({
        pathname: resourceRoute(type) as any,
        params: { topic, ...hw },
      });
      return;
    }
    const prompts: Record<SessionArtifact, { ar: string; en: string }> = {
      'lesson-plan': { ar: `حضّر خطة درس كاملة عن: ${topic}`, en: `Prepare a full lesson plan about: ${topic}` },
      worksheet: { ar: `أنشئ ورقة عمل صفية عن: ${topic}`, en: `Create an in-class worksheet about: ${topic}` },
      homework: { ar: `أنشئ واجباً منزلياً عن: ${topic}`, en: `Create homework about: ${topic}` },
      quiz: { ar: `جهّز اختباراً قصيراً عن: ${topic}`, en: `Create a short quiz about: ${topic}` },
      activity: { ar: `اقترح نشاطاً صفياً عن: ${topic}`, en: `Suggest a classroom activity about: ${topic}` },
    };
    sendMessage(lang === 'ar' ? prompts[type].ar : prompts[type].en, sessionMemory.activeLessonId ?? undefined);
  }, [lang, sendMessage, sessionMemory]);

  const handleCopyMessage = useCallback(async (text: string) => {
    await copyToClipboard(text);
    showToast(t('copiedToClipboard'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const handleExportMessage = useCallback((text: string) => {
    setExportText(text);
    setExportVisible(true);
  }, []);

  const scrollToLatest = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
    atBottomRef.current = true;
    setAtBottom(true);
  }, []);

  /** Starting points on the empty screen — the fastest route into real work. */
  const starterCards: StarterCard[] = useMemo(() => {
    const ask = (key: 'iqraStartPlanPrompt' | 'iqraStartWorksheetPrompt' | 'iqraStartExplainPrompt') =>
      () => sendMessage(t(key), sessionMemory.activeLessonId ?? undefined);
    return [
      {
        id: 'upload',
        icon: 'cloud-upload-outline',
        title: t('iqraStartUpload'),
        subtitle: t('iqraStartUploadSub'),
        onPress: async () => {
          const picked = await pickTeachingDocuments();
          if (picked.length) {
            await addAndProcessFiles(picked, (name: string) => showToast(t('docRejected', name)));
          }
        },
      },
      {
        id: 'plan',
        icon: 'document-text-outline',
        title: t('iqraStartPlan'),
        subtitle: t('iqraStartPlanSub'),
        onPress: ask('iqraStartPlanPrompt'),
      },
      {
        id: 'worksheet',
        icon: 'create-outline',
        title: t('iqraStartWorksheet'),
        subtitle: t('iqraStartWorksheetSub'),
        onPress: ask('iqraStartWorksheetPrompt'),
      },
      {
        id: 'explain',
        icon: 'bulb-outline',
        title: t('iqraStartExplain'),
        subtitle: t('iqraStartExplainSub'),
        onPress: ask('iqraStartExplainPrompt'),
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, sendMessage, sessionMemory.activeLessonId]);

  const currentLessonView = buildCurrentLessonView(sessionMemory, sessionDocs, lang as 'ar' | 'en');
  const lessonSuggestions = mode === 'teacher'
    ? buildLessonSuggestions(
      sessionMemory,
      lang as 'ar' | 'en',
      sessionDocs.some(d => d.status === 'ready'),
    )
    : [];
  const suggestions = lessonSuggestions.length > 0
    ? []
    : SUGGESTIONS[mode][lang as 'ar' | 'en'];
  const livePrepProgress = DEMO_MODE && mode === 'teacher'
    ? buildPrepProgressView(sessionMemory, lang as 'ar' | 'en')
    : null;
  const lastPrepMessageId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant' && messages[i]?.showLessonPrep) {
        return messages[i]!.id;
      }
    }
    return null;
  })();

  /** Nothing said yet → show the hero instead of a lone welcome bubble. */
  const showHero =
    !isThinking
    && messages.length <= 1
    && (messages.length === 0 || messages[0]!.id === 'welcome');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Header ────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={centered}>
          <View style={[styles.headerTop, isRTL && { flexDirection: 'row-reverse' }]}>
            {/* Brand — one line: mark, wordmark, tagline, demo badge */}
            <View style={[styles.brandRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.iqraIcon, { backgroundColor: colors.primary }]}>
                <BrandLogo variant="mark" onDark width={22} height={20} />
              </View>
              <View style={{ gap: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.brandTitleRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                    {t('iqraChatTitle')}
                  </Text>
                  <DemoModeBanner isRTL={isRTL} />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.headerSub, {
                    color: colors.mutedForeground,
                    fontFamily: 'Inter_400Regular',
                    textAlign: isRTL ? 'right' : 'left',
                  }]}
                >
                  {t('iqraChatSubtitle')}
                </Text>
              </View>
            </View>

            {/* Mode toggle */}
            <View style={[styles.modeToggle, { backgroundColor: colors.muted, borderRadius: 20 }]}>
              {(['teacher', 'student'] as Mode[]).map(m => (
                <Pressable
                  key={m}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMode(m);
                  }}
                  style={[
                    styles.modeBtn,
                    { borderRadius: 18 },
                    mode === m && { backgroundColor: colors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === m }}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      {
                        color: mode === m ? colors.primaryForeground : colors.mutedForeground,
                        fontFamily: mode === m ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      },
                    ]}
                  >
                    {m === 'teacher' ? t('teacherMode') : t('studentMode')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Lesson-aware suggestions (teacher) or fallback starter chips.
              Hidden on the empty screen — the hero already offers starting points. */}
          {!showHero ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.suggestionsScroll, isRTL && { flexDirection: 'row-reverse' }]}
            >
              {lessonSuggestions.length > 0
                ? lessonSuggestions.map(s => (
                  <Pressable
                    key={s.id}
                    onPress={() => handleLessonSuggestion(s)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: colors.primary + '2E',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                      {s.emoji} {lang === 'ar' ? s.labelAr : s.labelEn}
                    </Text>
                  </Pressable>
                ))
                : suggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => sendMessage(s.text, s.lessonId)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: colors.primary + '2E',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                      {s.text}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
          ) : null}
        </View>
      </View>

      {/* ─── Current lesson (persistent, collapses on scroll) ───────── */}
      {mode === 'teacher' && currentLessonView ? (
        <CurrentLessonCard
          lesson={currentLessonView}
          collapsed={lessonCardCollapsed}
          isRTL={isRTL}
          lang={lang as 'ar' | 'en'}
          colors={colors}
          changeLabel={t('changeLesson')}
          uploadedLabel={(n) => t('lessonUploadedFiles', n)}
          progressLabel={t(
            'lessonProgressLabel',
            currentLessonView.resources.filter(r => r.done).length,
            currentLessonView.resources.length,
          )}
          allReadyLabel={t('lessonAllReady')}
          maxWidth={CHAT_MAX_WIDTH}
          onChangeLesson={() => setChangeLessonOpen(true)}
          onToggleCollapse={() => setLessonCardCollapsed(c => !c)}
          onResourcePress={handleResourcePress}
        />
      ) : null}

      {mode === 'teacher' && (
        <ContextBanner
          colors={colors}
          isRTL={isRTL}
          lang={lang as 'ar' | 'en'}
          t={t}
          hidePill
          externalOpen={changeLessonOpen}
          onExternalOpenChange={setChangeLessonOpen}
          onGlobalPick={(pick) => {
            // Changing the lesson in chat updates the app-wide context too —
            // home and the tools hub follow (one source of truth).
            void saveLessonPick({ topic: pick.topic, unitOrder: null, subjectId: pick.subjectId });
          }}
          onContextChange={(ctx) => {
            setTeachingCtx(ctx);
            if (!ctx.trim()) return;
            const hits = searchKBSemantic(ctx.trim(), lang as 'ar' | 'en');
            if (hits[0]) {
              setSessionMemory(prev => pinLesson(prev, hits[0]!, 'hard'));
            } else {
              setSessionMemory(prev => ({
                ...prev,
                activeTopicAr: lang === 'ar' ? ctx.trim() : prev.activeTopicAr,
                activeTopicEn: lang === 'en' ? ctx.trim() : prev.activeTopicEn,
                lessonPin: 'hard',
              }));
            }
          }}
          onAsk={(topic) => sendMessage(
            lang === 'ar'
              ? `أدرّس "${topic}" للصف العاشر. أعطني نظرة شاملة عن الموضوع مع أهم مفاهيمه.`
              : `I'm teaching "${topic}" to Grade 10 students. Give me a comprehensive overview of this topic with key concepts.`,
            sessionMemory.activeLessonId ?? undefined,
          )}
        />
      )}

      {/* ─── Messages ──────────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={showHero ? [] : messages}
          keyExtractor={m => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.messageList,
            centered,
            // Empty screen: sit the hero in the middle of the free space
            showHero && { flexGrow: 1, justifyContent: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            const y = contentOffset.y;
            if (y > 48 && !lessonCardCollapsed) setLessonCardCollapsed(true);
            const distanceFromEnd = contentSize.height - layoutMeasurement.height - y;
            const near = distanceFromEnd < 120;
            if (near !== atBottomRef.current) {
              atBottomRef.current = near;
              setAtBottom(near);
            }
          }}
          scrollEventThrottle={16}
          // Only follow new content when the teacher is already reading the
          // bottom — otherwise scrolling back through a long plan yanks away.
          onContentSizeChange={() => {
            if (atBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
          }}
          ListHeaderComponent={
            showHero ? (
              <ChatEmptyState
                colors={colors}
                isRTL={isRTL}
                greeting={t('iqraHeroGreeting')}
                subtitle={t('iqraHeroSub')}
                cards={mode === 'teacher' ? starterCards : starterCards.slice(2)}
              />
            ) : null
          }
          renderItem={({ item, index }) => {
            const prev = messages[index - 1];
            return (
              <MessageBubble
                message={item}
                colors={colors}
                isRTL={isRTL}
                isGroupStart={!prev || prev.role !== item.role}
                onLongPress={item.role === 'assistant' ? handleExportMessage : undefined}
                onCopy={handleCopyMessage}
                onExport={handleExportMessage}
                copyLabel={t('iqraCopyMessage')}
                exportLabel={t('iqraExportMessage')}
                onClarifySubject={handleClarifySubject}
                onPedagogicalClarify={handlePedagogicalClarify}
                prepProgress={
                  item.id === lastPrepMessageId ? livePrepProgress : null
                }
              />
            );
          }}
          ListFooterComponent={
            isThinking ? (
              <View style={[styles.thinkingRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.avatar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <BrandLogo variant="mark" width={20} height={18} />
                </View>
                <View style={[styles.thinkingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TypingIndicator color={colors.primary} />
                  <Text style={[styles.thinkingText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                    {thinkingLabel || t('iqraTyping')}
                  </Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* Jump back to the newest turn after scrolling up a long reply */}
        {!atBottom && !showHero ? (
          <Pressable
            onPress={() => scrollToLatest()}
            style={({ pressed }) => [
              styles.jumpBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('iqraScrollToLatest')}
          >
            <Ionicons name="arrow-down" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {/* ─── Ephemeral input shortcuts (composer only — leave the timeline) ── */}
      {ephemeralSuggestions.length > 0 && !isThinking ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 48, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
          contentContainerStyle={[
            styles.docActionsScroll,
            isWide && { width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          {ephemeralSuggestions.map(suggestion => (
            <Pressable
              key={suggestion.id}
              onPress={() => handleEphemeralPress(suggestion)}
              style={({ pressed }) => [
                styles.docActionChip,
                {
                  borderColor: colors.primary + '55',
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.foreground }}>
                {suggestion.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* ─── Input Bar ─────────────────────────────────────────────── */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: tabBarHeight + Math.max(insets.bottom, 8),
          },
        ]}
      >
        <View style={centered}>
          <DocumentAttachmentBar
            isRTL={isRTL}
            chipsOnly
            showAttachButtons={false}
            onDocumentsReady={handleDocumentsReady}
            onRejectedFile={(name) => showToast(t('docRejected', name))}
          />
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.background,
                borderColor: inputFocused ? colors.primary : colors.border,
                borderWidth: inputFocused ? 1.5 : 1,
              },
              isRTL && { flexDirection: 'row-reverse' },
            ]}
          >
            <DocumentAttachButtons onRejectedFile={(name) => showToast(t('docRejected', name))} />
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' },
                // Web focus outline is drawn by the wrapper's border instead.
                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
              ]}
              placeholder={t('iqraPlaceholderDocs')}
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              maxLength={800}
              // Enter sends, Shift+Enter breaks the line — what every desktop
              // chat does, and what teachers try first in the browser.
              onKeyPress={(e: any) => {
                if (Platform.OS !== 'web' || !isWide) return;
                if (e.nativeEvent?.key === 'Enter' && !e.nativeEvent?.shiftKey) {
                  e.preventDefault?.();
                  if (input.trim() && !isThinking) sendMessage(input);
                }
              }}
              onSubmitEditing={() => sendMessage(input)}
            />
            <Pressable
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || isThinking}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: input.trim() && !isThinking ? colors.primary : colors.muted,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('iqraSend')}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={input.trim() && !isThinking ? colors.primaryForeground : colors.mutedForeground}
              />
            </Pressable>
          </View>
          {Platform.OS === 'web' && isWide ? (
            <Text
              style={[
                styles.composerHint,
                { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' },
              ]}
            >
              {t('iqraComposerHint')}
            </Text>
          ) : null}
        </View>
      </View>
      <ExportMenu
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        isRTL={isRTL}
        loadingPDF={loadingPDF}
        loadingWord={loadingWord}
        onShare={async () => {
          setExportVisible(false);
          await shareAsText(exportText, currentLessonView?.topic ?? 'IQRA');
        }}
        onCopy={async () => {
          setExportVisible(false);
          await copyToClipboard(exportText);
          showToast(t('copiedToClipboard'));
        }}
        onPDF={async () => {
          setLoadingPDF(true);
          try {
            const html = `<html><body dir="${isRTL ? 'rtl' : 'ltr'}" style="font-family: sans-serif; padding: 24px; white-space: pre-wrap;">${exportText.replace(/</g, '&lt;')}</body></html>`;
            await exportAsPDF(html, `iqra-${Date.now()}.pdf`);
          } finally {
            setLoadingPDF(false);
            setExportVisible(false);
          }
        }}
        onWord={async () => {
          setLoadingWord(true);
          try {
            await exportAsWord(exportText, `iqra-${Date.now()}.docx`, isRTL);
          } finally {
            setLoadingWord(false);
            setExportVisible(false);
          }
        }}
        labels={{
          title: t('exportTitle'),
          shareLabel: t('exportShare'),
          shareSub: t('exportShareSub'),
          copyLabel: t('exportCopy'),
          copySub: t('exportCopySub'),
          pdfLabel: t('exportPDF'),
          pdfSub: t('exportPDFSub'),
          wordLabel: t('exportWord'),
          wordSub: t('exportWordSub'),
          cancel: t('cancel'),
        }}
      />
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iqraIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: 0.2 },
  headerSub: { fontSize: 11.5 },
  modeToggle: { flexDirection: 'row', padding: 3, gap: 2 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 5 },
  modeBtnText: { fontSize: 12 },
  suggestionsScroll: { paddingHorizontal: 16, paddingBottom: 4, gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12 },
  docActionsScroll: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  docActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },

  messageList: { paddingHorizontal: 16, paddingTop: 16, gap: 10, paddingBottom: 12 },

  // Physical trailing edge (right). Do not flip for language RTL — that pinned bubbles left.
  rowUser: { width: '100%', alignItems: 'flex-end', marginBottom: 2 },
  bubbleUser: {
    maxWidth: '82%',
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  attachList: { gap: 6, marginBottom: 8 },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },

  rowAssistant: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 2 },
  rowAssistantRTL: { flexDirection: 'row-reverse' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  avatarSpacer: { width: 30, flexShrink: 0 },
  bubbleAssistant: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 18,
    borderTopStartRadius: 6,
    width: '100%',
  },
  bubbleText: { fontSize: 14, lineHeight: 22, fontFamily: 'Inter_400Regular' },

  msgActions: { alignItems: 'center', gap: 12, marginTop: 5, paddingHorizontal: 4 },
  msgActionBtn: { alignItems: 'center', gap: 4 },
  msgActionText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  timestampOutside: { fontSize: 10.5, fontFamily: 'Inter_400Regular', marginTop: 4, marginHorizontal: 4 },

  suggestionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggestionChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  suggestionChipText: { fontSize: 12 },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 18,
    borderTopStartRadius: 6,
  },
  thinkingText: { fontSize: 13 },

  jumpBtn: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#081B3A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
    borderRadius: 24,
  },
  input: { flex: 1, fontSize: 14, minHeight: 34, maxHeight: 120, paddingVertical: 8 },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 1,
  },
  composerHint: { fontSize: 10.5, fontFamily: 'Inter_400Regular', marginTop: 6, paddingHorizontal: 4 },
});

// ─── Context-banner styles ────────────────────────────────────────────────────
const ctxStyles = StyleSheet.create({
  container:  { borderTopWidth: StyleSheet.hairlineWidth },
  pillRow:    { alignItems: 'center', gap: 6 },
  pill:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText:   { fontSize: 12 },
  clearBtn:   { padding: 4 },
  subjRow:    { flexDirection: 'row', gap: 8, marginBottom: 4 },
  subjPill:   { paddingHorizontal: 14, paddingVertical: 6 },
  subjText:   { fontSize: 13 },
  // Modal
  modal:        { flex: 1 },
  modalHeader:  { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalCancel:  { width: 60 },
  modalCancelText: { fontSize: 14 },
  modalTitle:   { fontSize: 16 },
  modalBody:    { padding: 20, paddingBottom: 40 },
  modalSectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  modalFooter:  { padding: 16, borderTopWidth: 1 },
  askBtn:       { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  askBtnText:   { fontSize: 15, flexShrink: 1 },
});
