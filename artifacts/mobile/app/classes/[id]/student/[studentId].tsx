import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getStudentRecord, RosterError, updateStudent } from '@/services/roster';
import { classQueryKey } from '@/services/rosterQueryKeys';
import { trackEvent } from '@/services/analytics';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';
import {
  examStatusKey, focusObjectives, formatDay, lessonAction, paperAction, recheckAction,
  sittingsLine, worksheetAction, type StudentRecordObjective,
} from '@/services/studentRecord';

const ACCENT = palette.primary;
const ACCENT_FILL = palette.hero;

type Target = { pathname: string; params: Record<string, string> } | null;
type ActionKind = 'worksheet' | 'recheck' | 'lesson' | 'parent' | 'paper';

const isNotFound = (err: unknown) => err instanceof RosterError && err.status === 404;

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.pill, { borderColor: ACCENT }]}>
      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function ObjectiveCard({
  o, classId, go,
}: {
  o: StudentRecordObjective;
  classId: string;
  go: (kind: ActionKind, target: Target) => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const ws = worksheetAction(o);
  const lesson = lessonAction(o);
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: align }]}>{o.titleAr}</Text>
      {o.lessonTitleAr ? <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{o.lessonTitleAr}</Text> : null}
      <View style={[styles.barTrack, { backgroundColor: colors.muted }]} aria-label={`${Math.round(o.percent)}%`}>
        <View style={[styles.barFill, { width: `${Math.max(2, Math.min(100, o.percent))}%`, backgroundColor: o.percent < 60 ? colors.destructive : ACCENT, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
      </View>
      <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
        {Math.round(o.percent)}% · {sittingsLine(o, lang)}
      </Text>
      <View style={[styles.actions, { flexDirection: row }]}>
        {ws ? <Pill label={t('studentRecordWorksheet')} onPress={() => go('worksheet', ws)} /> : null}
        <Pill label={t('studentRecordRecheck')} onPress={() => go('recheck', recheckAction(classId, o))} />
        {lesson ? <Pill label={t('studentRecordOpenLesson')} onPress={() => go('lesson', lesson)} /> : null}
      </View>
    </View>
  );
}

export default function StudentRecordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const { id, studentId } = useLocalSearchParams<{ id: string; studentId: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['studentRecord', id, studentId],
    queryFn: () => getStudentRecord(id, studentId),
    // A 404 means the student is not in this class; asking again will not change that.
    retry: (count, err) => !isNotFound(err) && count < 2,
  });

  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteFailed, setNoteFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // The draft follows the server only while the teacher has not edited it: a
  // refetch landing mid-typing must not overwrite what they are writing.
  const serverNote = data?.student.teacherNote;
  const syncedNote = useRef<string | null>(null);
  useEffect(() => {
    if (serverNote === undefined) return;
    setNote(current => (syncedNote.current === null || current === syncedNote.current ? serverNote : current));
    syncedNote.current = serverNote;
  }, [serverNote]);
  // Coming back from marking a paper or the quick check: the percentages moved.
  // The first focus is the mount, which useQuery already fetches.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refetch();
      focusedOnce.current = true;
    }, [refetch]),
  );
  useEffect(() => { trackEvent('student_record_opened', { classId: id }); }, [id]);

  const go = (kind: ActionKind, target: Target) => {
    if (!target) return;
    trackEvent('student_record_action', { kind });
    router.push(target as never);
  };

  const saveNote = async () => {
    if (!data || savingNote) return;
    setSavingNote(true);
    setNoteFailed(false);
    try {
      const saved = await updateStudent(data.student.id, { teacherNote: note });
      // The server trims; keep the draft equal to what it stored so the button settles.
      const stored = typeof saved?.teacherNote === 'string' ? saved.teacherNote : note.trim();
      setNote(current => (current === note ? stored : current));
      void queryClient.invalidateQueries({ queryKey: classQueryKey(id) });
      void refetch();
    } catch {
      setNoteFailed(true);
    } finally {
      setSavingNote(false);
    }
  };

  const sectionStyle: TextStyle[] = [styles.section, { color: colors.foreground, textAlign: align }];

  const focus = data ? focusObjectives(data.objectives) : null;
  const noteUnchanged = data ? note === data.student.teacherNote : true;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={[styles.header, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => goBack()} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { textAlign: align }]}>{data?.student.displayName ?? t('studentRecordTitle')}</Text>
        {data ? (
          <Text style={[styles.headerSub, { textAlign: align }]}>
            {data.className}{data.parent.linked ? ` · ${t('studentRecordParentLinked')}` : ''}
          </Text>
        ) : null}
      </View>

      {isLoading ? <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} /> : null}
      {error && !data ? (
        <View style={{ padding: 20, gap: 10 }}>
          <Text style={[styles.empty, { color: colors.destructive, textAlign: align }]}>
            {isNotFound(error) ? t('studentRecordNotFound') : t('studentRecordLoadFailed')}
          </Text>
          {isNotFound(error) ? null : (
            <View style={[styles.actions, { flexDirection: row }]}>
              <Pill label={t('studentRecordRetry')} onPress={() => { void refetch(); }} />
            </View>
          )}
        </View>
      ) : null}

      {data && focus ? (
        <View style={{ padding: 20, gap: 20 }}>
          <View style={[styles.actions, { flexDirection: row }]}>
            <Pill
              label={t('studentRecordParent')}
              onPress={() => go('parent', { pathname: '/ai-tools/parent-message', params: { studentId: data.student.id, studentName: data.student.displayName } })}
            />
          </View>

          {data.objectives.length === 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={[styles.empty, { color: colors.mutedForeground, textAlign: align }]}>{t('studentRecordEmpty')}</Text>
              <View style={[styles.actions, { flexDirection: row }]}>
                <Pill label={t('studentRecordQuickCheck')} onPress={() => go('recheck', { pathname: '/evaluations/mini', params: { classId: id } })} />
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={sectionStyle}>{t('studentRecordNeedsSupport')}</Text>
              {focus.allClear ? <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{t('studentRecordAllClear')}</Text> : null}
              {focus.shown.map(o => <ObjectiveCard key={o.objectiveId} o={o} classId={id} go={go} />)}
              {data.provisionalCount > 0 ? <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{t('studentRecordProvisionalNote')}</Text> : null}

              <Pressable onPress={() => setShowAll(v => !v)} accessibilityRole="button" aria-expanded={showAll} style={[styles.toggle, { flexDirection: row }]}>
                <Text style={sectionStyle}>{t('studentRecordAllObjectives')} ({data.objectives.length})</Text>
                <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
              </Pressable>
              {showAll ? data.objectives.map(o => (
                <View key={o.objectiveId} style={[styles.listRow, { flexDirection: row, borderColor: colors.border }]}>
                  <Text style={{ flex: 1, color: colors.foreground, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{o.titleAr}</Text>
                  <Text style={{ color: o.percent < 60 ? colors.destructive : colors.foreground, fontFamily: 'ReadexPro_500Medium' }}>{Math.round(o.percent)}%</Text>
                </View>
              )) : null}
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Text style={sectionStyle}>{t('studentRecordExams')}</Text>
            {data.exams.map(e => {
              const paper = paperAction(e, data.student.id);
              const body = (
                <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={{ flexDirection: row, justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: align, flex: 1 }]}>{e.title}</Text>
                    <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>
                      {e.percent !== null ? `${Math.round(e.percent)}%` : '—'}
                    </Text>
                  </View>
                  <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
                    {formatDay(e.createdAt)} · {t(examStatusKey(e.status))}{e.provisional ? ` · ${t('studentRecordProvisional')}` : ''}
                  </Text>
                  {e.teacherComment ? <Text style={[styles.comment, { color: colors.foreground, textAlign: align, borderColor: colors.border }]}>{e.teacherComment}</Text> : null}
                </View>
              );
              return paper ? (
                <Pressable key={e.evaluationId} onPress={() => go('paper', paper)} accessibilityRole="button">{body}</Pressable>
              ) : (
                <View key={e.evaluationId}>{body}</View>
              );
            })}
          </View>

          <View style={{ gap: 8 }}>
            <Text style={sectionStyle}>{t('studentRecordNote')}</Text>
            <TextInput
              value={note}
              onChangeText={v => { setNote(v); setNoteFailed(false); }}
              multiline
              aria-label={t('studentRecordNote')}
              style={[styles.note, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, textAlign: align }]}
            />
            <Pressable
              onPress={saveNote}
              disabled={savingNote || noteUnchanged}
              aria-disabled={savingNote || noteUnchanged}
              aria-busy={savingNote}
              accessibilityRole="button"
              style={[styles.save, { backgroundColor: ACCENT_FILL, opacity: savingNote || noteUnchanged ? 0.5 : 1, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
            >
              <Text style={{ color: '#fff', fontFamily: 'ReadexPro_500Medium' }}>{t('studentRecordSaveNote')}</Text>
            </Pressable>
            {noteFailed ? (
              <Text style={[styles.meta, { color: colors.destructive, textAlign: align }]}>{t('studentRecordNoteFailed')}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 18, gap: 6 },
  headerTitle: { color: '#fff', fontSize: 22, fontFamily: 'ReadexPro_700Bold' },
  headerSub: { color: '#fff', opacity: 0.9, fontSize: 14, fontFamily: 'Almarai_400Regular' },
  section: { fontSize: 16, fontFamily: 'ReadexPro_600SemiBold' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  cardTitle: { fontSize: 15, fontFamily: 'ReadexPro_500Medium' },
  meta: { fontSize: 13, fontFamily: 'Almarai_400Regular' },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  actions: { flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  toggle: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  listRow: { alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  comment: { fontSize: 13, fontFamily: 'Almarai_400Regular', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  note: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 90, fontFamily: 'Almarai_400Regular', fontSize: 14 },
  save: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  empty: { fontSize: 14, fontFamily: 'Almarai_400Regular', marginTop: 8 },
});
