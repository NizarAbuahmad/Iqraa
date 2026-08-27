import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
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
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { loadLessonPick, saveLessonPick } from '@/services/lessonContext';
import {
  buildResponse,
  deduplicateByUnit,
  detectSubjectAmbiguity,
  filterResultsBySubject,
} from '@/services/kbContext';
import { shouldAskWhichLesson } from '@/services/kbSuggestion';
import { Toast } from '@/components/ui/Toast';
import { remoteAIService } from '@/services/ai/RemoteAIService';
import { DEMO_MODE } from '@/services/ai/demoMode';
import {
  generateChatArtifact,
  resolveArtifactTopic,
  type ChatArtifactData,
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
import { IqraaMark } from '@/components/ui/IqraaMark';
import { CHAT_MAX_WIDTH } from '@/constants/layout';
import { LessonPlanView } from '@/components/ui/LessonPlanView';
import { MathParagraph } from '@/components/ui/MathParagraph';
import { hasRenderableMath, isolateForeignRuns } from '@/services/mathRender';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { CurrentLessonCard } from '@/components/ui/CurrentLessonCard';
import { DocumentAttachmentBar } from '@/components/ui/DocumentAttachmentBar';
import { DOCUMENT_UPLOAD_ENABLED } from '@/services/features';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { ComposerToolsMenu, type MenuAction, type MenuSection } from '@/components/ui/ComposerToolsMenu';
import {
  AFTER_CLASS,
  BEFORE_CLASS,
  DURING_CLASS,
  type ToolDef,
} from '@/services/toolCatalog';
import { openGeogebraGraphing } from '@/services/geogebra';
import { trackEvent } from '@/services/analytics';
import {
  addAndProcessFiles,
  clearSessionDocuments,
  getDocumentContextBundle,
  getSessionDocuments,
  pickTeachingDocuments,
  pickTeachingImages,
  primaryTopicFromDocuments,
  subscribeSessionDocuments,
  type SessionDocument,
} from '@/services/documents';
import { lessonPickerParams } from '@/services/lessonPrep';
import {
  buildCurrentLessonView,
  buildLessonSuggestions,
  isBareArtifactShortcut,
  isConfidentKbHit,
  pinLesson,
  resolvePickedLesson,
  resourceRoute,
  seedDefaultLessonMemory,
  shouldReuseActiveLesson,
  type LessonSuggestion,
} from '@/services/lessonCopilot';
import {
  formatActivityText,
  formatLessonPlanText,
  formatQuizText,
  formatWorksheetText,
  copyToClipboard,
  exportAsPDF,
  exportAsWord,
  shareAsText,
} from '@/services/share';
import { buildClassDeck } from '@/services/startClass';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { ClassPickerSheet, type ClassPick } from '@/components/ui/ClassPickerSheet';
import { describeAttachResult } from '@/services/classAttach';
import type { Lang } from '@/services/i18n';
import { attachToClasses, getItem, saveItem, updateItem } from '@/services/workspace';
import {
  canPresentArtifact,
  deckForArtifact,
  materialContentFor,
  materialFormStateFor,
  materialTypeFor,
} from '@/services/chatMaterialActions';

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
/**
 * Iqraa is a teacher tool. The student half of this screen was a mode toggle
 * promising a student experience that was never built and is not planned —
 * students never get accounts (see lib/db/src/schema/students.ts). Keeping the
 * type as a single member so the compiler flags anything that still branches.
 */
type Mode = 'teacher';

type ChatAttachment = {
  id: string;
  name: string;
  kind: string;
};

interface Message {
  id: string;
  role: Role;
  text: string;
  /**
   * The structured material behind this reply, when the turn produced one.
   * Chat generates the same objects the tool screens do, so a lesson plan can
   * be shown as a plan and edited here rather than read as a paragraph.
   * `text` stays for export, sharing and anything without a renderer yet.
   */
  artifactData?: ChatArtifactData;
  /** Conversation around a rendered document — shown instead of the full text. */
  artifactProse?: string;
  /** Heading + context, so an edited document exports as edited. */
  artifactMeta?: { title: string; subject: string; grade: string; duration?: number };
  /**
   * Workspace id, once this material has been saved from chat. Held on the
   * message so a second tap updates the same material instead of filing a
   * duplicate, and so "add to class" knows there is already something to
   * attach.
   */
  savedMaterialId?: string;
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
  /**
   * Lesson candidates offered when retrieval was plausible but not certain.
   * Picking one re-sends the original query hard-pinned to that lesson, so the
   * teacher confirms a guess instead of supplying the topic from scratch.
   */
  clarificationLessons?: { id: string; title: string }[];
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

// ─── Teaching-context subject options ────────────────────────────────────────
// All MVP subjects with KB content — kept in lockstep with the home picker
// (was hardcoded to mathematics only, which is why the chat's change-lesson
// sheet showed a single subject while home showed three). Grade is a
// separate, independent pick (below) — it used to be baked in here as
// 'grade-10', which is why Grade 9 was unreachable from this sheet even
// after the picker itself learned about it.
const CONTEXT_SUBJECTS = getPickerSubjects().map(s => ({
  subjectId: s.id,
  labelAr: s.nameAr,
  labelEn: s.name,
}));

// All MVP grades with KB content — same picker `home.tsx`'s change-lesson
// sheet uses, so this sheet offers the same choice.
const CONTEXT_GRADES = getPickerGrades();

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
};

// ─── Context Banner ───────────────────────────────────────────────────────────
/**
 * What the change-lesson sheet knows about the lesson the teacher tapped.
 * `lessonId` is null for entire-unit / entire-book picks and for free text.
 */
type ChatLessonPick = { topic: string; subjectId: string; gradeId: string; lessonId: string | null };

function ContextBanner({
  colors, isRTL, lang, t, onContextChange, onAsk, hidePill, externalOpen, onExternalOpenChange, onGlobalPick,
}: {
  colors: any; isRTL: boolean; lang: 'ar' | 'en';
  t: (k: any) => string;
  onContextChange: (ctx: string, pick?: ChatLessonPick) => void;
  onAsk: (topic: string, pick?: ChatLessonPick) => void;
  /** When true, only the change-lesson modal is rendered (card owns the chrome). */
  hidePill?: boolean;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  /** Confirmed picks propagate to the app-wide current-lesson context. */
  onGlobalPick?: (pick: ChatLessonPick) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [subjIdx, setSubjIdx] = useState(0);
  const [gradeId, setGradeId] = useState('grade-10');
  const [topic, setTopicInternal] = useState('');
  // Draft topic while modal is open; only committed on confirm
  const [draftTopic, setDraftTopic] = useState('');
  const [draftSubjIdx, setDraftSubjIdx] = useState(0);
  const [draftGradeId, setDraftGradeId] = useState(gradeId);
  // The KB id of the lesson the teacher tapped, straight from the picker.
  // Kept because the title alone does not identify it again — see
  // `TopicSelectionDetail.lessonId`.
  const [draftLessonId, setDraftLessonId] = useState<string | null>(null);

  const subj = CONTEXT_SUBJECTS[draftSubjIdx];
  const isOpen = externalOpen ?? modalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setModalOpen(v);
  };

  const openModal = () => {
    setDraftTopic(topic);
    setDraftSubjIdx(subjIdx);
    setDraftGradeId(gradeId);
    setDraftLessonId(null);
    setOpen(true);
  };

  useEffect(() => {
    if (externalOpen) {
      setDraftTopic(topic);
      setDraftSubjIdx(subjIdx);
      setDraftGradeId(gradeId);
      setDraftLessonId(null);
    }
  }, [externalOpen]);

  const handleConfirm = () => {
    setSubjIdx(draftSubjIdx);
    setGradeId(draftGradeId);
    setTopicInternal(draftTopic);
    const pick: ChatLessonPick = {
      topic: draftTopic.trim(),
      subjectId: subj.subjectId,
      gradeId: draftGradeId,
      lessonId: draftLessonId,
    };
    onContextChange(draftTopic, pick);
    setOpen(false);
    if (pick.topic) {
      onGlobalPick?.(pick);
      onAsk(pick.topic, pick);
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleClear = () => {
    setTopicInternal('');
    setSubjIdx(0);
    setGradeId('grade-10');
    setDraftLessonId(null);
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
                fontFamily: topic ? 'Cairo_500Medium' : 'Almarai_400Regular',
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
              <Text style={[ctxStyles.modalCancelText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Text>
            </Pressable>
            <Text style={[ctxStyles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}>
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
            {/* Grade pills — only worth showing once there is a real choice. */}
            {CONTEXT_GRADES.length > 1 ? (
              <>
                <Text style={[ctxStyles.modalSectionLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                  {lang === 'ar' ? 'الصف' : 'Grade'}
                </Text>
                <View style={[ctxStyles.subjRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {CONTEXT_GRADES.map(g => (
                    <Pressable
                      key={g.id}
                      onPress={() => {
                        // Changing grade invalidates the unit/lesson draft,
                        // same as changing subject does below.
                        setDraftGradeId(g.id);
                        setDraftTopic('');
                        setDraftLessonId(null);
                      }}
                      style={[ctxStyles.subjPill, {
                        backgroundColor: draftGradeId === g.id ? colors.primary : colors.muted,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: draftGradeId === g.id ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[ctxStyles.subjText, {
                        color: draftGradeId === g.id ? colors.primaryForeground : colors.mutedForeground,
                        fontFamily: draftGradeId === g.id ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                      }]}>
                        {lang === 'ar' ? g.nameAr : g.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {/* Subject pills */}
            <Text style={[ctxStyles.modalSectionLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left', marginTop: CONTEXT_GRADES.length > 1 ? 18 : 0 }]}>
              {lang === 'ar' ? 'المادة' : 'Subject'}
            </Text>
            <View style={[ctxStyles.subjRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {CONTEXT_SUBJECTS.map((s, i) => (
                <Pressable
                  key={s.subjectId}
                  onPress={() => { setDraftSubjIdx(i); setDraftTopic(''); setDraftLessonId(null); }}
                  style={[ctxStyles.subjPill, {
                    backgroundColor: draftSubjIdx === i ? colors.primary : colors.muted,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: draftSubjIdx === i ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={[ctxStyles.subjText, {
                    color: draftSubjIdx === i ? colors.primaryForeground : colors.mutedForeground,
                    fontFamily: draftSubjIdx === i ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                  }]}>
                    {lang === 'ar' ? s.labelAr : s.labelEn}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Topic selector */}
            <Text style={[ctxStyles.modalSectionLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left', marginTop: 18 }]}>
              {lang === 'ar' ? 'الدرس' : 'Lesson'}
            </Text>
            <TopicSelector
              subjectId={subj.subjectId}
              gradeId={draftGradeId}
              value={draftTopic}
              onChange={setDraftTopic}
              onSelectionDetail={d => setDraftLessonId(d.lessonId)}
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
                fontFamily: 'Cairo_700Bold',
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
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 12,
    marginBottom: 2,
  },
  line: {
    fontFamily: 'Almarai_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  recommend: {
    fontFamily: 'Cairo_500Medium',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  readyText: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 13,
    color: '#047857',
    lineHeight: 20,
  },
});

function MessageBubble({
  message, colors, isRTL, onLongPress, onClarifySubject, onClarifyLesson, onPedagogicalClarify, prepProgress,
  introName, introPitch, introActions, onEditArtifact, onCopy, onExport,
  onSaveMaterial, onAddToClass, onPresentMaterial, busyMaterial,
  copyLabel, exportLabel, t,
}: {
  message: Message; colors: any; isRTL: boolean;
  onLongPress?: (text: string) => void;
  onClarifySubject?: (originalQuery: string, subjectId: string) => void;
  onClarifyLesson?: (originalQuery: string, lessonId: string) => void;
  onPedagogicalClarify?: (originalQuery: string, option: ClarificationOption) => void;
  /** Live session prep progress — shown under the latest meaningful reply. */
  prepProgress?: PrepProgressView | null;
  /** Assistant identity, shown on the opening turn only. */
  introName?: string;
  introPitch?: string;
  /** Starting actions, rendered under the pitch on the opening turn only. */
  introActions?: React.ReactNode;
  /** Commits a change to this message's structured material. */
  onEditArtifact?: (messageId: string, next: ChatArtifactData) => void;
  /** Both take the whole message: what is copied is not always what is shown. */
  onCopy?: (message: Message) => void;
  onExport?: (message: Message) => void;
  /**
   * The three things the tool screens offer once a material exists. Passed
   * only for messages that carry one — a plain answer has nothing to save,
   * file or project.
   */
  onSaveMaterial?: (message: Message) => void;
  onAddToClass?: (message: Message) => void;
  onPresentMaterial?: (message: Message) => void;
  /** Save / present in flight for this message — both are round trips. */
  busyMaterial?: boolean;
  copyLabel?: string;
  exportLabel?: string;
  t: (k: any, ...a: any[]) => string;
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
                    style={{ color: colors.primaryForeground, fontFamily: 'Cairo_500Medium', fontSize: 12, maxWidth: 180 }}
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

  /**
   * The opening turn is an introduction, not a remark.
   *
   * It used to arrive as an ordinary assistant bubble, which put the first
   * thing a teacher ever reads inside the same container as every later reply,
   * and gave the assistant no face, no name and no stated purpose. As a centred
   * intro it does the job an empty state is for: say who this is, say what it
   * can do, then get out of the way. It sits at the top of the thread, so it
   * scrolls off on its own once a real conversation starts.
   */
  if (message.id === 'welcome') {
    return (
      <View style={styles.intro}>
        <IqraaMark size={64} tone="soft" />
        <Text style={[styles.introName, { color: colors.primary, fontFamily: 'Cairo_700Bold' }]}>
          {introName}
        </Text>
        <Text
          style={[
            styles.introPitch,
            {
              color: colors.mutedForeground,
              fontFamily: 'Almarai_400Regular',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        >
          {introPitch}
        </Text>
        {introActions}
      </View>
    );
  }

  // Assistant — avatar + bubble only. Tool shortcuts live in the composer (ephemeral).
  // A lesson plan is a document, so show it as one. The prose around it — the
  // lead-in and the next-step line — still reads as conversation.
  const planData =
    message.artifactData?.kind === 'lesson-plan' ? message.artifactData : null;

  // A rendered document replaces the formatted text it was built from. Showing
  // both put the whole lesson plan on screen twice — once editable, once as the
  // wall of separators the exporter produces.
  const lines = (planData ? (message.artifactProse ?? '') : message.text).split('\n');

  /**
   * The row under the bubble.
   *
   * Copy and export are for any answer long enough to be worth keeping. The
   * other three exist only when the turn produced an actual material, and they
   * are the same three the tool screens end with — save it, file it under a
   * class, put it on the screen. They lead the row and carry the accent colour
   * because they are the next step; copy and export stay muted behind them.
   */
  const artifact = message.artifactData;
  const canAct = Boolean(artifact && message.artifactMeta);
  const messageActions: {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color: string;
    disabled?: boolean;
    onPress: () => void;
  }[] = [];

  if (canAct && onSaveMaterial) {
    const saved = Boolean(message.savedMaterialId);
    messageActions.push({
      key: 'save',
      icon: saved ? 'checkmark-circle' : 'bookmark-outline',
      label: saved ? t('iqraSavedMaterial') : t('iqraSaveMaterial'),
      color: colors.primary,
      disabled: busyMaterial,
      onPress: () => onSaveMaterial(message),
    });
  }
  if (canAct && onAddToClass) {
    messageActions.push({
      key: 'class',
      icon: 'people-outline',
      label: t('iqraAddToClass'),
      color: colors.primary,
      disabled: busyMaterial,
      onPress: () => onAddToClass(message),
    });
  }
  if (canAct && onPresentMaterial && artifact && canPresentArtifact(artifact)) {
    messageActions.push({
      key: 'present',
      icon: 'tv-outline',
      label: t('iqraPresentMaterial'),
      color: '#0EA5E9',
      disabled: busyMaterial,
      onPress: () => onPresentMaterial(message),
    });
  }
  if (onCopy && onExport && (canAct || message.text.trim().length > 60)) {
    messageActions.push(
      {
        key: 'copy',
        icon: 'copy-outline',
        label: copyLabel ?? '',
        color: colors.mutedForeground,
        onPress: () => onCopy(message),
      },
      {
        key: 'export',
        icon: 'share-outline',
        label: exportLabel ?? '',
        color: colors.mutedForeground,
        onPress: () => onExport(message),
      },
    );
  }

  return (
    <View style={[styles.rowAssistant, isRTL && styles.rowAssistantRTL]}>
      <IqraaMark size={34} tone="soft" style={styles.avatar} />
      <View style={{ flex: 1, maxWidth: '82%' }}>
        <Pressable
          onLongPress={() => onLongPress?.(message.text)}
          delayLongPress={500}
          style={[styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 18 }]}
        >
          {planData ? (
            <View style={{ marginBottom: 8 }}>
              <LessonPlanView
                plan={planData.plan}
                colors={colors}
                isRTL={isRTL}
                t={t}
                accent={colors.primary}
                onEdit={
                  onEditArtifact
                    ? (field, value) =>
                        onEditArtifact(message.id, {
                          kind: 'lesson-plan',
                          plan: { ...planData.plan, [field]: value },
                        })
                    : undefined
                }
              />
            </View>
          ) : null}
          {lines.map((line, i) => {
            if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
            const isBold = line.startsWith('**') && line.includes('**');
            if (isBold) {
              const clean = line.replace(/\*\*/g, '');
              return (
                <Text key={i} style={[styles.bubbleBold, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                  {isolateForeignRuns(clean)}
                </Text>
              );
            }
            if (line.startsWith('•')) {
              const text = line.substring(1).trim();
              const parts = text.split('**');
              // A bullet mixing **bold** spans with math is rare enough that
              // falling back to plain inline text (as before) beats trying to
              // nest MathText's Views inside a Text run, which RN doesn't
              // support. Math-only bullets (the common case — a rule or a
              // worked step) get the real layout.
              if (parts.length === 1 && hasRenderableMath(text)) {
                return (
                  <View key={i} style={[styles.bulletRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[{ color: colors.primary, marginTop: 2 }, isRTL ? { marginLeft: 6 } : { marginRight: 6 }]}>•</Text>
                    <View style={{ flex: 1 }}>
                      <MathParagraph
                        text={text}
                        style={{ fontSize: styles.bubbleText.fontSize, lineHeight: styles.bubbleText.lineHeight, color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}
                        isRTL={isRTL}
                      />
                    </View>
                  </View>
                );
              }
              return (
                <View key={i} style={[styles.bulletRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[{ color: colors.primary, marginTop: 2 }, isRTL ? { marginLeft: 6 } : { marginRight: 6 }]}>•</Text>
                  <Text style={[styles.bubbleText, { color: colors.foreground, flex: 1, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
                    {parts.map((p, pi) =>
                      pi % 2 === 1
                        ? <Text key={pi} style={{ fontFamily: 'Cairo_600SemiBold' }}>{isolateForeignRuns(p)}</Text>
                        : isolateForeignRuns(p)
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
              <MathParagraph
                key={i}
                text={line}
                style={{ fontSize: styles.bubbleText.fontSize, lineHeight: styles.bubbleText.lineHeight, color: colors.foreground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }}
                isRTL={isRTL}
              />
            );
          })}
          <Text style={[styles.timestamp, { color: colors.mutedForeground, textAlign: isRTL ? 'left' : 'right' }]}>
            {timeLabel}
          </Text>
        </Pressable>

        {messageActions.length > 0 ? (
          <View style={[styles.msgActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {messageActions.map(action => (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                disabled={action.disabled}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.msgActionBtn,
                  {
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    opacity: action.disabled ? 0.45 : pressed ? 0.6 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Ionicons name={action.icon} size={13} color={action.color} />
                <Text style={[styles.msgActionText, { color: action.color }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
                  <Text style={[styles.suggestionChipText, { color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {message.clarificationLessons && message.clarificationLessons.length > 0 && (
          <View style={[styles.suggestionChipsRow, isRTL && { flexDirection: 'row-reverse' }]}>
            {message.clarificationLessons.map(candidate => (
              <Pressable
                key={candidate.id}
                onPress={() => onClarifyLesson?.(message.clarificationQuery ?? '', candidate.id)}
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
                <Text style={[styles.suggestionChipText, { color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }]}>
                  {candidate.title}
                </Text>
              </Pressable>
            ))}
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
                <Text style={[styles.suggestionChipText, { color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }]}>
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

  const mode: Mode = 'teacher';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [teachingCtx, setTeachingCtx] = useState('');
  // The lesson id that came with `teachingCtx`, when the sheet supplied one.
  // Without it the retrieval below re-derived the lesson from the topic
  // string and could seat a neighbouring lesson at the top of the results.
  const [teachingCtxLessonId, setTeachingCtxLessonId] = useState<string | null>(null);
  /** Latest `teachingCtx`, readable from async callbacks without a re-render. */
  const teachingCtxRef = useRef(teachingCtx);
  /** Session memory for collaborative Demo Mode chat (active lesson + prior asks). */
  const [sessionMemory, setSessionMemory] = useState<ChatSessionMemory>(() =>
    seedDefaultLessonMemory(emptyChatSessionMemory()),
  );
  const [sessionDocs, setSessionDocs] = useState<SessionDocument[]>(() => getSessionDocuments());
  /** Composer-only shortcuts — cleared as soon as the teacher taps one or sends a message. */
  const [ephemeralSuggestions, setEphemeralSuggestions] = useState<EphemeralSuggestion[]>([]);
  /** Status line while the assistant is working (lesson plan vs generic). */
  const [thinkingLabel, setThinkingLabel] = useState('');
  /**
   * Collapsed by default. Expanded, the lesson card ran to about a third of a
   * phone screen above a conversation that had not started — the same weight
   * the header just shed. One line states the lesson and its prep count; the
   * breadcrumb, Change Lesson and the resource chips are one tap away.
   */
  const [lessonCardCollapsed, setLessonCardCollapsed] = useState(true);
  const [startingClass, setStartingClass] = useState(false);
  const [startClassError, setStartClassError] = useState('');
  const [changeLessonOpen, setChangeLessonOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  const [exportVisible, setExportVisible] = useState(false);
  /**
   * Workspace id waiting for a class, or null. Set right after a material's
   * first save — the same "which class is this for?" moment the tool screens
   * have, and the reason the sheet is opened on an id rather than on a message.
   */
  const [classPromptFor, setClassPromptFor] = useState<string | null>(null);
  /**
   * The class that material is already in, so the sheet opens on its current
   * answer rather than asking from scratch. Null means unfiled — which is also
   * what a class deleted since is resolved to, rather than a stale name.
   */
  const [classPromptCurrent, setClassPromptCurrent] = useState<string | null>(null);
  /** Message whose save is in flight — its action row is disabled meanwhile. */
  const [materialBusyId, setMaterialBusyId] = useState<string | null>(null);
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
  // True while the last thing IQRA said was the clarify question. Answering it
  // with something the router still cannot classify must not re-ask it.
  const awaitingClarifyRef = useRef(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  /** Centred column on desktop web; full-bleed on phones. */
  const centered = { width: '100%' as const, maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' as const };

  // Web has no notch and no native header, so the 67pt allowance left a band
  // of dead space above the logo in the browser.
  const topPad = insets.top > 0
    ? insets.top
    : (Platform.OS === 'web' ? 14 : 67);

  /**
   * Persist an edit made to a message's structured material.
   *
   * The message keeps its prose as-is: the lead-in and the next-step line are
   * conversation, not part of the document, and rewriting them from an edited
   * plan would put words in the assistant's mouth it never said.
   */
  /**
   * What copy and export actually hand over.
   *
   * Not the text on screen: a rendered document shows only the conversation
   * around it, and an edited one has drifted from the text it was generated
   * with. Re-serialising from the structured data is the only version that is
   * both complete and current — exporting `message.text` after an edit would
   * quietly ship the plan as first written.
   */
  const documentTextFor = useCallback((message: Message): string => {
    const data = message.artifactData;
    const meta = message.artifactMeta;
    if (!data || !meta) return message.text;
    const isAr = lang === 'ar';
    const m = { subject: meta.subject, grade: meta.grade, duration: meta.duration };
    switch (data.kind) {
      case 'lesson-plan':
        return formatLessonPlanText(data.plan, meta.title, m, isAr);
      case 'worksheet':
        return formatWorksheetText(data.worksheet, meta.title, m, isAr);
      case 'quiz':
        return formatQuizText(data.quiz, meta.title, m, isAr);
      case 'activity':
        return formatActivityText(data.activity, meta.title, m, isAr);
      default:
        return message.text;
    }
  }, [lang]);

  const handleCopyMessage = useCallback(async (message: Message) => {
    await copyToClipboard(documentTextFor(message));
    void Haptics.selectionAsync().catch(() => {});
    showToast(t('copiedToClipboard'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentTextFor, t]);

  const handleExportMessage = useCallback((message: Message) => {
    setExportText(documentTextFor(message));
    setExportVisible(true);
  }, [documentTextFor]);

  const handleEditArtifact = useCallback((messageId: string, next: ChatArtifactData) => {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, artifactData: next } : m)),
    );
  }, []);

  /**
   * File a chat-generated material in the workspace, or update the one this
   * message already owns.
   *
   * Saves the structured object, not the chat text: the workspace viewer parses
   * `content` back into a lesson plan or a worksheet, and re-generating it from
   * prose would land there as an unreadable blob. It also saves whatever the
   * teacher has edited in the bubble, because `artifactData` is the edited copy.
   *
   * Returns the workspace id so callers that need one — filing it under a class
   * — can chain, and null when nothing was written. Saying "saved" on a failed
   * write is the one outcome worse than the failure.
   */
  const saveMessageMaterial = useCallback(async (message: Message): Promise<string | null> => {
    const data = message.artifactData;
    const meta = message.artifactMeta;
    if (!data || !meta) return null;
    const topic = message.lessonTopic?.trim() || meta.title;
    const payload = {
      type: materialTypeFor(data.kind),
      title: meta.title,
      subject: meta.subject,
      grade: meta.grade,
      topic,
      language: lang as 'ar' | 'en',
      content: JSON.stringify(materialContentFor(data)),
      formState: materialFormStateFor(topic),
    };
    try {
      if (message.savedMaterialId) {
        const ok = await updateItem(message.savedMaterialId, payload);
        if (!ok) {
          showToast(t('iqraSaveFailed'));
          return null;
        }
        showToast(t('updatedSuccess'));
        return message.savedMaterialId;
      }
      const saved = await saveItem(payload);
      setMessages(prev =>
        prev.map(m => (m.id === message.id ? { ...m, savedMaterialId: saved.id } : m)),
      );
      showToast(t('savedSuccess'));
      return saved.id;
    } catch {
      showToast(t('iqraSaveFailed'));
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, t]);

  const handleSaveMaterial = useCallback(async (message: Message) => {
    if (materialBusyId) return;
    setMaterialBusyId(message.id);
    try {
      const firstSave = !message.savedMaterialId;
      const id = await saveMessageMaterial(message);
      if (!id) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Only on a first save, exactly as the generator screens do: re-saving an
      // edit must not re-ask a question the teacher already answered.
      if (firstSave) setClassPromptFor(id);
    } finally {
      setMaterialBusyId(null);
    }
  }, [materialBusyId, saveMessageMaterial]);

  /**
   * A class link is a field on a saved material, so an unsaved one is saved
   * first — otherwise this button would have nothing to attach and the teacher
   * would have to know to press Save before it.
   */
  const handleAddToClass = useCallback(async (message: Message) => {
    if (materialBusyId) return;
    setMaterialBusyId(message.id);
    try {
      const id = message.savedMaterialId ?? await saveMessageMaterial(message);
      if (!id) return;
      // Read the class it is in before asking, so a second tap offers to move
      // or remove it instead of re-asking a question already answered.
      let current: string | null = null;
      try {
        current = (await getItem(id))?.classGroupId ?? null;
      } catch {
        // Offline: the sheet opens with nothing ticked, which is honest — it
        // could not confirm a class, so it claims none.
      }
      setClassPromptCurrent(current);
      setClassPromptFor(id);
    } finally {
      setMaterialBusyId(null);
    }
  }, [materialBusyId, saveMessageMaterial]);

  const closeClassPrompt = useCallback(() => {
    setClassPromptFor(null);
    setClassPromptCurrent(null);
  }, []);

  const attachMaterialToClass = useCallback(async (picks: ClassPick[]) => {
    const materialId = classPromptFor;
    closeClassPrompt();
    if (!materialId || picks.length === 0) return;
    // One column, many classes: the first keeps it, the rest get copies.
    const outcome = await attachToClasses(materialId, picks.map(p => p.id));
    showToast(describeAttachResult(outcome, picks, t, lang as Lang));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classPromptFor, closeClassPrompt, t, lang]);

  const detachMaterialFromClass = useCallback(async () => {
    const materialId = classPromptFor;
    closeClassPrompt();
    if (!materialId) return;
    const ok = await updateItem(materialId, { classGroupId: null });
    showToast(ok ? t('removedFromClass') : t('saveToClassFailed'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classPromptFor, closeClassPrompt, t]);

  /**
   * Project the material this turn produced.
   *
   * Deck building is synchronous and local — the plan, worksheet or quiz is
   * already in hand, so unlike «ابدأ الحصة» this needs no round trip and
   * projects exactly what is on screen rather than generating something new.
   */
  const handlePresentMaterial = useCallback((message: Message) => {
    const data = message.artifactData;
    const meta = message.artifactMeta;
    if (!data || !meta) return;
    const topic = message.lessonTopic?.trim() || meta.title;
    try {
      const deck = deckForArtifact(data, {
        topic,
        isAr: lang === 'ar',
        lesson: message.curriculumLessonId
          ? getLessonById(message.curriculumLessonId) ?? null
          : null,
        subject: meta.subject,
        grade: meta.grade,
      });
      if (!deck) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setPendingClassroomActivity(deck);
      trackEvent('class_started', { source: 'chat_material', material: data.kind });
      router.push('/ai-tools/classroom/presentation' as any);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(t('iqraPresentFailed'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, t]);

  // Welcome message on mount / language change — reset session, keep one default active lesson
  useEffect(() => {
    setSessionMemory(seedDefaultLessonMemory(emptyChatSessionMemory()));
    clearSessionDocuments();
    setEphemeralSuggestions([]);
    setLessonCardCollapsed(true);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: t(DOCUMENT_UPLOAD_ENABLED ? 'iqraWelcomeDocs' : 'iqraWelcome'),
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
      // A pick made in the sheet while this read was in flight wins — but the
      // topic and its lesson id must move together, so both are guarded by
      // the same condition rather than by two independent updaters.
      if (!teachingCtxRef.current.trim()) {
        setTeachingCtx(pick.topic);
        setTeachingCtxLessonId(pick.lessonId ?? null);
      }
      // Restore the exact lesson that was picked. Re-deriving it from the
      // saved title put the teacher on a neighbouring lesson often enough
      // that «ابدأ الحصة» could open on something they never chose.
      const restored = resolvePickedLesson(pick.topic, pick, lang as 'ar' | 'en');
      if (restored) {
        setSessionMemory(prev => pinLesson(prev, restored, 'soft'));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    teachingCtxRef.current = teachingCtx;
  }, [teachingCtx]);

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

      // Demo-mode replies are near-instant, which makes the thinking bubble
      // flash imperceptibly. A short dwell keeps the "اقرأ يكتب…" moment
      // visible; real AI latency will replace this entirely.
      if (DEMO_MODE) {
        await new Promise(resolve => setTimeout(resolve, 750));
      }

      // 0. Intent Router — BEFORE curriculum context / Teaching Assistant.
      //    Greetings & small talk must never trigger lesson generation.
      const route = classifyChatIntent(q, lang as 'ar' | 'en', awaitingClarifyRef.current);
      awaitingClarifyRef.current = route.intent === 'ambiguous';
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

      // The lesson this send was explicitly pinned to, when there is one. It
      // is also the honest teaching context: `teachingCtx` and
      // `sessionMemory` in this closure still describe the previous lesson
      // when the send comes from the change-lesson sheet, which is how a
      // reply about the newly picked lesson could still announce «تركيزك
      // الحالي» as the one the teacher had just left.
      const pinnedLesson = pinnedLessonId ? getLessonById(pinnedLessonId) : null;

      let results: KBLesson[];
      if (pinnedLessonId) {
        results = pinnedLesson
          ? [pinnedLesson]
          : deduplicateByUnit(searchKBSemantic(q, lang as 'ar' | 'en'), 3);
      } else {
        results = deduplicateByUnit(
          ranked.length ? ranked.map(r => r.lesson) : searchKBSemantic(q, lang as 'ar' | 'en'),
          3,
        );
      }

      // Prefer explicit teaching-context lesson when available
      if (!pinnedLessonId && teachingCtx.trim()) {
        const ctxLesson = resolvePickedLesson(
          teachingCtx.trim(),
          { lessonId: teachingCtxLessonId },
          lang as 'ar' | 'en',
        );
        if (ctxLesson) {
          results = [ctxLesson, ...results.filter(r => r.id !== ctxLesson.id)].slice(0, 3);
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
      let artifactData: ChatArtifactData | undefined;
      let artifactProse: string | undefined;
      let artifactMeta: Message['artifactMeta'];
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
          teachingContext: pinnedLesson
            ? (lang === 'ar' ? pinnedLesson.titleAr : pinnedLesson.titleEn)
            : (teachingCtx || sessionMemory.activeTopicAr || sessionMemory.activeTopicEn),
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

      // Guessed lesson → confirm before building on it.
      //
      // An artifact is where being wrong is expensive: a weak fuzzy match still
      // produces a full worksheet that claims NCCD grounding, and the teacher
      // finds out in front of a class. Retrieval below the confidence bar used
      // to be discarded outright, which is what made chat feel like it demanded
      // a lesson it could have guessed — so instead of dropping the candidates,
      // offer them. One tap re-runs the same ask, hard-pinned.
      //
      // Deliberately not applied to teaching answers: there, a near-miss costs a
      // sentence the teacher can correct in the next turn, and the question
      // would cost more than the mistake.
      const lessonGuess = shouldAskWhichLesson({
        intent: route.intent,
        hasHardContext,
        hasDocuments: hasDocs,
        isSoftBareArtifact: softBareArtifact,
        ranked,
      });
      if (lessonGuess.ask) {
        const clarifyMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: lessonGuess.candidates.length === 1 ? t('iqraDidYouMean') : t('iqraWhichLesson'),
          clarificationLessons: lessonGuess.candidates.map(c => ({
            id: c.id,
            title: lang === 'ar' ? c.titleAr : c.titleEn,
          })),
          clarificationQuery: q,
          timestamp: new Date(),
        };
        // The `finally` on the enclosing try clears the thinking state, the
        // same way the subject-clarification branch above relies on it.
        setMessages(prev => [...prev, clarifyMsg]);
        return;
      }

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
          artifactData = generated.data;
          artifactProse = generated.prose;
          artifactMeta = {
            title: generated.title,
            subject: generated.meta.subject,
            grade: generated.meta.grade,
            duration: generated.meta.duration,
          };
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
        && (hasKBMatch || hasDocs)
        && !pedagogicalClarification
        && (quickTopic || (teachingActions && teachingActions.length > 0)),
      );

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        artifactData,
        artifactProse,
        artifactMeta,
        sources: results,
        lessonTopic,
        quickTopic,
        teachingActions,
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
    [deepLinkColor, deepLinkLessonId, lang, messages, mode, sessionMemory, t, teachingCtx, teachingCtxLessonId],
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

  // Confirming a guessed lesson re-runs the original ask against that lesson —
  // `pinnedLessonId` is the same door the lesson suggestion chips already use,
  // so the confirmed turn is grounded exactly as a confident hit would be.
  const handleClarifyLesson = useCallback(
    (originalQuery: string, lessonId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sendMessage(originalQuery, lessonId);
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
        // Without the lesson's own picker indices the tool opens on
        // Mathematics whatever the teacher is teaching — see
        // `lessonPickerParams`.
        params: {
          topic,
          ...(lessonPickerParams(sessionMemory.activeLessonId, lang as 'ar' | 'en') ?? {}),
          ...hw,
        },
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

  /**
   * The "+" menu.
   *
   * Tools the conversation can carry out itself run here and the result lands in
   * the thread — that is the whole point of reaching them from the composer.
   * Anything chat cannot produce (the projector deck, the flow editor, GeoGebra)
   * still hands off to its own screen, carrying the current lesson with it.
   */
  const CHAT_NATIVE_TOOLS: Record<string, SessionArtifact> = {
    'lesson-plan': 'lesson-plan',
    worksheet: 'worksheet',
    quiz: 'quiz',
    activity: 'activity',
    homework: 'homework',
  };

  const toolsMenuSections: MenuSection[] = [
    { id: 'before', title: t('toolsBeforeClass'), tools: BEFORE_CLASS },
    { id: 'during', title: t('toolsDuringClass'), tools: DURING_CLASS },
    { id: 'after', title: t('toolsAfterClass'), tools: AFTER_CLASS },
  ];

  const toolsMenuActions: MenuAction[] = DOCUMENT_UPLOAD_ENABLED
    ? [
      {
        id: 'attach-file',
        icon: 'document-attach-outline',
        label: t('chatToolsAttachFile'),
        onPress: async () => {
          setToolsMenuOpen(false);
          const picked = await pickTeachingDocuments();
          if (picked.length) {
            await addAndProcessFiles(picked, (name: string) => showToast(t('docRejected', name)));
          }
        },
      },
      {
        id: 'attach-image',
        icon: 'image-outline',
        label: t('chatToolsAttachImage'),
        onPress: async () => {
          setToolsMenuOpen(false);
          const picked = await pickTeachingImages();
          if (picked.length) {
            await addAndProcessFiles(picked, (name: string) => showToast(t('docRejected', name)));
          }
        },
      },
    ]
    : [];

  const handleToolSelect = useCallback((tool: ToolDef) => {
    setToolsMenuOpen(false);
    void Haptics.selectionAsync().catch(() => {});
    trackEvent('tool_opened', { toolId: tool.id, source: 'chat_menu' });

    const topic =
      (lang === 'ar' ? sessionMemory.activeTopicAr : sessionMemory.activeTopicEn) ?? '';

    if (tool.externalAction === 'geogebra-graphing') {
      void openGeogebraGraphing();
      return;
    }

    const artifact = CHAT_NATIVE_TOOLS[tool.id];
    if (artifact && topic) {
      // `false` = generate rather than open: the teacher asked for the tool, not
      // for whatever was made earlier.
      handleResourcePress(artifact, false);
      return;
    }

    if (tool.id === 'simplify' && topic) {
      sendMessage(
        lang === 'ar'
          ? `بسّط شرح هذا الدرس بلغة يفهمها الطلاب: ${topic}`
          : `Explain this lesson in simple language students understand: ${topic}`,
        sessionMemory.activeLessonId ?? undefined,
      );
      return;
    }

    if (tool.route) {
      router.push({
        pathname: tool.route as any,
        params: {
          ...(topic ? { topic } : {}),
          // The lesson's grade and subject travel with the topic. A tool's own
          // `routeParams` still win — they are the explicit choice.
          ...(lessonPickerParams(sessionMemory.activeLessonId, lang as 'ar' | 'en') ?? {}),
          ...(tool.routeParams ?? {}),
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleResourcePress, lang, sendMessage, sessionMemory]);

  const currentLessonView = buildCurrentLessonView(sessionMemory, sessionDocs, lang as 'ar' | 'en');

  /**
   * Class Mode entry, carried over from the retired home screen: build a deck
   * for the current lesson straight from the curriculum book and go to the
   * projector. No prep required — the teacher can start cold.
   *
   * Guarded against a second tap because the deck generation is an async round
   * trip; without it, an impatient double tap queues two decks and the second
   * overwrites the first mid-navigation.
   */
  const handleStartClass = useCallback(async () => {
    if (startingClass) return;
    const topic = currentLessonView?.topic?.trim();
    if (!topic) return;
    setStartingClass(true);
    setStartClassError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // The lesson's OWN subject, not the deck builder's maths default. That
      // default was silent and wrong: `isMathContext` reads the subject name,
      // so a chemistry lesson announced as "Mathematics" came back as a deck
      // of algebra questions under the chemistry title — the teacher changed
      // the lesson and «ابدأ الحصة» still projected the previous subject.
      const activity = await buildClassDeck({
        topic,
        lang: lang as 'ar' | 'en',
        subjectId: currentLessonView?.subjectId,
        subjectName: currentLessonView?.subjectName,
        // Only when a lesson is genuinely pinned: with a free-typed topic the
        // card falls back to the demo lesson for its labels, and grounding the
        // deck on that fallback would be the very swap this fixes.
        lessonId: sessionMemory.activeLessonId,
      });
      setPendingClassroomActivity(activity);
      trackEvent('class_started', { source: 'chat' });
      router.push('/ai-tools/classroom/presentation' as any);
    } catch {
      // Surfacing this as a chat message would still be wrong — the teacher
      // pressed a button on a card, they did not ask a question. But saying
      // nothing at all was worse: `Haptics` is a no-op on web, so the whole
      // failure signal was a buzz that platform never plays, and the press
      // vanished. The card says what happened instead, and stays the retry.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStartClassError(t('startClassFailed'));
    } finally {
      setStartingClass(false);
    }
  }, [
    startingClass,
    currentLessonView?.topic,
    currentLessonView?.subjectId,
    currentLessonView?.subjectName,
    sessionMemory.activeLessonId,
    lang,
    t,
  ]);
  const lessonSuggestions = buildLessonSuggestions(
      sessionMemory,
      lang as 'ar' | 'en',
    sessionDocs.some(d => d.status === 'ready'),
  );
  const suggestions = lessonSuggestions.length > 0
    ? []
    : SUGGESTIONS[mode][lang as 'ar' | 'en'];
  /**
   * The starting actions, in one place.
   *
   * They render inside the intro while the thread is empty and above the
   * composer once it isn't — the same chips either way, so "حضّر خطة الدرس"
   * does not become a different affordance halfway through a conversation.
   */
  const starterChips = (variant: 'intro' | 'composer') => {
    const items = lessonSuggestions.length > 0
      ? lessonSuggestions.map(sug => ({
        key: sug.id,
        label: `${sug.emoji} ${lang === 'ar' ? sug.labelAr : sug.labelEn}`,
        onPress: () => handleLessonSuggestion(sug),
      }))
      : suggestions.map((sug, i) => ({
        key: `s-${i}`,
        label: sug.text,
        onPress: () => sendMessage(sug.text, sug.lessonId),
      }));
    if (items.length === 0) return null;

    return (
      <View
        style={[
          variant === 'intro' ? styles.introChips : styles.composerChips,
          { flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        {items.map(item => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.primary + '2E',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: colors.primary, fontFamily: 'Cairo_500Medium' }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const livePrepProgress = DEMO_MODE
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
        {/*
          Identity only.
          The header used to carry the mark, the wordmark, a tagline, the demo
          label and a scrolling strip of tool chips — five things above a
          conversation that had not started yet, on a phone where that strip
          cost a third of the screen. The chips are actions, so they belong
          where the teacher is acting: in the thread while it is empty, above
          the composer once it isn't. What is left here is the logo, plus the
          demo pill, which stays because hiding it would let sample content
          read as real.
        */}
        <View style={[styles.headerTop, centered, isRTL && { flexDirection: 'row-reverse' }]}>
          {/*
            The mark, not the lockup. BrandLogo is the full two-line lockup —
            اقرأ stacked over the IQRA wordmark — in a 1024px square; at the 28px
            this header allows, each line of type lands about ten pixels tall and
            dissolves into a grey smudge. IqraaMark exists for exactly this size
            (see its own note), and the word beside it is live text, so it stays
            sharp and reads at a glance.
          */}
          <View style={[styles.brandRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <IqraaMark size={30} tone="brand" />
            <Text style={[styles.brandWord, { color: colors.foreground }]}>
              {t('appName')}
            </Text>
          </View>
          <AiSourceBadge isRTL={isRTL} />
        </View>
      </View>

      {/* ─── Current lesson (persistent, collapses on scroll) ───────── */}
      {currentLessonView ? (
        <CurrentLessonCard
          lesson={currentLessonView}
          collapsed={lessonCardCollapsed}
          isRTL={isRTL}
          lang={lang as 'ar' | 'en'}
          colors={colors}
          startClassLabel={t('startClass')}
          startClassBusy={startingClass}
          startClassError={startClassError}
          onStartClass={handleStartClass}
          changeLabel={t('changeLesson')}
          uploadedLabel={(n) => t('lessonUploadedFiles', n)}
          onChangeLesson={() => setChangeLessonOpen(true)}
          onToggleCollapse={() => setLessonCardCollapsed(c => !c)}
        />
      ) : null}

      {(
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
            void saveLessonPick({
              topic: pick.topic,
              unitOrder: null,
              subjectId: pick.subjectId,
              gradeId: pick.gradeId,
              lessonId: pick.lessonId,
            });
          }}
          onContextChange={(ctx, pick) => {
            setTeachingCtx(ctx);
            setTeachingCtxLessonId(pick?.lessonId ?? null);
            if (!ctx.trim()) return;
            const picked = resolvePickedLesson(ctx, pick, lang as 'ar' | 'en');
            if (picked) {
              setSessionMemory(prev => pinLesson(prev, picked, 'hard'));
            } else {
              // No curriculum lesson behind this topic. Drop the previous
              // lesson id as well as its title: keeping it left every
              // generator — and «ابدأ الحصة» — grounded on the lesson the
              // teacher just navigated away from, while the card showed the
              // new topic. Both language fields move together for the same
              // reason; a half-updated pair reads as the old lesson in the
              // other language.
              const topic = ctx.trim();
              setSessionMemory(prev => ({
                ...prev,
                activeLessonId: null,
                activeTopicAr: topic,
                activeTopicEn: topic,
                lessonPin: 'hard',
              }));
            }
          }}
          onAsk={(topic, pick) => {
            // `onContextChange` just fired and queued the pin update for this
            // same topic, but React hasn't applied it yet — `sessionMemory`
            // in this closure is still the *previous* lesson. Passing that
            // stale id here as `pinnedLessonId` forced sendMessage's pipeline
            // to keep answering about the lesson the teacher just left.
            // Resolve fresh, the same way onContextChange does, so both agree
            // on the lesson that was actually just picked.
            const picked = resolvePickedLesson(topic, pick, lang as 'ar' | 'en');
            // Same trap the subject line used to have: this used to say
            // "Grade 10" unconditionally, which misdescribed the lesson to
            // the model for every Grade 9 pick.
            const grade = CONTEXT_GRADES.find(g => g.id === pick?.gradeId) ?? CONTEXT_GRADES[0];
            sendMessage(
              lang === 'ar'
                ? `أدرّس "${topic}" ${grade ? `لطلاب ${grade.nameAr}` : 'للصف العاشر'}. أعطني نظرة شاملة عن الموضوع مع أهم مفاهيمه.`
                : `I'm teaching "${topic}" to ${grade?.name ?? 'Grade 10'} students. Give me a comprehensive overview of this topic with key concepts.`,
              picked?.id ?? undefined,
            );
          }}
        />
      )}

      {/* ─── Messages ──────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.messageList, centered]}
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
            onLongPress={item.role === 'assistant' ? () => handleExportMessage(item) : undefined}
            onCopy={item.role === 'assistant' ? handleCopyMessage : undefined}
            onExport={item.role === 'assistant' ? handleExportMessage : undefined}
            onSaveMaterial={item.role === 'assistant' ? handleSaveMaterial : undefined}
            onAddToClass={item.role === 'assistant' ? handleAddToClass : undefined}
            onPresentMaterial={item.role === 'assistant' ? handlePresentMaterial : undefined}
            busyMaterial={materialBusyId === item.id}
            copyLabel={t('iqraCopyMessage')}
            exportLabel={t('iqraExportMessage')}
            onClarifySubject={handleClarifySubject}
            onClarifyLesson={handleClarifyLesson}
            onPedagogicalClarify={handlePedagogicalClarify}
            introName={t('iqraAgentName')}
            introPitch={t('iqraAgentPitch')}
            // Only while the thread is still just the intro — otherwise the
            // same three chips appear twice on one screen.
            introActions={
              item.id === 'welcome' && messages.length <= 1 ? starterChips('intro') : null
            }
            t={t}
            onEditArtifact={handleEditArtifact}
            prepProgress={
              item.id === lastPrepMessageId ? livePrepProgress : null
            }
          />
        )}
        ListFooterComponent={
          isThinking ? (
            <View style={[styles.thinkingRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <IqraaMark size={34} tone="soft" thinking style={styles.avatar} />
              <View style={[styles.thinkingBubble, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.thinkingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                  {thinkingLabel || t('iqraTyping')}
                </Text>
              </View>
            </View>
          ) : null
        }
      />

      {/*
        Standing shortcuts, above the composer.
        Shown once the intro has scrolled out of the way, and only when the
        one-shot follow-ups below are not — two chip strips stacked on a phone
        is the clutter this change set out to remove.
      */}
      {ephemeralSuggestions.length === 0 && !isThinking && messages.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            maxHeight: 48,
            backgroundColor: colors.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
          contentContainerStyle={[styles.docActionsScroll, centered]}
        >
          {starterChips('composer')}
        </ScrollView>
      ) : null}

      {/* ─── Ephemeral input shortcuts (composer only — leave the timeline) ── */}
      {ephemeralSuggestions.length > 0 && !isThinking ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 48, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
          contentContainerStyle={[
            styles.docActionsScroll,
            centered,
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
              <Text style={{ fontFamily: 'Cairo_500Medium', fontSize: 12, color: colors.foreground }}>
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
        {DOCUMENT_UPLOAD_ENABLED ? (
          <DocumentAttachmentBar
            isRTL={isRTL}
            chipsOnly
            showAttachButtons={false}
            onDocumentsReady={handleDocumentsReady}
            onRejectedFile={(name) => showToast(t('docRejected', name))}
          />
        ) : null}
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.muted, borderRadius: 24 },
            isRTL && { flexDirection: 'row-reverse' },
          ]}
        >
          {/*
            One "+" instead of a row of icons. It opens every teaching tool plus
            the upload actions, so the composer gains the whole catalog without
            gaining a single pixel of chrome.
          */}
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              setToolsMenuOpen(true);
            }}
            style={({ pressed }) => [
              styles.plusBtn,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('chatToolsTitle')}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
          <TextInput
            style={[
              styles.input,
              { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder={t(DOCUMENT_UPLOAD_ENABLED ? 'iqraPlaceholderDocs' : 'iqraPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            // A placeholder is not a label: it is the first thing a screen
            // reader skips and the first thing sighted users lose, the moment
            // they start typing. The name and the instructions have to outlive
            // the empty field.
            accessibilityLabel={t('iqraInputLabel')}
            accessibilityHint={t('iqraInputHint')}
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
      </View>
      <ComposerToolsMenu
        visible={toolsMenuOpen}
        onClose={() => setToolsMenuOpen(false)}
        colors={colors}
        isRTL={isRTL}
        title={t('chatToolsTitle')}
        contextLabel={
          currentLessonView?.unitLesson ? t('chatToolsFor', currentLessonView.unitLesson) : undefined
        }
        actions={toolsMenuActions}
        sections={toolsMenuSections}
        labelFor={(tool) => t(tool.titleKey as any)}
        descFor={(tool) => t(tool.descKey as any)}
        badgeFor={(tool) => (tool.badgeKey ? t(tool.badgeKey as any) : null)}
        onSelectTool={handleToolSelect}
      />
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
      <ClassPickerSheet
        visible={classPromptFor !== null}
        selectedClassId={classPromptCurrent}
        onClose={closeClassPrompt}
        multiple
        onPick={picks => { void attachMaterialToClass(picks); }}
        onClear={() => { void detachMaterialFromClass(); }}
      />
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
/** Reading column. Chat is prose; past ~760px the line length stops being readable. */
const CONTENT_MAX_WIDTH = 760;

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandWord: { fontFamily: 'Cairo_700Bold', fontSize: 19, letterSpacing: 0.2 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12 },
  docActionsScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  docActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },

  messageList: { padding: 16, gap: 12, paddingBottom: 8, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },

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
  avatar: { marginTop: 4 },
  intro: { alignItems: 'center', gap: 10, paddingTop: 28, paddingBottom: 12, paddingHorizontal: 24 },
  introName: { fontSize: 22, textAlign: 'center' },
  introPitch: { fontSize: 14, lineHeight: 23, textAlign: 'center', maxWidth: 380 },
  introChips: { flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  composerChips: { gap: 8 },
  bubbleAssistant: { padding: 14, borderWidth: 1 },
  bubbleBold: { fontSize: 14, fontFamily: 'Cairo_600SemiBold', marginBottom: 2 },
  bubbleText: { fontSize: 13, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 1 },
  sourceText: { fontSize: 11, marginTop: 6, fontFamily: 'Almarai_400Regular', fontStyle: 'italic' },
  timestamp: { fontSize: 10, marginTop: 6, fontFamily: 'Almarai_400Regular' },

  msgActions: { alignItems: 'center', flexWrap: 'wrap', columnGap: 14, rowGap: 8, marginTop: 6, paddingHorizontal: 4 },
  msgActionBtn: { alignItems: 'center', gap: 4 },
  msgActionText: { fontSize: 11, fontFamily: 'Cairo_500Medium' },
  suggestionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggestionChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  suggestionChipText: { fontSize: 12 },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  thinkingText: { fontSize: 13 },

  inputBar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10 },
  inputBarInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingVertical: 0 },
  plusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 1,
  },
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
