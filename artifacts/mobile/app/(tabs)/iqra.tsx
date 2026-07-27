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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  KBLesson,
  getBookForLesson,
  getLessonById,
  getUnitForLesson,
  searchKBSemantic,
} from '@/services/knowledgeBase';
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
  /** When set, shows a "Generate Lesson Plan" action button linking to the generator. */
  lessonTopic?: string;
  timestamp: Date;
}

// ─── Suggested questions per mode/language ───────────────────────────────────
interface Suggestion {
  text: string;
  /** When set, tapping this chip bypasses search and fetches the lesson directly. */
  lessonId?: string;
}

const SUGGESTIONS: Record<Mode, Record<'ar' | 'en', Suggestion[]>> = {
  teacher: {
    ar: [
      { text: 'اشرح قواعد الاشتقاق',                   lessonId: 'kbl-math-2-2' },
      { text: 'ما هي المتجهات في المستوى؟',             lessonId: 'kbl-math-3-1' },
      { text: 'النسب المثلثية للزوايا',                 lessonId: 'kbl-math-s2-3-1' },
      { text: 'قانون الجيوب وتطبيقاته',                lessonId: 'kbl-math-s2-4-2' },
      { text: 'ما هو الاقتران العكسي؟',                lessonId: 'kbl-math-1-3' },
      { text: 'قاعدة الاحتمال للحوادث المتنافية',      lessonId: 'kbl-math-8-2' },
    ],
    en: [
      { text: 'Explain differentiation rules',          lessonId: 'kbl-math-2-2' },
      { text: 'What are vectors in the plane?',         lessonId: 'kbl-math-3-1' },
      { text: 'Trigonometric ratios explained',         lessonId: 'kbl-math-s2-3-1' },
      { text: 'Law of Sines and applications',          lessonId: 'kbl-math-s2-4-2' },
      { text: 'What is an inverse function?',           lessonId: 'kbl-math-1-3' },
      { text: 'Probability of mutually exclusive events', lessonId: 'kbl-math-8-2' },
    ],
  },
  student: {
    ar: [
      { text: 'كيف أجد المشتقة؟',                      lessonId: 'kbl-math-2-2' },
      { text: 'ما هي القيم العظمى والصغرى؟',           lessonId: 'kbl-math-2-3' },
      { text: 'اشرح جمع المتجهات',                     lessonId: 'kbl-math-3-2' },
      { text: 'كيف أحل مسائل الاحتمال؟',               lessonId: 'kbl-math-8-1' },
      { text: 'ما هي النسب المثلثية؟',                 lessonId: 'kbl-math-s2-3-1' },
      { text: 'حل نظام معادلتين تربيعيتين',            lessonId: 'kbl-math-s2-1-1' },
    ],
    en: [
      { text: 'How do I find a derivative?',            lessonId: 'kbl-math-2-2' },
      { text: 'What are maximum and minimum values?',   lessonId: 'kbl-math-2-3' },
      { text: 'Explain vector addition',                lessonId: 'kbl-math-3-2' },
      { text: 'How do I solve probability problems?',   lessonId: 'kbl-math-8-1' },
      { text: 'What are trigonometric ratios?',         lessonId: 'kbl-math-s2-3-1' },
      { text: 'Solve a system of two quadratic equations', lessonId: 'kbl-math-s2-1-1' },
    ],
  },
};

// ─── Build iQra response from knowledge-base results ────────────────────────
function buildResponse(query: string, results: KBLesson[], lang: 'ar' | 'en', mode: Mode): string {
  if (results.length === 0) return '';

  const isAr = lang === 'ar';
  const lesson = results[0]; // top result
  const unit = getUnitForLesson(lesson);
  const book = getBookForLesson(lesson);

  const title = isAr ? lesson.titleAr : lesson.titleEn;
  const summary = isAr ? lesson.summaryAr : lesson.summaryEn;
  const concepts = isAr ? lesson.keyConceptsAr : lesson.keyConceptsEn;
  const unitTitle = unit ? (isAr ? unit.titleAr : unit.titleEn) : '';
  const bookTitle = book ? (isAr ? book.titleAr : book.titleEn) : '';

  let lines: string[] = [];

  // Header
  lines.push(`📚 **${title}**`);
  if (unitTitle) lines.push(isAr ? `الوحدة: ${unitTitle}` : `Unit: ${unitTitle}`);
  lines.push('');

  // Summary
  lines.push(summary);
  lines.push('');

  // Key concepts
  if (concepts.length > 0) {
    lines.push(isAr ? '**المفاهيم الأساسية:**' : '**Key Concepts:**');
    concepts.slice(0, 5).forEach(c => lines.push(`• ${c}`));
    lines.push('');
  }

  // Key terms
  if (lesson.keyTerms.length > 0) {
    lines.push(isAr ? '**المصطلحات الأساسية:**' : '**Key Terms:**');
    lesson.keyTerms.slice(0, 3).forEach(term => {
      const termName = isAr ? term.ar : term.en;
      const definition = isAr ? term.definitionAr : term.definitionEn;
      lines.push(`• **${termName}**: ${definition}`);
    });
    lines.push('');
  }

  // Rules (especially for teacher mode or if present)
  const rules = isAr ? lesson.rulesAr : lesson.rulesEn;
  if (rules && rules.length > 0) {
    lines.push(isAr ? '**القواعد والصيغ:**' : '**Rules & Formulas:**');
    rules.forEach(r => lines.push(`• ${r}`));
    lines.push('');
  }

  // Examples
  const examples = isAr ? lesson.examplesAr : lesson.examplesEn;
  if (examples && examples.length > 0) {
    lines.push(isAr ? '**أمثلة:**' : '**Examples:**');
    examples.slice(0, 2).forEach(e => lines.push(`• ${e}`));
    lines.push('');
  }

  // Source citation
  lines.push(isAr ? `📖 المصدر: ${bookTitle}` : `📖 Source: ${bookTitle}`);

  return lines.join('\n');
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({
  message, colors, isRTL, onLongPress,
}: { message: Message; colors: any; isRTL: boolean; onLongPress?: (text: string) => void }) {
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
  return (
    <View style={[styles.rowAssistant, isRTL && styles.rowAssistantRTL]}>
      {/* iQra Avatar */}
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        <Image source={LOGO_MARK} style={{ width: 22, height: 20 }} resizeMode="contain" />
      </View>
      <Pressable
        onLongPress={() => onLongPress?.(message.text)}
        delayLongPress={500}
        style={[styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, maxWidth: '82%' }]}
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
            // Check for inline bold inside bullet
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
        {/* ── Lesson-plan action button ── */}
        {message.lessonTopic && (
          <Pressable
            onPress={() =>
              router.push(
                `/ai-tools/lesson-plan?topic=${encodeURIComponent(message.lessonTopic!)}` as any,
              )
            }
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.primary + '18', borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="document-text-outline" size={13} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
              {isRTL
                ? `إنشاء خطة درس: ${message.lessonTopic}`
                : `Generate Lesson Plan: ${message.lessonTopic}`}
            </Text>
          </Pressable>
        )}
        <Text style={[styles.timestamp, { color: colors.mutedForeground, textAlign: isRTL ? 'left' : 'right' }]}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function IqraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { t, lang, isRTL } = useLanguage();
  const [mode, setMode] = useState<Mode>('teacher');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const listRef = useRef<FlatList>(null);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  // Welcome message on mount
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

  const sendMessage = useCallback(
    async (text: string, pinnedLessonId?: string) => {
      const q = text.trim();
      if (!q || isThinking) return;
      setInput('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: q,
        timestamp: new Date(),
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsThinking(true);

      // 1. Local KB retrieval — grounds the AI answer with textbook content
      let results: KBLesson[];
      if (pinnedLessonId) {
        const pinned = getLessonById(pinnedLessonId);
        results = pinned ? [pinned] : searchKBSemantic(q, lang as 'ar' | 'en');
      } else {
        results = searchKBSemantic(q, lang as 'ar' | 'en');
      }

      // Detect teacher lesson-plan/worksheet/quiz generation intent
      const planKeywords = /خطة|lesson\s*plan|worksheet|ورقة\s*عمل|اختبار\s*(قصير|تكويني)|quiz|generate.*plan/i;
      const hasPlanIntent = planKeywords.test(q) && results.length > 0 && mode === 'teacher';
      const lessonTopic = hasPlanIntent
        ? (lang === 'ar' ? results[0].titleAr : results[0].titleEn)
        : undefined;

      // 2. Build KB context string for the AI
      const kbContext = results.length > 0
        ? buildResponse(q, results, lang as 'ar' | 'en', mode)
        : undefined;

      // 3. Build conversation history (last 10 messages for context window)
      const history = updatedMessages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }));

      let responseText: string;
      try {
        responseText = await remoteAIService.chat({
          messages: history,
          context: kbContext,
          mode,
          language: lang as 'ar' | 'en',
        });
        // Guard against empty AI reply (safety filter, quota, etc.)
        if (!responseText.trim()) {
          responseText = kbContext ?? t('iqraNoResults');
        }
      } catch {
        // Offline / server down — fall back to local KB response
        responseText = kbContext ?? t('iqraNoResults');
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        sources: results,
        lessonTopic,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsThinking(false);

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [isThinking, lang, messages, mode, t],
  );

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
            onLongPress={item.role === 'assistant' ? async (text) => {
              await Clipboard.setStringAsync(text);
              showToast(t('copiedToClipboard'));
            } : undefined}
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

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 12, flexShrink: 1 },

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  thinkingText: { fontSize: 13 },

  inputBar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingVertical: 0 },
  sendBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
