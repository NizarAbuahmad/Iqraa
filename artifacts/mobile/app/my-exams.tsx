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
  canRetakeExam,
  childSummaryLine,
  formatExamDay,
  myExamAction,
  myExamTitle,
  progressSummary,
  splitMyExams,
  subjectLabel,
  type MyExam,
  type ProgressSummary,
} from '@/services/myExams';
import { formatListDate } from '@/services/evaluationRow';
import { isValidYmd } from '@/services/homework';
import { formatExamTime, groupChildExams } from '@/services/upcomingExams';
import { readableOn } from '@/services/readableColor';
import { ExamStatusChip } from '@/components/ExamStatusChip';
import { formatMarks } from '@/services/studentAnswers';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { StudentResultCard, LEVEL_LABEL_KEY } from '@/components/StudentResultCard';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';

const ACCENT = palette.primary;
const ACCENT_FILL = palette.hero;

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
        ? groupChildExams(await getChildExams()).map(g => ({ key: g.key, name: g.displayName, exams: g.exams }))
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
            <Ionicons name="alert-circle" size={16} color={colors.destructive} />
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
              <Ionicons name="document-text-outline" size={32} color={ACCENT} />
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 17, textAlign: 'center' }}>
              {t('myExamsEmptyTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>
              {t(isParent ? 'childResultsEmptyDesc' : 'myExamsEmptyDesc')}
            </Text>
            {/* An email student has no class until they enter a teacher's code. */}
            {user?.role === 'student' && user.hasRosterLink === false ? (
              <Pressable onPress={() => router.push('/join-class')} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textDecorationLine: 'underline' }}>
                  {t('joinAClass')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {groups !== null && groups.some(g => g.exams.length > 0)
          ? groups.map((group, groupIndex) => (
              <View
                key={group.key}
                style={[
                  { gap: 12 },
                  // Each child is a block of their own: a rule and room above the second one on.
                  group.name && groupIndex > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: SPACE.xl, marginTop: SPACE.sm }
                    : null,
                ]}
              >
                {group.name ? (
                  <ChildHeader
                    name={group.name}
                    summary={group.exams.length > 0 ? childSummaryLine(group.exams, lang) : t('childResultsNone')}
                    colors={colors}
                    isRTL={isRTL}
                  />
                ) : null}
                {!isParent && group.exams.length > 0 ? (
                  <ProgressCard
                    summary={progressSummary(group.exams)}
                    lessonsPassed={progress.enabled ? progress.passedLessonIds.length : null}
                    colors={colors}
                    isRTL={isRTL}
                    lang={lang}
                    t={t}
                  />
                ) : null}
                {group.exams.length > 0
                  ? (() => {
                      const { upcoming, past } = splitMyExams(group.exams);
                      const row = (exam: MyExam) => {
                        const openKey = `${group.key}:${exam.evaluationId}`;
                        return (
                          <ExamRow
                            key={openKey}
                            exam={exam}
                            open={openResult === openKey}
                            onPress={() => onRow(exam, openKey)}
                            canRetake={canRetakeExam(exam, progress.retakeEvaluationIds, isParent)}
                            retaking={retaking === exam.evaluationId}
                            onRetake={() => void onRetake(exam)}
                            parentView={isParent}
                            colors={colors}
                            isRTL={isRTL}
                            lang={lang}
                            t={t}
                          />
                        );
                      };
                      // An empty «القادمة» heading over a «nothing upcoming» line is noise —
                      // and a parent sees one per child. The heading appears only when it
                      // has rows; «nothing upcoming» is one quiet line instead.
                      const quietEmpty = upcoming.length === 0;
                      return (
                        <>
                          {quietEmpty ? null : <SectionTitle text={t('myExamsUpcoming')} colors={colors} align={align} />}
                          {upcoming.length > 0 ? (
                            upcoming.map(row)
                          ) : (
                            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: align }}>
                              {t('myExamsNoUpcoming')}
                            </Text>
                          )}
                          {past.length > 0 ? <SectionTitle text={t('myExamsPast')} colors={colors} align={align} quiet={isParent} /> : null}
                          {past.map(row)}
                        </>
                      );
                    })()
                  : null}
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}

type Colors = ReturnType<typeof useColors>;
type TFn = ReturnType<typeof useLanguage>['t'];

function SectionTitle({ text, colors, align, quiet }: { text: string; colors: Colors; align: 'left' | 'right'; quiet?: boolean }) {
  // `quiet` is the smaller, grey label a parent sees under a child's name, where
  // the child's name is the heading and «السابقة» only sorts what follows it.
  return (
    <Text
      style={{
        color: quiet ? colors.mutedForeground : colors.foreground,
        fontFamily: quiet ? 'ReadexPro_600SemiBold' : 'ReadexPro_700Bold',
        fontSize: quiet ? TYPE.label : TYPE.bodyLg,
        textAlign: align,
        marginTop: 4,
      }}
    >
      {text}
    </Text>
  );
}

/**
 * «نتائج أبنائي»: one child's heading — an initial, the name at heading size and
 * one line of what needs attention — so the rows below read as that child's.
 */
function ChildHeader({ name, summary, colors, isRTL }: { name: string; summary: string; colors: Colors; isRTL: boolean }) {
  const align = isRTL ? 'right' : 'left';
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: SPACE.md }}>
      <View style={[styles.avatar, { backgroundColor: ACCENT + '1F' }]}>
        <Text style={{ color: readableOn(ACCENT, colors.background), fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg }}>{initial}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>{name}</Text>
        {summary ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}>
            {summary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * «تقدّمي»: tests taken, average and, with the mastery gate on, lessons passed,
 * then the average per subject. Built from released results only (see
 * `progressSummary`), so it can never show a mark the teacher is holding back.
 */
function ProgressCard({
  summary, lessonsPassed, colors, isRTL, lang, t,
}: {
  summary: ProgressSummary;
  lessonsPassed: number | null;
  colors: Colors;
  isRTL: boolean;
  lang: 'ar' | 'en';
  t: TFn;
}) {
  const align = isRTL ? 'right' : 'left';
  const stat = (value: string, label: string) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title }}>{value}</Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: 'center' }}>{label}</Text>
    </View>
  );
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, gap: 12 }]}>
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, textAlign: align }}>
        {t('myExamsProgressTitle')}
      </Text>
      {summary.averagePercent === null ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, textAlign: align }}>
          {t('myExamsProgressEmpty')}
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {stat(String(summary.taken), t('myExamsTestsTaken'))}
            {stat(`${summary.averagePercent}%`, t('myExamsAvgScore'))}
            {lessonsPassed !== null ? stat(String(lessonsPassed), t('myExamsLessonsPassed')) : null}
          </View>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textAlign: align }}>
            {t('myExamsBySubject')}
          </Text>
          {summary.bySubject.map(s => (
            <View key={s.subjectId} style={{ gap: 4 }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14 }}>
                  {subjectLabel(s.subjectId, lang) ?? s.subjectId}
                </Text>
                <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{s.percent}%</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <View style={{ width: `${Math.max(0, Math.min(100, s.percent))}%`, backgroundColor: s.percent >= 80 ? palette.success : ACCENT }} />
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function ExamRow({
  exam, open, onPress, canRetake, retaking, onRetake, parentView, colors, isRTL, lang, t,
}: {
  exam: MyExam;
  open: boolean;
  onPress: () => void;
  /** A failed lesson quiz the student may sit again (mastery gate). */
  canRetake: boolean;
  retaking: boolean;
  onRetake: () => void;
  /** «نتائج أبنائي»: the same row, laid out for a parent (no link, plain-language status). */
  parentView: boolean;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  lang: 'ar' | 'en';
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const action = myExamAction(exam);
  const subject = subjectLabel(exam.subjectId, lang);
  // The planned day, when the teacher set one. A paper exam's "sent" and
  // "handed in" times are when the teacher published it and typed the mark —
  // not what a family means by either — so a paper row shows only its day.
  const dayText = exam.examDate && isValidYmd(exam.examDate) ? formatExamDay(exam.examDate, lang) : null;
  const time = formatExamTime(exam.examTime);

  const levelKey = exam.result?.levelKey ? LEVEL_LABEL_KEY[exam.result.levelKey] : undefined;

  // The card, for a student and a parent alike: the title and its status first,
  // then a few labelled facts (one icon each, nothing joined with dots), then —
  // for a student, when the exam can be sat — the button. Only the wording of the
  // status differs by role. The planned day is left off once the paper is handed
  // in: it would sit beside «سُلِّم» looking like a date in the future for
  // something already done.
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const title = myExamTitle(exam, lang) || t('myExamsUntitled', subject ?? '');
  // «اختبار الكيمياء» already says «الكيمياء».
  const showSubject = Boolean(subject) && !title.includes(subject!);
  const handedIn = !exam.paper && exam.submittedAt ? formatListDate(exam.submittedAt, lang) : null;
  const sentOn = !exam.paper && !handedIn && !dayText ? formatListDate(exam.publishedAt, lang) : null;
  const facts: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  if (dayText && !handedIn) facts.push({ icon: 'calendar-outline', text: t('childResultsExamDay', time ? `${dayText} ${time}` : dayText) });
  if (handedIn) facts.push({ icon: 'checkmark-done-outline', text: t('myExamsHandedInOn', handedIn) });
  if (sentOn) facts.push({ icon: 'paper-plane-outline', text: t('myExamsSentOn', sentOn) });
  if (exam.timeLimitMin && !exam.paper) facts.push({ icon: 'time-outline', text: t('myExamsTimeLimit', exam.timeLimitMin) });
  if (exam.totalMarks) facts.push({ icon: 'ribbon-outline', text: t('childResultsOutOf', t('myExamsMarks', formatMarks(exam.totalMarks))) });
  const top = (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: rowDir, alignItems: 'flex-start', gap: SPACE.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          {showSubject ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textAlign: align }}>
              {subject}
            </Text>
          ) : null}
          <Text numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, lineHeight: 26, textAlign: align }}>
            {title}
          </Text>
        </View>
        {action === 'toggle_result' ? (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={ICON.xl} color={colors.mutedForeground} />
        ) : null}
      </View>
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: SPACE.md, flexWrap: 'wrap' }}>
        <ExamStatusChip state={exam.state} parent={parentView} />
        {exam.result ? (
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg }}>
            {exam.result.percent}%{levelKey ? ` · ${t(levelKey)}` : ''}
          </Text>
        ) : null}
      </View>
      {facts.length > 0 ? (
        <View style={{ gap: SPACE.xs, marginTop: SPACE.xxs }}>
          {facts.map(f => (
            <View key={f.icon} style={{ flexDirection: rowDir, alignItems: 'center', gap: SPACE.sm }}>
              <Ionicons name={f.icon} size={ICON.md} color={colors.mutedForeground} />
              <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 21, textAlign: align }}>
                {f.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {/* The one thing a student can do here. Drawn as a button but not a Pressable: the whole card is the button, and one inside it is invalid on the web build. */}
      {action === 'start' || action === 'continue' ? (
        <View style={{ flexDirection: rowDir, marginTop: SPACE.xs }}>
          <View style={[styles.cta, styles.ctaWide, { backgroundColor: ACCENT_FILL }]}>
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label }}>
              {t(action === 'start' ? 'myExamsStart' : 'myExamsContinue')}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

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
      {top}

      {open && exam.result ? (
        <View style={{ marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: 14 }}>
          <StudentResultCard result={exam.result} colors={colors} isRTL={isRTL} t={t} showTitle={false} />
        </View>
      ) : null}
    </Pressable>
    {exam.review ? (
      <Pressable
        onPress={() => router.push({ pathname: '/exam-review/[id]', params: { id: exam.evaluationId } } as never)}
        accessibilityRole="button"
        style={[
          styles.retakeBar,
          { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.card, borderColor: ACCENT + '55', borderRadius: colors.radius },
        ]}
      >
        <Ionicons name="school-outline" size={ICON.lg} color={ACCENT} />
        <Text style={{ flex: 1, color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
          {t('reviewOpenBtn')}
        </Text>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={ACCENT} />
      </Pressable>
    ) : null}
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
  retakeBar: { alignItems: 'center', gap: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  cta: { alignSelf: 'center', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  // The start / continue button spans the card, at the 44-point touch height.
  ctaWide: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  avatar: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
});
