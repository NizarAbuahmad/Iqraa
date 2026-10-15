import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { readableOn } from '@/services/readableColor';
import { isolateForeignRuns } from '@/services/mathRender';
import { buildExplanationCards, type ExplanationCard } from '@/services/lessonExplanationCards';

type Phase = 'loading' | 'ready' | 'soon' | 'error';
type ReportState = 'idle' | 'sending' | 'sent' | 'failed';

// The answer line is «label: value». A value of Latin maths next to Arabic in
// one `Text` reorders visually in RTL («2 mol» jumping to the other side of its
// label), so the value alone sits in a Unicode first-strong isolate and the
// label stays outside it. Do NOT isolate a whole sentence: text inside an
// isolate is ignored when the paragraph direction is chosen, which leaves a
// number and a full stop to pick it. Free text (problems, steps) goes through
// `isolateForeignRuns` instead, which isolates only its Latin/maths runs, and
// the `Text`s that use either force their direction with `writingDirection`.
const FSI = '\u2068';
const PDI = '\u2069';
const isolate = (text: string) => `${FSI}${text}${PDI}`;

/**
 * «شرح الدرس»: the stored, approved explanation, one idea per card.
 *
 * Read-only. The practice problem's hint and answer sit behind a tap so a
 * student tries first. Nothing here can start a generation; the server
 * answers from the pool or says it has nothing.
 *
 * Per-explanation state (revealed hints, report sent) is keyed by the loaded
 * `variantId`, so it can never carry from one explanation to another. Only the
 * latest `load()` may set state, and none may after the screen has unmounted.
 */
export default function LessonExplanationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { lessonId, subjectColor } = useLocalSearchParams<{ lessonId: string; subjectColor?: string }>();
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const lessonTitle = lesson ? (lang === 'ar' ? (lesson.titleAr || lesson.title) : lesson.title) : '';
  const accent = subjectColor ?? colors.primary;
  // `accent` is for text on the page; a fill under white text needs the readable one.
  const accentFill = readableOn(accent, '#FFFFFF');
  const align = { textAlign: isRTL ? 'right' : 'left' } as const;
  const dir = { writingDirection: isRTL ? 'rtl' : 'ltr' } as const;

  const [phase, setPhase] = useState<Phase>('loading');
  const [explanation, setExplanation] = useState<LessonExplanation | null>(null);
  // Keyed by variantId (see the screen's comment): a different explanation
  // starts with nothing revealed and nothing reported.
  const [reports, setReports] = useState<Record<string, ReportState>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({});
  // The latest load() wins: a slow earlier response (before a language change
  // or a retry) must not overwrite a newer one, and nothing lands after unmount.
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latestLoad.current;
    if (!lessonId) { setExplanation(null); setPhase('soon'); return; }
    setPhase('loading');
    try {
      const result = await getLessonExplanation(lessonId, lang === 'ar' ? 'ar' : 'en');
      if (mine !== latestLoad.current) return;
      if (result.status === 'ok') { setExplanation(result.explanation); setPhase('ready'); }
      else { setExplanation(null); setPhase('soon'); }
    } catch {
      if (mine !== latestLoad.current) return;
      setPhase('error');
    }
  }, [lessonId, lang]);

  useEffect(() => {
    void load();
    return () => { latestLoad.current += 1; };
  }, [load]);

  const cards: ExplanationCard[] = explanation ? buildExplanationCards(explanation.content) : [];
  const variantId = explanation?.variantId ?? '';
  const report: ReportState = reports[variantId] ?? 'idle';

  const sendReport = async () => {
    if (!variantId || report === 'sending' || report === 'sent') return;
    const setFor = (state: ReportState) => setReports(r => ({ ...r, [variantId]: state }));
    setFor('sending');
    try {
      await reportLessonExplanation(variantId);
      setFor('sent');
    } catch {
      setFor('failed');
    }
  };

  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }];
  const heading = (text: string) => (
    <Text style={[styles.cardLabel, align, { color: accent, fontFamily: 'ReadexPro_600SemiBold' }]}>{text}</Text>
  );
  const body = [styles.body, align, { color: colors.foreground, fontFamily: 'Almarai_400Regular' }];
  // A disclosure button: it stays after the tap (so a screen reader hears
  // «expanded») and a second tap hides the content again.
  const reveal = (key: string, label: string, content: string) => {
    const id = `${variantId}:${key}`;
    const open = shown[id] === true;
    return (
      <>
        <Pressable
          accessibilityRole="button"
          aria-expanded={open}
          onPress={() => setShown(s => ({ ...s, [id]: !s[id] }))}
          style={[styles.revealBtn, { borderColor: accent, borderRadius: colors.radius }]}
        >
          <Text style={{ color: accent, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>
            {key.endsWith('hint') ? t('lessonExplainShowHint') : t('lessonExplainShowAnswer')}
          </Text>
        </Pressable>
        {open ? (
          <View style={[styles.revealed, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <Text style={[styles.cardLabel, align, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium' }]}>{label}</Text>
            <Text style={body}>{content}</Text>
          </View>
        ) : null}
      </>
    );
  };

  const reportLink = (
    <Pressable
      accessibilityRole="button"
      aria-disabled={report === 'sending' || report === 'sent'}
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
            <Text style={[body, dir, styles.strong]}>{isolateForeignRuns(c.problem)}</Text>
            {c.steps.map((s, j) => <Text key={j} style={[body, dir]}>{`${j + 1}. `}{isolateForeignRuns(s)}</Text>)}
            {c.answer ? <Text style={[body, dir, styles.strong, { color: accent }]}>{`${t('lessonExplainAnswer')}: ${isolate(c.answer)}`}</Text> : null}
          </View>
        );
      case 'practice':
        return (
          <View key={i} style={card}>
            {heading(t('lessonExplainPractice'))}
            <Text style={[body, dir, styles.strong]}>{isolateForeignRuns(c.problem)}</Text>
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
        <View style={styles.center} aria-busy><ActivityIndicator color={accent} /></View>
      ) : phase === 'error' ? (
        <View style={styles.center}>
          <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('lessonExplainError')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.retry, { backgroundColor: accentFill, borderRadius: colors.radius }]}>
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>{t('lessonExplainRetry')}</Text>
          </Pressable>
        </View>
      ) : phase === 'soon' ? (
        <View style={styles.center}>
          <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('lessonExplainEmpty')}</Text>
        </View>
      ) : cards.length === 0 ? (
        // An approved row with nothing usable in it: say so, and still let the
        // student report it so an admin can look.
        <View style={styles.center}>
          <Text style={[styles.notice, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('lessonExplainEmpty')}</Text>
          {reportLink}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 48 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          {cards.map(renderCard)}
          {reportLink}
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
  revealBtn: { borderWidth: 1, paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  reportBtn: { alignSelf: 'center', paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
});
