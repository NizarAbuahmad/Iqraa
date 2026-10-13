import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { BackButton } from '@/components/ui/BackButton';
import { getLessonById } from '@/services/curriculumData';
import {
  getLessonExplanation,
  reportLessonExplanation,
  type LessonExplanation,
} from '@/services/lessonExplanation';
import { buildExplanationCards, type ExplanationCard } from '@/services/lessonExplanationCards';

type Phase = 'loading' | 'ready' | 'soon' | 'error';
type ReportState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * «شرح الدرس»: the stored, approved explanation, one idea per card.
 *
 * Read-only. The practice problem's hint and answer sit behind a tap so a
 * student tries first. Nothing here can start a generation; the server
 * answers from the pool or says it has nothing.
 */
export default function LessonExplanationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { lessonId, subjectColor } = useLocalSearchParams<{ lessonId: string; subjectColor?: string }>();
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const lessonTitle = lesson ? (lang === 'ar' ? (lesson.titleAr || lesson.title) : lesson.title) : '';
  const accent = subjectColor ?? colors.primary;
  const align = { textAlign: isRTL ? 'right' : 'left' } as const;

  const [phase, setPhase] = useState<Phase>('loading');
  const [explanation, setExplanation] = useState<LessonExplanation | null>(null);
  const [report, setReport] = useState<ReportState>('idle');
  const [shown, setShown] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!lessonId) { setPhase('soon'); return; }
    setPhase('loading');
    try {
      const result = await getLessonExplanation(lessonId, lang === 'ar' ? 'ar' : 'en');
      if (result.status === 'ok') { setExplanation(result.explanation); setPhase('ready'); }
      else setPhase('soon');
    } catch {
      setPhase('error');
    }
  }, [lessonId, lang]);

  useEffect(() => { void load(); }, [load]);

  const cards: ExplanationCard[] = explanation ? buildExplanationCards(explanation.content) : [];

  const sendReport = async () => {
    if (!explanation || report === 'sending' || report === 'sent') return;
    setReport('sending');
    try {
      await reportLessonExplanation(explanation.variantId);
      setReport('sent');
    } catch {
      setReport('failed');
    }
  };

  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }];
  const heading = (text: string) => (
    <Text style={[styles.cardLabel, align, { color: accent, fontFamily: 'ReadexPro_600SemiBold' }]}>{text}</Text>
  );
  const body = [styles.body, align, { color: colors.foreground, fontFamily: 'Almarai_400Regular' }];
  const reveal = (key: string, label: string, content: string) =>
    shown[key] ? (
      <View style={[styles.revealed, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
        <Text style={[styles.cardLabel, align, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium' }]}>{label}</Text>
        <Text style={body}>{content}</Text>
      </View>
    ) : (
      <Pressable
        accessibilityRole="button"
        onPress={() => setShown(s => ({ ...s, [key]: true }))}
        style={[styles.revealBtn, { borderColor: accent, borderRadius: colors.radius }]}
      >
        <Text style={{ color: accent, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>
          {key.endsWith('hint') ? t('lessonExplainShowHint') : t('lessonExplainShowAnswer')}
        </Text>
      </Pressable>
    );

  const renderCard = (c: ExplanationCard, i: number) => {
    switch (c.kind) {
      case 'hook':
        return (
          <View key={i} style={card}>
            {heading(t('lessonExplainThink'))}
            <Text style={[body, styles.hook]}>{c.text}</Text>
          </View>
        );
      case 'concept':
        return (
          <View key={i} style={card}>
            <Text style={[styles.cardTitle, align, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>{c.title}</Text>
            {c.points.map((p, j) => <Text key={j} style={body}>{p}</Text>)}
            {c.misconception ? (
              <View style={[styles.revealed, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                <Text style={[styles.cardLabel, align, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium' }]}>{t('lessonExplainCommonMistake')}</Text>
                <Text style={body}>{c.misconception}</Text>
              </View>
            ) : null}
          </View>
        );
      case 'example':
        return (
          <View key={i} style={card}>
            {heading(t('lessonExplainExample'))}
            <Text style={[body, styles.strong]}>{c.problem}</Text>
            {c.steps.map((s, j) => <Text key={j} style={body}>{`${j + 1}. ${s}`}</Text>)}
            {c.answer ? <Text style={[body, styles.strong, { color: accent }]}>{`${t('lessonExplainAnswer')}: ${c.answer}`}</Text> : null}
          </View>
        );
      case 'practice':
        return (
          <View key={i} style={card}>
            {heading(t('lessonExplainPractice'))}
            <Text style={[body, styles.strong]}>{c.problem}</Text>
            {c.hint ? reveal(`${i}:hint`, t('lessonExplainHint'), c.hint) : null}
            {c.answer ? reveal(`${i}:answer`, t('lessonExplainAnswer'), c.answer) : null}
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.card, paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={[styles.title, align, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>{t('lessonExplainTitle')}</Text>
        {lessonTitle ? <Text style={[styles.subtitle, align, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{lessonTitle}</Text> : null}
      </View>

      {phase === 'loading' ? (
        <View style={styles.center}><ActivityIndicator color={accent} /></View>
      ) : phase === 'error' ? (
        <View style={styles.center}>
          <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('lessonExplainError')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.retry, { backgroundColor: accent, borderRadius: colors.radius }]}>
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>{t('lessonExplainRetry')}</Text>
          </Pressable>
        </View>
      ) : phase === 'soon' || cards.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('lessonExplainEmpty')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {cards.map(renderCard)}
          <Pressable
            accessibilityRole="button"
            disabled={report === 'sending' || report === 'sent'}
            onPress={() => void sendReport()}
            hitSlop={8}
            style={styles.reportBtn}
          >
            <Text
              style={[
                align,
                {
                  color: report === 'failed' ? colors.destructive : colors.mutedForeground,
                  fontFamily: 'Almarai_400Regular',
                  fontSize: 13,
                  textDecorationLine: report === 'sent' ? 'none' : 'underline',
                },
              ]}
            >
              {report === 'sent'
                ? t('lessonExplainReported')
                : report === 'failed'
                  ? t('lessonExplainReportFailed')
                  : t('lessonExplainReport')}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4, marginBottom: 4 },
  title: { fontSize: 24, marginBottom: 2 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  notice: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  retry: { paddingHorizontal: 24, paddingVertical: 12 },
  scroll: { padding: 20, paddingBottom: 48, gap: 16 },
  card: { borderWidth: 1, padding: 16, gap: 8 },
  cardLabel: { fontSize: 13 },
  cardTitle: { fontSize: 17, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 25 },
  hook: { fontSize: 17, lineHeight: 28 },
  strong: { fontFamily: 'ReadexPro_500Medium' },
  revealed: { padding: 12, gap: 4 },
  revealBtn: { borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  reportBtn: { alignSelf: 'center', paddingVertical: 12 },
});
