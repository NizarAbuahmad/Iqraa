import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  KBLesson,
  getBookForLesson,
  getUnitForLesson,
  searchKB,
} from '@/services/knowledgeBase';

// ─── Types ──────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant';
type Mode = 'teacher' | 'student';

interface Message {
  id: string;
  role: Role;
  text: string;
  sources?: KBLesson[];
  timestamp: Date;
}

// ─── Suggested questions per mode/language ───────────────────────────────────
const SUGGESTIONS: Record<Mode, Record<'ar' | 'en', string[]>> = {
  teacher: {
    ar: [
      'ما هي نظرية بور؟',
      'اشرح الرابطة التساهمية',
      'ما هو الاقتران العكسي؟',
      'قاعدة الاحتمال للحوادث المتنافية',
      'الأعداد الكمية وأنواعها',
    ],
    en: [
      "What is Bohr's model?",
      'Explain covalent bonding',
      'What is an inverse function?',
      'Probability of mutually exclusive events',
      'Quantum numbers explained',
    ],
  },
  student: {
    ar: [
      'ساعدني في فهم نظرية بور',
      'كيف أحل مسائل الاحتمال؟',
      'ما الفرق بين رابطة سيجما وباي؟',
      'كيف أجد مجال الاقتران النسبي؟',
      'اشرح مبدأ أوفباو بطريقة بسيطة',
    ],
    en: [
      "Help me understand Bohr's model",
      'How do I solve probability problems?',
      'Difference between sigma and pi bonds?',
      'How to find the domain of a rational function?',
      'Explain Aufbau principle simply',
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
function MessageBubble({ message, colors, isRTL }: { message: Message; colors: any; isRTL: boolean }) {
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
        <Text style={{ fontSize: 16 }}>📚</Text>
      </View>
      <View style={[styles.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, maxWidth: '82%' }]}>
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
        <Text style={[styles.timestamp, { color: colors.mutedForeground, textAlign: isRTL ? 'left' : 'right' }]}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function IqraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const [mode, setMode] = useState<Mode>('teacher');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const listRef = useRef<FlatList>(null);

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
    async (text: string) => {
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
      setMessages(prev => [...prev, userMsg]);
      setIsThinking(true);

      // Simulate search + processing delay
      await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

      const results = searchKB(q, lang as 'ar' | 'en');
      const responseText =
        results.length > 0
          ? buildResponse(q, results, lang as 'ar' | 'en', mode)
          : t('iqraNoResults');

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        sources: results,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsThinking(false);

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [isThinking, lang, mode, t],
  );

  const suggestions = SUGGESTIONS[mode][lang as 'ar' | 'en'];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
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
              <Text style={{ fontSize: 18 }}>📚</Text>
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('iqraChatTitle')}
              </Text>
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
              onPress={() => sendMessage(s)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: colors.secondary, borderRadius: 20, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
                {s}
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
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <MessageBubble message={item} colors={colors} isRTL={isRTL} />
        )}
        ListFooterComponent={
          isThinking ? (
            <View style={[styles.thinkingRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                <Text style={{ fontSize: 16 }}>📚</Text>
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
            paddingBottom: insets.bottom + 8,
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
            writingDirection={isRTL ? 'rtl' : 'ltr'}
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
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: { borderBottomWidth: 1, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iqraIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20 },
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

  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  thinkingText: { fontSize: 13 },

  inputBar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingVertical: 0 },
  sendBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
