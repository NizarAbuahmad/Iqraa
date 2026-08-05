import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import { DocumentAttachButtons, DocumentAttachmentBar } from '@/components/ui/DocumentAttachmentBar';
import { ExportMenu } from '@/components/ui/ExportMenu';
import {
  clearSessionDocuments,
  getDocumentContextBundle,
  getSessionDocuments,
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
const CONTEXT_SUBJECTS = [
  { subjectId: 'mathematics', gradeId: 'grade-10', labelAr: 'رياضيات', labelEn: 'Math' },
];

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
  colors, isRTL, lang, t, onContextChange, onAsk, hidePill, externalOpen, onExternalOpenChange,
}: {
  colors: any; isRTL: boolean; lang: 'ar' | 'en';
  t: (k: any) => string;
  onContextChange: (ctx: string) => void;
  onAsk: (topic: string) => void;
  /** When true, only the change-lesson modal is rendered (card owns the chrome). */
  hidePill?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
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
          { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
        ]}
      >
        <Text
          style={[
            prepStyles.readyText,
            { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
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
        <Text
          key={item.id}
          style={[
            prepStyles.line,
            { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          ✅ {item.label}
        </Text>
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
            <Text
              key={item.id}
              style={[
                prepStyles.line,
                { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
              ]}
            >
              ⬜ {item.label}
            </Text>
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  recommend: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  readyText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#047857',
    lineHeight: 20,
  },
});

function MessageBubble({
  message, colors, isRTL, onLongPress, onClarifySubject, onPedagogicalClarify, prepProgress,
}: {
  message: Message; colors: any; isRTL: boolean;
  onLongPress?: (text: string) => void;
  onClarifySubject?: (originalQuery: string, subjectId: string) => void;
  onPedagogicalClarify?: (originalQuery: string, option: ClarificationOption) => void;
  /** Live session prep progress — shown under the latest meaningful reply. */
  prepProgress?: PrepProgressView | null;
}) {
  const isUser = message.role === 'user';
  const timeLabel = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    // User bubbles always sit on the trailing edge (right) — ChatGPT/WhatsApp style.
    // Do NOT flip justifyContent for RTL (that was pinning bubbles to the far left).
    return (
      <View style={styles.rowUser}>
        <View style={[styles.bubbleUser, { backgroundColor: colors.primary, borderRadius: 18 }]}>
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
          <Text style={[styles.timestamp, { color: 'rgba(255,255,255,0.7)', textAlign: isRTL ? 'left' : 'right' }]}>
            {timeLabel}
          </Text>
        </View>
      </View>
    );
  }

  // Assistant — avatar + bubble only. Tool shortcuts live in the composer (ephemeral).
  const lines = message.text.split('\n');

  return (
    <View style={[styles.rowAssistant, isRTL && styles.rowAssistantRTL]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        <BrandLogo variant="mark" width={22} height={20} />
      </View>
      <View style={{ flex: 1, maxWidth: '82%' }}>
        <Pressable
          onLongPress={() => onLongPress?.(message.text)}
          delayLongPress={500}
          style={[styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18 }]}
        >
          {lines.map((line, i) => {
            if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
            const isBold = line.startsWith('**') && line.includes('**');
            if (isBold) {
              const clean = line.replace(/\*\*/g, '');
              return (
                <Text key={i} style={[styles.bubbleBold, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {clean}
                </Text>
              );
            }
            if (line.startsWith('•')) {
              const text = line.substring(1).trim();
              const parts = text.split('**');
              return (
                <View key={i} style={[styles.bulletRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[{ color: colors.primary, marginTop: 2 }, isRTL ? { marginLeft: 6 } : { marginRight: 6 }]}>•</Text>
                  <Text style={[styles.bubbleText, { color: colors.foreground, flex: 1, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                    {parts.map((p, pi) =>
                      pi % 2 === 1
                        ? <Text key={pi} style={{ fontFamily: 'Inter_600SemiBold' }}>{p}</Text>
                        : p
                    )}
                  </Text>
                </View>
              );
            }
            if (line.startsWith('📚') || line.startsWith('📖')) {
              return (
                <Text key={i} style={[styles.sourceText, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {line}
                </Text>
              );
            }
            return (
              <Text key={i} style={[styles.bubbleText, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                {line}
              </Text>
            );
          })}
          <Text style={[styles.timestamp, { color: colors.mutedForeground, textAlign: isRTL ? 'left' : 'right' }]}>
            {timeLabel}
          </Text>
        </Pressable>

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
    </View>
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
  const listRef = useRef<FlatList>(null);
  /** Guards duplicate sends without relying on a stale useCallback closure. */
  const thinkingRef = useRef(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

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
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      thinkingRef.current = true;
      setIsThinking(true);

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
        <View style={[styles.headerTop, isRTL && { flexDirection: 'row-reverse' }]}>
          {/* Brand */}
          <View style={[styles.brandRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.iqraIcon, { backgroundColor: colors.primary }]}>
              <BrandLogo variant="mark" onDark width={26} height={24} />
            </View>
            <View>
              <BrandLogo
                variant="lockup"
                style={[styles.headerLockup, isRTL && { alignSelf: 'flex-end' }]}
              />
              <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('iqraChatSubtitle')}
              </Text>
              <DemoModeBanner isRTL={isRTL} />
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
                  {m === 'teacher' ? (isRTL ? 'معلم' : 'Teacher') : (isRTL ? 'طالب' : 'Student')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Lesson-aware suggestions (teacher) or fallback starter chips */}
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
                  { backgroundColor: colors.secondary, borderRadius: 20, opacity: pressed ? 0.7 : 1 },
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
                  { backgroundColor: colors.secondary, borderRadius: 20, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                  {s.text}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
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
          generatedLabel={t('lessonGeneratedLabel')}
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
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (y > 48 && !lessonCardCollapsed) setLessonCardCollapsed(true);
        }}
        scrollEventThrottle={16}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            colors={colors}
            isRTL={isRTL}
            onLongPress={item.role === 'assistant' ? (text) => {
              setExportText(text);
              setExportVisible(true);
            } : undefined}
            onClarifySubject={handleClarifySubject}
            onPedagogicalClarify={handlePedagogicalClarify}
            prepProgress={
              item.id === lastPrepMessageId ? livePrepProgress : null
            }
          />
        )}
        ListFooterComponent={
          isThinking ? (
            <View style={[styles.thinkingRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                <BrandLogo variant="mark" width={22} height={20} />
              </View>
              <View style={[styles.thinkingBubble, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.thinkingText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {thinkingLabel || t('iqraTyping')}
                </Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* ─── Ephemeral input shortcuts (composer only — leave the timeline) ── */}
      {ephemeralSuggestions.length > 0 && !isThinking ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 48, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
          contentContainerStyle={[
            styles.docActionsScroll,
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
            { backgroundColor: colors.muted, borderRadius: 24 },
            isRTL && { flexDirection: 'row-reverse' },
          ]}
        >
          <DocumentAttachButtons onRejectedFile={(name) => showToast(t('docRejected', name))} />
          <TextInput
            style={[
              styles.input,
              { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder={t('iqraPlaceholderDocs')}
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={800}
            onSubmitEditing={() => sendMessage(input)}
          />
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isThinking}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: input.trim() ? colors.primary : colors.muted,
                borderRadius: 20,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name={isRTL ? 'arrow-back' : 'arrow-forward'}
              size={18}
              color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
            />
          </Pressable>
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
  header: { borderBottomWidth: 1, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iqraIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerLockup: { height: 32, width: 140 },
  headerSub: { fontSize: 12, marginTop: 1 },
  modeToggle: { flexDirection: 'row', padding: 3, gap: 2 },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 5 },
  modeBtnText: { fontSize: 12 },
  suggestionsScroll: { paddingHorizontal: 16, paddingBottom: 4, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 12 },
  docActionsScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  docActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },

  messageList: { padding: 16, gap: 12, paddingBottom: 8 },

  // Physical trailing edge (right). Do not flip for language RTL — that pinned bubbles left.
  rowUser: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  bubbleUser: { maxWidth: '78%', padding: 12, paddingHorizontal: 16, alignSelf: 'flex-end' },
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

  rowAssistant: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  rowAssistantRTL: { flexDirection: 'row-reverse' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 },
  bubbleAssistant: { padding: 14, borderWidth: 1 },
  bubbleBold: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  bubbleText: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 1 },
  sourceText: { fontSize: 11, marginTop: 6, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  timestamp: { fontSize: 10, marginTop: 6, fontFamily: 'Inter_400Regular' },

  suggestionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggestionChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  suggestionChipText: { fontSize: 12 },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  thinkingText: { fontSize: 13 },

  inputBar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingVertical: 0 },
  sendBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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
