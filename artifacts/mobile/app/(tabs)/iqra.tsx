import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const LOGO_MARK  = require('@/assets/images/logo-mark.png');
const LOGO_LOCKUP = require('@/assets/images/logo-lockup.png');
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  KBLesson,
  getLessonById,
  getTopicSuggestions,
  searchKBSemantic,
} from '@/services/knowledgeBase';
import { getLessonById as getCurriculumLessonById } from '@/services/curriculumData';
import {
  CONTEXT_CHAR_BUDGET,
  TRIM_TIERS,
  BlockOpts,
  buildLessonBlock,
  buildResponse,
  deduplicateByUnit,
} from '@/services/kbContext';
import { Toast } from '@/components/ui/Toast';
import { remoteAIService } from '@/services/ai/RemoteAIService';

// ─── Types ──────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant';
type Mode = 'teacher' | 'student';

interface Message {
  id: string;
  role: Role;
  text: string;
  sources?: KBLesson[];
  /** When set, shows a "Generate Lesson Plan" chip. */
  lessonTopic?: string;
  /** When set, shows Worksheet + Quiz quick-action chips. */
  quickTopic?: string;
  /** When set, shows an "Open lesson" chip navigating back to curriculum. */
  curriculumLessonId?: string;
  /** Subject color passed through from curriculum deep-link. */
  subjectColor?: string;
  /** When set, renders tappable topic-suggestion chips below the message text. */
  suggestions?: { text: string; lessonId: string }[];
  timestamp: Date;
}

// ─── Teaching-context subject options ────────────────────────────────────────
const CONTEXT_SUBJECTS = [
  { subjectId: 'mathematics', gradeId: 'grade-10', labelAr: 'رياضيات', labelEn: 'Math' },
  { subjectId: 'chemistry',   gradeId: 'grade-10', labelAr: 'كيمياء',  labelEn: 'Chemistry' },
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
      { text: 'ما هو نموذج بور للذرة؟',               lessonId: 'kbl-chem-1-1' },
      { text: 'اشرح الرابطة التساهمية',               lessonId: 'kbl-chem-3-2' },
      { text: 'ما هو الاقتران العكسي؟',               lessonId: 'kbl-math-1-3' },
      { text: 'قاعدة الاحتمال للحوادث المتنافية',     lessonId: 'kbl-math-8-2' },
      { text: 'الأعداد الكمية وتوزيع الإلكترونات',    lessonId: 'kbl-chem-1-2' },
      { text: 'اشرح قواعد الاشتقاق',                  lessonId: 'kbl-math-2-2' },
    ],
    en: [
      { text: "What is Bohr's model?",                  lessonId: 'kbl-chem-1-1' },
      { text: 'Explain covalent bonding',               lessonId: 'kbl-chem-3-2' },
      { text: 'What is an inverse function?',           lessonId: 'kbl-math-1-3' },
      { text: 'Probability of mutually exclusive events', lessonId: 'kbl-math-8-2' },
      { text: 'Quantum numbers explained',              lessonId: 'kbl-chem-1-2' },
      { text: 'Explain differentiation rules',          lessonId: 'kbl-math-2-2' },
    ],
  },
  student: {
    ar: [
      { text: 'اشرح نموذج بور ببساطة',                lessonId: 'kbl-chem-1-1' },
      { text: 'كيف أحل مسائل الاحتمال؟',              lessonId: 'kbl-math-8-1' },
      { text: 'ما الفرق بين رابطة سيجما وباي؟',       lessonId: 'kbl-chem-3-2' },
      { text: 'كيف أجد مجال الاقتران النسبي؟',        lessonId: 'kbl-math-1-2' },
      { text: 'اشرح مبدأ أوفباو بسهولة',              lessonId: 'kbl-chem-1-2' },
      { text: 'كيف أجد المشتقة؟',                     lessonId: 'kbl-math-2-2' },
    ],
    en: [
      { text: "Help me understand Bohr's model",        lessonId: 'kbl-chem-1-1' },
      { text: 'How do I solve probability problems?',   lessonId: 'kbl-math-8-1' },
      { text: 'Difference between sigma and pi bonds?', lessonId: 'kbl-chem-3-2' },
      { text: 'How to find the domain of a rational function?', lessonId: 'kbl-math-1-2' },
      { text: 'Explain Aufbau principle simply',        lessonId: 'kbl-chem-1-2' },
      { text: 'How do I find a derivative?',            lessonId: 'kbl-math-2-2' },
    ],
  },
};

// ─── Context Banner ───────────────────────────────────────────────────────────
function ContextBanner({
  colors, isRTL, lang, t, onContextChange,
}: {
  colors: any; isRTL: boolean; lang: 'ar' | 'en';
  t: (k: any) => string; onContextChange: (ctx: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subjIdx, setSubjIdx] = useState(0);
  const [topic, setTopicInternal] = useState('');

  const subj = CONTEXT_SUBJECTS[subjIdx];

  const handleTopicChange = (v: string) => {
    setTopicInternal(v);
    onContextChange(v);
  };

  const handleSubjChange = (i: number) => {
    setSubjIdx(i);
    setTopicInternal('');
    onContextChange('');
  };

  const handleClear = () => {
    setTopicInternal('');
    setSubjIdx(0);
    onContextChange('');
    setExpanded(false);
  };

  return (
    <View style={[ctxStyles.container, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
      {/* ── Pill header ── */}
      <View style={[ctxStyles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }, { paddingHorizontal: 16, paddingVertical: 8 }]}>
        <Pressable
          onPress={() => setExpanded(e => !e)}
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
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.mutedForeground} style={{ marginStart: 4 }} />
        </Pressable>
        {topic && (
          <Pressable onPress={handleClear} hitSlop={8} style={ctxStyles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* ── Expanded picker ── */}
      {expanded && (
        <View style={[ctxStyles.expanded, { borderTopColor: colors.border, paddingHorizontal: 16, paddingBottom: 12 }]}>
          {/* Subject toggle */}
          <View style={[ctxStyles.subjRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {CONTEXT_SUBJECTS.map((s, i) => (
              <Pressable
                key={s.subjectId}
                onPress={() => handleSubjChange(i)}
                style={[ctxStyles.subjPill, {
                  backgroundColor: subjIdx === i ? colors.primary : colors.muted,
                  borderRadius: 16,
                }]}
              >
                <Text style={[ctxStyles.subjText, {
                  color: subjIdx === i ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: subjIdx === i ? 'Inter_600SemiBold' : 'Inter_400Regular',
                }]}>
                  {lang === 'ar' ? s.labelAr : s.labelEn}
                </Text>
              </Pressable>
            ))}
          </View>
          <TopicSelector
            subjectId={subj.subjectId}
            gradeId={subj.gradeId}
            value={topic}
            onChange={handleTopicChange}
            lang={lang}
            isRTL={isRTL}
            colors={colors}
            accent={colors.primary}
            t={t}
          />
        </View>
      )}
    </View>
  );
}

// buildResponse, buildLessonBlock, CONTEXT_CHAR_BUDGET, TRIM_TIERS, BlockOpts
// are imported from '@/services/kbContext' above.

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  message, colors, isRTL, mode, onLongPress, onChipPress, onSuggestionPress,
}: {
  message: Message; colors: any; isRTL: boolean; mode: Mode;
  onLongPress?: (text: string) => void;
  onChipPress?: (type: 'worksheet' | 'quiz' | 'lesson-plan' | 'activity' | 'lesson', topic: string, extra?: string) => void;
  onSuggestionPress?: (text: string, lessonId: string) => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={[styles.rowUser, isRTL && styles.rowUserRTL]}>
        <View style={[styles.bubbleUser, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          <Text style={[styles.bubbleText, { color: colors.primaryForeground, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  // Render assistant message with markdown-like formatting
  const lines = message.text.split('\n');
  const hasChips = !!(message.quickTopic);

  return (
    <View style={[styles.rowAssistant, isRTL && styles.rowAssistantRTL]}>
      {/* iQra Avatar */}
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        <Image source={LOGO_MARK} style={{ width: 22, height: 20 }} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, maxWidth: '82%' }}>
        <Pressable
          onLongPress={() => onLongPress?.(message.text)}
          delayLongPress={500}
          style={[styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
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
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Pressable>

        {/* ── Quick-action chips: shown for KB-matched messages and/or curriculum deep-links ── */}
        {(hasChips || !!message.curriculumLessonId) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chipRow, isRTL && { flexDirection: 'row-reverse' }]}
          >
            {hasChips && (
              <>
                <Pressable
                  onPress={() => onChipPress?.('worksheet', message.quickTopic!)}
                  style={({ pressed }) => [styles.actionChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '50', opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.actionChipText, { color: colors.primary }]}>📝 {isRTL ? 'ورقة عمل' : 'Worksheet'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onChipPress?.('quiz', message.quickTopic!)}
                  style={({ pressed }) => [styles.actionChip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '50', opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.actionChipText, { color: colors.primary }]}>❓ {isRTL ? 'اختبار' : 'Quiz'}</Text>
                </Pressable>
                {message.lessonTopic && (
                  <Pressable
                    onPress={() => onChipPress?.('lesson-plan', message.lessonTopic!)}
                    style={({ pressed }) => [styles.actionChip, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '60', opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.actionChipText, { color: colors.primary }]}>📄 {isRTL ? 'خطة درس' : 'Lesson Plan'}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => onChipPress?.('activity', message.quickTopic!)}
                  style={({ pressed }) => [styles.actionChip, { backgroundColor: '#E67E2215', borderColor: '#E67E2250', opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.actionChipText, { color: '#E67E22' }]}>{isRTL ? '⚡ نشاط' : '⚡ Activity'}</Text>
                </Pressable>
              </>
            )}
            {/* "Open lesson" chip is independent — shown whenever message originated from a curriculum deep-link */}
            {message.curriculumLessonId && (
              <Pressable
                onPress={() => onChipPress?.('lesson', message.curriculumLessonId!, message.subjectColor)}
                style={({ pressed }) => [styles.actionChip, { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.actionChipText, { color: colors.foreground }]}>📖 {isRTL ? 'فتح الدرس' : 'Open lesson'}</Text>
              </Pressable>
            )}
            {/* Activity chip from curriculum deep-link — teacher mode only, topic resolved from curriculum lesson id */}
            {message.curriculumLessonId && mode === 'teacher' && !hasChips && (() => {
              const lesson = getCurriculumLessonById(message.curriculumLessonId!);
              const topic = lesson ? (isRTL ? lesson.titleAr : lesson.title) : null;
              if (!topic) return null;
              return (
                <Pressable
                  onPress={() => onChipPress?.('activity', topic)}
                  style={({ pressed }) => [styles.actionChip, { backgroundColor: '#E67E2215', borderColor: '#E67E2250', opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.actionChipText, { color: '#E67E22' }]}>{isRTL ? '⚡ نشاط' : '⚡ Activity'}</Text>
                </Pressable>
              );
            })()}
          </ScrollView>
        )}
        {/* ── Out-of-scope topic suggestion chips ── */}
        {message.suggestions && message.suggestions.length > 0 && (
          <View style={[styles.suggestionChipsRow, isRTL && { flexDirection: 'row-reverse' }]}>
            {message.suggestions.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => onSuggestionPress?.(s.text, s.lessonId)}
                style={({ pressed }) => [
                  styles.suggestionChip,
                  { backgroundColor: colors.primary + '15', borderColor: colors.primary + '60', opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.suggestionChipText, { color: colors.primary, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                  {s.text}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function IqraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
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
  // Deep-link state: curriculum lesson to surface as "Open lesson" chip
  const [deepLinkLessonId, setDeepLinkLessonId] = useState<string | null>(params.lessonId ?? null);
  const [deepLinkColor, setDeepLinkColor] = useState<string | null>(params.subjectColor ?? null);
  // Auto-send: initial message from deep-link, fired once after welcome message appears
  const [autoMessagePending, setAutoMessagePending] = useState<string | null>(params.initialMessage ?? null);
  const listRef = useRef<FlatList>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  // Welcome message on mount / language change
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        text: t('iqraWelcome'),
        timestamp: new Date(),
      },
    ]);
  }, [lang]);

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
    async (text: string, pinnedLessonId?: string) => {
      const q = text.trim();
      if (!q || isThinking) return;
      setInput('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Capture and consume the deep-link state so "Open lesson" chip appears once
      const msgLessonId = deepLinkLessonId;
      const msgColor    = deepLinkColor;
      setDeepLinkLessonId(null);
      setDeepLinkColor(null);

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: q,
        timestamp: new Date(),
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsThinking(true);

      // 1. Local KB retrieval — grounds the AI answer with textbook content.
      //    Deduplicate by unit so the model gets context from distinct curriculum
      //    areas rather than three overlapping lessons from the same unit.
      let results: KBLesson[];
      if (pinnedLessonId) {
        const pinned = getLessonById(pinnedLessonId);
        results = pinned
          ? [pinned]
          : deduplicateByUnit(searchKBSemantic(q, lang as 'ar' | 'en'), 3);
      } else {
        results = deduplicateByUnit(searchKBSemantic(q, lang as 'ar' | 'en'), 3);
      }

      const hasKBMatch = results.length > 0;

      // Detect teacher lesson-plan/worksheet/quiz generation intent
      const planKeywords = /خطة|lesson\s*plan|worksheet|ورقة\s*عمل|اختبار\s*(قصير|تكويني)|quiz|generate.*plan/i;
      const hasPlanIntent = planKeywords.test(q) && hasKBMatch && mode === 'teacher';
      const lessonTopic = hasPlanIntent
        ? (lang === 'ar' ? results[0].titleAr : results[0].titleEn)
        : undefined;

      // Quick-action topic: set for any KB-matched message so worksheet/quiz chips appear
      const quickTopic = hasKBMatch
        ? (lessonTopic ?? (lang === 'ar' ? results[0].titleAr : results[0].titleEn))
        : undefined;

      // 2. Build KB context string for the AI
      //    Prepend teaching context so the AI knows what lesson the teacher is working on.
      const teachingPrefix = teachingCtx
        ? (lang === 'ar'
          ? `[سياق التدريس: المعلم يدرّس حاليًا "${teachingCtx}"]\n\n`
          : `[Teaching context: Teacher is currently teaching "${teachingCtx}"]\n\n`)
        : '';

      const kbContext = hasKBMatch
        ? teachingPrefix + buildResponse(q, results, lang as 'ar' | 'en', mode)
        : (teachingCtx ? teachingPrefix.trim() : undefined);

      // 3. Build conversation history (last 10 messages for context window)
      const history = updatedMessages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }));

      let responseText: string;
      let outOfScopeSuggestions: { text: string; lessonId: string }[] | undefined;

      if (!hasKBMatch) {
        // No textbook content matches — show friendly out-of-scope message with
        // 3 topic suggestion chips drawn from the KB so the user can explore.
        responseText = t('iqraOutOfScope');
        outOfScopeSuggestions = getTopicSuggestions(3, lang as 'ar' | 'en');
      } else {
        try {
          responseText = await remoteAIService.chat({
            messages: history,
            context: kbContext,
            mode,
            language: lang as 'ar' | 'en',
          });
          if (!responseText.trim()) {
            responseText = kbContext ?? t('iqraNoResults');
          }
        } catch {
          responseText = kbContext ?? t('iqraOfflineFallback');
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        sources: results,
        lessonTopic,
        quickTopic,
        curriculumLessonId: msgLessonId ?? undefined,
        subjectColor: msgColor ?? undefined,
        suggestions: outOfScopeSuggestions,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsThinking(false);

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [deepLinkColor, deepLinkLessonId, isThinking, lang, messages, mode, t, teachingCtx],
  );

  // Auto-send deep-link message once welcome message is in place
  useEffect(() => {
    if (autoMessagePending && messages.length === 1 && messages[0].id === 'welcome') {
      const msg = autoMessagePending;
      setAutoMessagePending(null);
      sendMessage(msg);
    }
  }, [messages, autoMessagePending, sendMessage]);

  // Handle quick-action chip taps
  const handleChipPress = useCallback((
    type: 'worksheet' | 'quiz' | 'lesson-plan' | 'activity' | 'lesson',
    topic: string,
    extra?: string,
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'worksheet') {
      router.push(`/ai-tools/worksheet?topic=${encodeURIComponent(topic)}` as any);
    } else if (type === 'quiz') {
      router.push(`/ai-tools/quiz?topic=${encodeURIComponent(topic)}` as any);
    } else if (type === 'lesson-plan') {
      router.push(`/ai-tools/lesson-plan?topic=${encodeURIComponent(topic)}` as any);
    } else if (type === 'activity') {
      router.push(`/ai-tools/activity?topic=${encodeURIComponent(topic)}` as any);
    } else if (type === 'lesson') {
      router.push({
        pathname: '/curriculum/lesson-detail',
        params: { lessonId: topic, subjectColor: extra ?? colors.primary },
      });
    }
  }, [colors.primary]);

  const suggestions = SUGGESTIONS[mode][lang as 'ar' | 'en'];

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
              <Image source={LOGO_MARK} style={{ width: 26, height: 24 }} resizeMode="contain" />
            </View>
            <View>
              <Image
                source={LOGO_LOCKUP}
                style={[styles.headerLockup, isRTL && { alignSelf: 'flex-end' }]}
                resizeMode="contain"
              />
              <Text style={[styles.headerSub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
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

        {/* Suggestions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.suggestionsScroll, isRTL && { flexDirection: 'row-reverse' }]}
        >
          {suggestions.map((s, i) => (
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

        {/* ── Teaching-context banner (teacher mode only) ── */}
        {mode === 'teacher' && (
          <ContextBanner
            colors={colors}
            isRTL={isRTL}
            lang={lang as 'ar' | 'en'}
            t={t}
            onContextChange={setTeachingCtx}
          />
        )}
      </View>

      {/* ─── Messages ──────────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            colors={colors}
            isRTL={isRTL}
            mode={mode}
            onChipPress={handleChipPress}
            onLongPress={item.role === 'assistant' ? async (text) => {
              await Clipboard.setStringAsync(text);
              showToast(t('copiedToClipboard'));
            } : undefined}
            onSuggestionPress={(text, lessonId) => sendMessage(text, lessonId)}
          />
        )}
        ListFooterComponent={
          isThinking ? (
            <View style={[styles.thinkingRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                <Image source={LOGO_MARK} style={{ width: 22, height: 20 }} resizeMode="contain" />
              </View>
              <View style={[styles.thinkingBubble, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.thinkingText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {t('iqraTyping')}
                </Text>
              </View>
            </View>
          ) : null
        }
      />

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
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.muted, borderRadius: 24 },
            isRTL && { flexDirection: 'row-reverse' },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' },
            ]}
            placeholder={t('iqraPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={400}
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

  messageList: { padding: 16, gap: 12, paddingBottom: 8 },

  rowUser: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  rowUserRTL: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleUser: { maxWidth: '75%', padding: 12, paddingHorizontal: 16 },

  rowAssistant: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  rowAssistantRTL: { flexDirection: 'row-reverse' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 },
  bubbleAssistant: { padding: 14, borderWidth: 1 },
  bubbleBold: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  bubbleText: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 1 },
  sourceText: { fontSize: 11, marginTop: 6, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  timestamp: { fontSize: 10, marginTop: 6, fontFamily: 'Inter_400Regular' },

  chipRow: { flexDirection: 'row', gap: 6, marginTop: 6, paddingBottom: 2 },
  actionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  actionChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

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
  expanded:   { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  subjRow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  subjPill:   { paddingHorizontal: 14, paddingVertical: 6 },
  subjText:   { fontSize: 13 },
});
