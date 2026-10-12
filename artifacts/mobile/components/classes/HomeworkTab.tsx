/**
 * «الواجبات» — the teacher's homework list for one class, and the modal that
 * creates, edits and deletes it. Owns its own state and loads itself; the
 * class screen only mounts it. The family side is `app/(tabs)/school.tsx`.
 *
 * Three rulings worth knowing before editing:
 * - `createHomework` / `updateHomework` resolve `null` when the write
 *   succeeded but the row the server returned failed client normalisation.
 *   That is a success; the list is refetched after every write either way.
 * - An error can be an `ApiError`, a `HomeworkError` or a network failure, so
 *   it is turned into a sentence by `apiErrorMessage` and shown INSIDE the
 *   modal — a toast on the class screen would sit behind it.
 * - Only PUBLISHED exams are offered. A homework already linked to an exam
 *   that is no longer offered (detached from the class, say) keeps its link
 *   visible as a row, so saving does not silently drop it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { confirm } from '@/services/confirm';
import { toLatinDigits } from '@/services/latinDigits';
import type { Evaluation } from '@/services/evaluations';
import {
  ammanToday,
  dueBadge,
  dueDatePresets,
  homeworkDraftError,
  type TeacherHomework,
} from '@/services/homework';
import { archiveHomework, createHomework, listClassHomework, updateHomework } from '@/services/homeworkApi';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
const TOUCH = 44;

type Draft = { title: string; instructions: string; dueDate: string; evaluationId: string | null };
const EMPTY_DRAFT: Draft = { title: '', instructions: '', dueDate: '', evaluationId: null };

export function HomeworkTab({
  classId,
  exams,
  colors,
  isRTL,
  lang,
  t,
}: {
  classId: string;
  exams: Evaluation[];
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  lang: 'ar' | 'en';
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [items, setItems] = useState<TeacherHomework[] | null>(null);
  const [listError, setListError] = useState('');
  const loadSeq = useRef(0);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherHomework | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [fieldError, setFieldError] = useState<'title' | 'dueDate' | null>(null);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const data = await listClassHomework(classId);
      if (seq !== loadSeq.current) return;
      setItems(data.homework);
      setListError('');
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setListError(apiErrorMessage(e, 'hwLoadFailed', t));
    }
    // `t` changes identity with the language; a refetch for that is wasted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    void load();
    return () => {
      // Drops a response that lands after the tab (or class) is gone.
      loadSeq.current++;
    };
  }, [load]);

  const today = ammanToday();
  const published = exams.filter(e => e.status === 'published');
  const examTitle = (e: Evaluation) => (lang === 'ar' ? e.titleAr : e.title) || e.title || t('newEvaluation');
  // The exam rows of the picker; plus the current link when it is not offered.
  const linkedMissing =
    editing?.evaluationId && !published.some(e => e.id === editing.evaluationId)
      ? { id: editing.evaluationId, title: editing.examTitle ?? '' }
      : null;

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFieldError(null);
    setModalError('');
    setOpen(true);
  };

  const openEdit = (item: TeacherHomework) => {
    setEditing(item);
    setDraft({
      title: item.title,
      instructions: item.instructions,
      dueDate: item.dueDate,
      evaluationId: item.evaluationId,
    });
    setFieldError(null);
    setModalError('');
    setOpen(true);
  };

  const close = () => {
    if (saving) return;
    setOpen(false);
  };

  const patch = (next: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...next }));
    if (next.title !== undefined && fieldError === 'title') setFieldError(null);
    if (next.dueDate !== undefined && fieldError === 'dueDate') setFieldError(null);
    setModalError('');
  };

  const onSave = async () => {
    if (saving) return;
    const title = draft.title.trim();
    const dueDate = draft.dueDate.trim();
    const bad = homeworkDraftError({ title, dueDate });
    if (bad) {
      setFieldError(bad);
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      // A `null` result is a success whose row failed normalisation — see the header.
      if (editing) {
        await updateHomework(editing.id, {
          title,
          instructions: draft.instructions.trim(),
          dueDate,
          evaluationId: draft.evaluationId,
        });
      } else {
        await createHomework({
          classGroupId: classId,
          title,
          instructions: draft.instructions.trim(),
          dueDate,
          ...(draft.evaluationId ? { evaluationId: draft.evaluationId } : {}),
        });
      }
    } catch (e) {
      setModalError(apiErrorMessage(e, 'hwSaveFailed', t));
      setSaving(false);
      return;
    }
    setSaving(false);
    setOpen(false);
    await load();
  };

  const onDelete = async () => {
    if (!editing || saving) return;
    const target = editing;
    const ok = await confirm({
      title: t('hwDelete'),
      message: t('hwDeleteConfirm'),
      confirmLabel: t('hwDelete'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    setModalError('');
    try {
      await archiveHomework(target.id);
    } catch (e) {
      setModalError(apiErrorMessage(e, 'hwSaveFailed', t));
      setSaving(false);
      return;
    }
    setSaving(false);
    setOpen(false);
    await load();
  };

  const inputStyle = [
    styles.input,
    { color: colors.foreground, borderColor: colors.border, fontFamily: 'Almarai_400Regular', textAlign: align as 'left' | 'right' },
  ];
  const labelStyle = { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, textAlign: align } as const;

  const addRow = (
    <Pressable
      onPress={openCreate}
      accessibilityRole="button"
      accessibilityLabel={t('hwAdd')}
      style={[styles.addRow, { borderColor: ACCENT, flexDirection: rowDir }]}
    >
      <Ionicons name="add" size={20} color={ACCENT} />
      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>{t('hwAdd')}</Text>
    </Pressable>
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.list, { alignSelf: 'center', width: '100%', maxWidth: CONTENT_MAX_WIDTH }]}
        showsVerticalScrollIndicator={false}
      >
        {listError ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', flexDirection: rowDir },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={{ flex: 1, color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
              {listError}
            </Text>
            <Pressable onPress={() => void load()} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textDecorationLine: 'underline' }}>
                {t('retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {items === null ? (
          listError ? null : <ActivityIndicator color={ACCENT} style={{ paddingVertical: SPACE.xl }} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="create-outline"
            title={t('hwTeacherEmptyTitle')}
            body={t('hwTeacherEmptyDesc')}
            action={{ label: t('hwAdd'), onPress: openCreate }}
          />
        ) : (
          <>
            {addRow}
            {items.map(item => {
              const badge = dueBadge(item.dueDate, today);
              const dueColor =
                badge.kind === 'overdue' ? colors.destructive : badge.kind === 'today' || badge.kind === 'tomorrow' ? palette.warning : colors.mutedForeground;
              const dueText =
                badge.kind === 'overdue'
                  ? t('hwDueOverdue', Math.abs(badge.days))
                  : badge.kind === 'today'
                    ? t('hwDueToday')
                    : badge.kind === 'tomorrow'
                      ? t('hwDueTomorrow')
                      : t('hwDueOn', item.dueDate);
              const pct = item.studentCount > 0 ? Math.min(100, Math.round((item.doneCount / item.studentCount) * 100)) : 0;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => openEdit(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('hwEdit')}: ${item.title}`}
                  style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.body, textAlign: align }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: dueColor, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                    {dueText}
                  </Text>
                  {item.examTitle ? (
                    <View style={[styles.examLine, { flexDirection: rowDir }]}>
                      <Ionicons name="clipboard-outline" size={14} color={colors.mutedForeground} />
                      <Text
                        numberOfLines={1}
                        style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}
                      >
                        {item.examTitle}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.track, { backgroundColor: colors.border, flexDirection: rowDir }]}>
                    <View style={[styles.fill, { width: `${pct}%`, backgroundColor: ACCENT }]} />
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                    {t('hwDoneCount', item.doneCount, item.studentCount)}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* The Android keyboard rule: a <Modal> with a text input wraps its body
          in KeyboardSafeView (see CLAUDE.md). */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardSafeView>
          <View style={styles.backdrop}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.md }}>
                <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align }}>
                  {t(editing ? 'hwEdit' : 'hwAdd')}
                </Text>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={labelStyle}>{t('hwFieldTitle')}</Text>
                  <TextInput
                    value={draft.title}
                    onChangeText={v => patch({ title: v })}
                    placeholder={t('hwFieldTitle')}
                    placeholderTextColor={colors.mutedForeground}
                    style={inputStyle}
                  />
                  {fieldError === 'title' ? (
                    <Text style={[styles.fieldError, { color: colors.destructive, textAlign: align }]}>{t('hwErrTitle')}</Text>
                  ) : null}
                </View>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={labelStyle}>{t('hwFieldInstructions')}</Text>
                  <TextInput
                    value={draft.instructions}
                    onChangeText={v => patch({ instructions: v })}
                    placeholder={t('hwFieldInstructions')}
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    style={[...inputStyle, styles.multiline]}
                  />
                </View>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={labelStyle}>{t('hwFieldDue')}</Text>
                  <TextInput
                    value={draft.dueDate}
                    // Arabic number pads emit ٠-٩; isValidYmd and the preset match want 0-9.
                    onChangeText={v => patch({ dueDate: toLatinDigits(v) })}
                    placeholder={t('hwDueFormat')}
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={10}
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[...inputStyle, { textAlign: 'left', writingDirection: 'ltr' }]}
                  />
                  {fieldError === 'dueDate' ? (
                    <Text style={[styles.fieldError, { color: colors.destructive, textAlign: align }]}>{t('hwErrDue')}</Text>
                  ) : null}
                  <View style={[styles.chips, { flexDirection: rowDir }]}>
                    {dueDatePresets(today).map(p => {
                      const on = draft.dueDate.trim() === p.date;
                      return (
                        <Pressable
                          key={p.days}
                          onPress={() => patch({ dueDate: p.date })}
                          accessibilityRole="button"
                          aria-selected={on}
                          style={[
                            styles.chip,
                            { borderColor: on ? ACCENT : colors.border, backgroundColor: on ? ACCENT + '16' : colors.card },
                          ]}
                        >
                          <Text
                            style={{
                              color: on ? ACCENT : colors.mutedForeground,
                              fontFamily: on ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
                              fontSize: TYPE.caption,
                            }}
                          >
                            {t('hwPresetDays', p.days)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ gap: SPACE.xs }}>
                  <Text style={labelStyle}>{t('hwFieldExam')}</Text>
                  {[
                    { id: null as string | null, title: t('hwNoExam') },
                    ...(linkedMissing ? [{ id: linkedMissing.id as string | null, title: linkedMissing.title || t('newEvaluation') }] : []),
                    ...published.map(e => ({ id: e.id as string | null, title: examTitle(e) })),
                  ].map(opt => {
                    const on = draft.evaluationId === opt.id;
                    return (
                      <Pressable
                        key={opt.id ?? 'none'}
                        onPress={() => patch({ evaluationId: opt.id })}
                        accessibilityRole="button"
                        aria-selected={on}
                        style={[
                          styles.pick,
                          {
                            flexDirection: rowDir,
                            borderColor: on ? ACCENT : colors.border,
                            backgroundColor: on ? ACCENT + '16' : colors.card,
                          },
                        ]}
                      >
                        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? ACCENT : colors.mutedForeground} />
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            color: on ? ACCENT : colors.foreground,
                            fontFamily: on ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
                            fontSize: TYPE.label,
                            textAlign: align,
                          }}
                        >
                          {opt.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {modalError ? (
                  <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 23, textAlign: align }}>
                    {modalError}
                  </Text>
                ) : null}

                <View style={[styles.actions, { flexDirection: rowDir }]}>
                  <Pressable onPress={close} disabled={saving} style={styles.btn} accessibilityRole="button">
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold' }}>{t('cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void onSave()}
                    disabled={saving}
                    accessibilityRole="button"
                    style={[styles.btn, styles.primary, { backgroundColor: ACCENT_FILL, opacity: saving ? 0.5 : 1 }]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold' }}>{t('save')}</Text>
                    )}
                  </Pressable>
                </View>

                {editing ? (
                  <Pressable
                    onPress={() => void onDelete()}
                    disabled={saving}
                    accessibilityRole="button"
                    style={[styles.deleteBtn, { opacity: saving ? 0.5 : 1 }]}
                  >
                    <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label }}>{t('hwDelete')}</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACE.xl, paddingBottom: SPACE.hero * 2, gap: SPACE.md },
  addRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    minHeight: TOUCH,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
  },
  row: { borderWidth: 1, padding: SPACE.lg, gap: SPACE.sm },
  examLine: { alignItems: 'center', gap: SPACE.xs },
  track: { height: 6, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: RADIUS.pill },
  errorBox: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
  },
  card: { width: '100%', maxWidth: 460, maxHeight: '100%', borderRadius: RADIUS.lg, padding: SPACE.xl },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    fontSize: TYPE.body,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  fieldError: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption },
  chips: { flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  pick: {
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: TOUCH,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  actions: { justifyContent: 'flex-end', gap: SPACE.md },
  btn: { paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
  primary: { minWidth: 120, alignItems: 'center' },
  deleteBtn: { alignItems: 'center', justifyContent: 'center', minHeight: TOUCH },
});
