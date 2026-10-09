/**
 * «اختباراتي» — a signed-in student's exams and released results.
 *
 * Before this screen the share link the teacher posted was the only door into
 * an exam, and a result was visible only on the hand-in screen of that one
 * sitting. A student who closed the tab had no way back to either.
 *
 * What a row says and allows is decided on the server
 * (`modules/assessment/studentExams.ts`): a link only while the exam admits
 * the student, a result only once the teacher released it and nothing on the
 * paper is left unmarked. This screen renders those decisions; it never
 * builds a link of its own. Opening an exam goes through `/take/:code`, which
 * recognises a signed-in student and skips the name picker — or resumes the
 * sitting they already hold.
 *
 * A parent reaches the same screen as «نتائج أبنائي»: one section per child,
 * from `GET /parent/exams`, under the student's release rule and with no
 * link on any row — the exam is the child's to sit.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getChildExams, getMyExams, retakeExam } from '@/services/studentExam';
import { confirm } from '@/services/confirm';
import { useMasteryProgress } from '@/hooks/useMasteryProgress';
import {
  MY_EXAM_STATE_KEY,
  myExamAction,
  myExamTitle,
  subjectLabel,
  type MyExam,
  type MyExamState,
} from '@/services/myExams';
import { formatListDate } from '@/services/evaluationRow';
import { formatMarks } from '@/services/studentAnswers';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { StudentResultCard, LEVEL_LABEL_KEY } from '@/components/StudentResultCard';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { BackButton } from '@/components/ui/BackButton';

const ACCENT = palette.primary;
const ACCENT_FILL = palette.hero;

const STATE_COLOR: Record<MyExamState, string> = {
  available: ACCENT,
  in_progress: palette.warning,
  submitted: '#475467',
  result: palette.success,
  closed: '#667085',
};

const STATE_ICON: Record<MyExamState, keyof typeof Ionicons.glyphMap> = {
  available: 'sparkles-outline',
  in_progress: 'time-outline',
  submitted: 'hourglass-outline',
  result: 'ribbon-outline',
  closed: 'lock-closed-outline',
};

/** A child's section for a parent; the student's own list is one unnamed group. */
interface ExamGroup {
  key: string;
  name: string | null;
  exams: MyExam[];
}

export default function MyExamsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [groups, setGroups] = useState<ExamGroup[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [openResult, setOpenResult] = useState<string | null>(null);
  const progress = useMasteryProgress();
  const [retaking, setRetaking] = useState<string | null>(null);

  // Which list to read depends on the role, so nothing loads until the
  // session has: a reload used to ask /student/exams for a parent, and its
  // 403 landed after the right list and put an error banner over it. A
  // newer load also wins over an older one still in flight.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!user) return;
    const seq = ++loadSeq.current;
    setError('');
    try {
      const next = isParent
        ? (await getChildExams()).map(c => ({ key: c.studentId, name: c.displayName, exams: c.exams }))
        : [{ key: 'self', name: null, exams: await getMyExams() }];
      if (seq === loadSeq.current) setGroups(next);
    } catch (e) {
      if (seq === loadSeq.current) setError(apiErrorMessage(e, isParent ? 'childResultsLoadFailed' : 'myExamsLoadFailed', t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParent, user?.id]);

  // On every focus, not once: a student comes back here from handing a paper
  // in, and the row they just finished must not still say «تابع».
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Keyed by group as well: two siblings in one class share an exam id.
  const onRow = (exam: MyExam, openKey: string) => {
    const action = myExamAction(exam);
    if (!action) return;
    Haptics.selectionAsync();
    if (action === 'toggle_result') {
      setOpenResult(prev => (prev === openKey ? null : openKey));
      return;
    }
    if (exam.shareCode) router.push(`/take/${exam.shareCode}` as never);
  };

  const onRetake = async (exam: MyExam) => {
    const go = await confirm({
      title: t('masteryRetakeConfirmTitle'),
      message: t('masteryRetakeConfirmBody'),
      confirmLabel: t('masteryRetake'),
      cancelLabel: t('masteryClose'),
    });
    if (!go) return;
    setRetaking(exam.evaluationId);
    setError('');
    try {
      const { shareCode } = await retakeExam(exam.evaluationId);
      // The old sitting is gone, so opening the link starts a fresh one.
      if (shareCode) router.push(`/take/${shareCode}` as never);
      else await load();
    } catch (e) {
      setError(apiErrorMessage(e, 'masteryRetakeFailed', t));
      await load();
    } finally {
      setRetaking(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t(isParent ? 'childResultsTitle' : 'myExamsTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(isParent ? 'childResultsDesc' : 'myExamsDesc')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 40,
          gap: 12,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
            <Pressable onPress={() => void load()} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textDecorationLine: 'underline' }}>
                {t('retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {groups === null && !error ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : null}

        {groups !== null && groups.every(g => g.exams.length === 0) ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: ACCENT + '1F' }]}>
              <Ionicons name="document-text-outline" size={30} color={ACCENT} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 17, textAlign: 'center' }}>
              {t('myExamsEmptyTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              {t(isParent ? 'childResultsEmptyDesc' : 'myExamsEmptyDesc')}
            </Text>
          </View>
        ) : null}

        {groups !== null && groups.some(g => g.exams.length > 0)
          ? groups.map(group => (
              <View key={group.key} style={{ gap: 12 }}>
                {group.name ? (
                  <Text style={[styles.childName, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
                    {group.name}
                  </Text>
                ) : null}
                {group.name && group.exams.length === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: align }}>
                    {t('childResultsNone')}
                  </Text>
                ) : null}
                {group.exams.map(exam => {
                  const openKey = `${group.key}:${exam.evaluationId}`;
                  return (
                    <ExamRow
                      key={openKey}
                      exam={exam}
                      open={openResult === openKey}
                      onPress={() => onRow(exam, openKey)}
                      canRetake={!isParent && progress.retakeEvaluationIds.includes(exam.evaluationId)}
                      retaking={retaking === exam.evaluationId}
                      onRetake={() => void onRetake(exam)}
                      colors={colors}
                      isRTL={isRTL}
                      lang={lang}
                      t={t}
                    />
                  );
                })}
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}

function ExamRow({
  exam, open, onPress, canRetake, retaking, onRetake, colors, isRTL, lang, t,
}: {
  exam: MyExam;
  open: boolean;
  onPress: () => void;
  /** A failed lesson quiz the student may sit again (mastery gate). */
  canRetake: boolean;
  retaking: boolean;
  onRetake: () => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  lang: 'ar' | 'en';
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const action = myExamAction(exam);
  const stateColor = STATE_COLOR[exam.state];
  const subject = subjectLabel(exam.subjectId, lang);
  const when =
    exam.submittedAt
      ? formatListDate(exam.submittedAt, lang)
      : formatListDate(exam.publishedAt, lang);
  const whenLine = when ? t(exam.submittedAt ? 'myExamsHandedInOn' : 'myExamsSentOn', when) : null;
  const meta = [
    subject,
    whenLine,
    exam.timeLimitMin ? t('myExamsTimeLimit', exam.timeLimitMin) : null,
    exam.totalMarks ? t('myExamsMarks', formatMarks(exam.totalMarks)) : null,
  ].filter(Boolean).join(' · ');

  const levelKey = exam.result?.levelKey ? LEVEL_LABEL_KEY[exam.result.levelKey] : undefined;

  // The retake bar sits beside the card, not inside it: the card is a button,
  // and a button inside a button is invalid on the web build.
  return (
    <View style={{ gap: 8 }}>
    <Pressable
      onPress={onPress}
      disabled={!action}
      accessibilityRole={action ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.rowTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.stateIcon, { backgroundColor: stateColor + '1F' }]}>
          <Ionicons name={STATE_ICON[exam.state]} size={20} color={stateColor} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, lineHeight: 23, textAlign: align }}>
            {myExamTitle(exam, lang) || t('myExamsUntitled', subject ?? '')}
          </Text>
          {meta ? (
            <Text numberOfLines={2} style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
              {meta}
            </Text>
          ) : null}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
            <View style={[styles.chip, { backgroundColor: stateColor + '1A' }]}>
              <Text style={{ color: stateColor, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>
                {t(MY_EXAM_STATE_KEY[exam.state])}
              </Text>
            </View>
            {exam.result ? (
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                {levelKey ? `${t(levelKey)} · ` : ''}{exam.result.percent}%
              </Text>
            ) : null}
          </View>
        </View>

        {action === 'start' || action === 'continue' ? (
          <View style={[styles.cta, { backgroundColor: ACCENT_FILL }]}>
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
              {t(action === 'start' ? 'myExamsStart' : 'myExamsContinue')}
            </Text>
          </View>
        ) : action === 'toggle_result' ? (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
        ) : null}
      </View>

      {open && exam.result ? (
        <View style={{ marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: 14 }}>
          <StudentResultCard result={exam.result} colors={colors} isRTL={isRTL} t={t} showTitle={false} />
        </View>
      ) : null}
    </Pressable>
    {canRetake ? (
      <View
        style={[
          styles.retakeBar,
          { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        ]}
      >
        <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
          {t('masteryNotPassed')}
        </Text>
        <Pressable
          onPress={onRetake}
          disabled={retaking}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: ACCENT_FILL, opacity: retaking ? 0.6 : 1 }]}
        >
          {retaking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{t('masteryRetake')}</Text>
          )}
        </Pressable>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  title: { fontSize: 22 },
  desc: { fontSize: 15, lineHeight: 24, marginTop: 4 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 48 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  card: { borderWidth: 1, padding: 14 },
  rowTop: { alignItems: 'flex-start', gap: 12 },
  stateIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  retakeBar: { alignItems: 'center', gap: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  cta: { alignSelf: 'center', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  childName: { fontSize: 17, marginTop: 4 },
});
