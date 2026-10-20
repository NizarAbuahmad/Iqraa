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
 * - Attachments are Library items, picked with the class shelf's own
 *   `LibraryPickerSheet` and sent as the shelf's POST body, or the teacher's
 *   own saved materials («من ملفاتي», `MaterialPickerSheet`), sent as an id the
 *   server checks is theirs; a save resends the whole list. «انشره في محادثة الشعبة» leaves a line in the class chat — on
 *   create through `shareToChat`, later from the edit modal.
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
import { LibraryPickerSheet } from '@/components/classes/LibraryPickerSheet';
import { MaterialPickerSheet } from '@/components/classes/MaterialPickerSheet';
import type { SavedMaterial } from '@/services/workspace';
import { addBodyFor } from '@/services/classResources';
import type { ResourceItem } from '@/services/resourceCatalog';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { confirm } from '@/services/confirm';
import type { Evaluation } from '@/services/evaluations';
import {
  ammanToday,
  clampedDone,
  dueBadge,
  dueDatePresets,
  formatDueDate,
  homeworkDraftError,
  maskYmd,
  resourceBody,
  resourceKey,
  type TeacherHomework,
} from '@/services/homework';
import { archiveHomework, createHomework, listClassHomework, shareHomework, updateHomework } from '@/services/homeworkApi';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
const TOUCH = 44;

/** `key` is `resourceKey`: `<source>:<nativeId>` (the Library picker's own "already added" key) or `material:<id>`. */
type DraftResource = { key: string; title: string; body: object };
type Draft = { title: string; instructions: string; dueDate: string; evaluationId: string | null; resources: DraftResource[] };
const EMPTY_DRAFT: Draft = { title: '', instructions: '', dueDate: '', evaluationId: null, resources: [] };
/** The server's cap (RESOURCES_MAX in the API's homework rules). */
const MAX_RESOURCES = 10;

export function HomeworkTab({
  classId,
  libraryGroup,
  exams,
  colors,
  isRTL,
  lang,
  t,
}: {
  classId: string;
  /** What the Library picker offers: the class's grade and subjects, as on the class shelf. */
  libraryGroup: { gradeId: string; subjectIds: readonly string[] };
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
  const [shareToChat, setShareToChat] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [notice, setNotice] = useState('');

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
    setShareToChat(true);
    setFieldError(null);
    setModalError('');
    setNotice('');
    setOpen(true);
  };

  const openEdit = (item: TeacherHomework) => {
    setEditing(item);
    setDraft({
      title: item.title,
      instructions: item.instructions,
      dueDate: item.dueDate,
      evaluationId: item.evaluationId,
      resources: item.resources.map(r => ({ key: resourceKey(r), title: r.title, body: resourceBody(r) })),
    });
    setFieldError(null);
    setModalError('');
    setNotice('');
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

  const onAddResource = (item: ResourceItem) => {
    const title = lang === 'en' && item.titleEn ? item.titleEn : item.titleAr;
    setDraft(d =>
      d.resources.some(r => r.key === item.key) || d.resources.length >= MAX_RESOURCES
        ? d
        : { ...d, resources: [...d.resources, { key: item.key, title, body: addBodyFor(item, lang) }] },
    );
  };

  const onAddMaterial = (m: SavedMaterial) => {
    const key = `material:${m.id}`;
    setDraft(d =>
      d.resources.some(r => r.key === key) || d.resources.length >= MAX_RESOURCES
        ? d
        : { ...d, resources: [...d.resources, { key, title: m.title, body: { kind: 'material', materialId: m.id } }] },
    );
  };

  const onShare = async () => {
    if (!editing || saving) return;
    setSaving(true);
    setModalError('');
    setNotice('');
    try {
      await shareHomework(editing.id);
      setNotice(t('hwShared'));
    } catch {
      setModalError(t('hwShareFailed'));
    }
    setSaving(false);
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
          resources: draft.resources.map(r => r.body),
        });
      } else {
        await createHomework({
          classGroupId: classId,
          title,
          instructions: draft.instructions.trim(),
          dueDate,
          ...(draft.evaluationId ? { evaluationId: draft.evaluationId } : {}),
          ...(draft.resources.length > 0 ? { resources: draft.resources.map(r => r.body) } : {}),
          shareToChat,
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
                      : t('hwDueOn', formatDueDate(item.dueDate));
              // Only students with an account can tick, so they — not the whole
              // roster — are what "done" is counted against.
              const noAccount = Math.max(0, item.studentCount - item.trackableCount);
              // A completion is kept after a link is removed, so doneCount can outrun the
              // denominator; clamp it for the text as well as the bar.
              const doneShown = clampedDone(item.doneCount, item.trackableCount);
              const pct = item.trackableCount > 0 ? Math.round((doneShown / item.trackableCount) * 100) : 0;
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
                  {item.resources.length > 0 ? (
                    <View style={[styles.examLine, { flexDirection: rowDir }]}>
                      <Ionicons name="attach-outline" size={14} color={colors.mutedForeground} />
                      <Text
                        numberOfLines={1}
                        style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}
                      >
                        {item.resources.map(r => r.title).join('، ')}
                      </Text>
                    </View>
                  ) : null}
                  {item.trackableCount > 0 ? (
                    <>
                      <View style={[styles.track, { backgroundColor: colors.border, flexDirection: rowDir }]}>
                        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: ACCENT }]} />
                      </View>
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                        {t('hwDoneCount', doneShown, item.trackableCount)}
                      </Text>
                    </>
                  ) : null}
                  {noAccount > 0 ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                      {t('hwNoAccountCount', noAccount)}
                    </Text>
                  ) : null}
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
                    // Digits only in, YYYY-MM-DD out: the dashes are fixed, never typed.
                    onChangeText={v => patch({ dueDate: maskYmd(v) })}
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

                <View style={{ gap: SPACE.xs }}>
                  <Text style={labelStyle}>{t('hwFieldResources')}</Text>
                  {draft.resources.map(r => (
                    <View key={r.key} style={[styles.pick, { flexDirection: rowDir, borderColor: colors.border }]}>
                      <Ionicons name="attach-outline" size={18} color={colors.mutedForeground} />
                      <Text
                        numberOfLines={1}
                        style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, textAlign: align }}
                      >
                        {r.title}
                      </Text>
                      <Pressable
                        onPress={() => patch({ resources: draft.resources.filter(x => x.key !== r.key) })}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('hwRemoveResource')}: ${r.title}`}
                      >
                        <Ionicons name="close" size={18} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ))}
                  {draft.resources.length < MAX_RESOURCES ? (
                    <Pressable
                      onPress={() => setPickerOpen(true)}
                      accessibilityRole="button"
                      style={[styles.pick, { flexDirection: rowDir, borderColor: ACCENT, borderStyle: 'dashed' }]}
                    >
                      <Ionicons name="library-outline" size={18} color={ACCENT} />
                      <Text style={{ flex: 1, color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: align }}>
                        {t('hwAddResource')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {draft.resources.length < MAX_RESOURCES ? (
                    <Pressable
                      onPress={() => setMaterialPickerOpen(true)}
                      accessibilityRole="button"
                      style={[styles.pick, { flexDirection: rowDir, borderColor: ACCENT, borderStyle: 'dashed' }]}
                    >
                      <Ionicons name="folder-open-outline" size={18} color={ACCENT} />
                      <Text style={{ flex: 1, color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: align }}>
                        {t('hwAddMaterial')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {draft.resources.some(r => r.key.startsWith('material:')) ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                      {t('hwMaterialNote')}
                    </Text>
                  ) : null}
                </View>

                {editing ? null : (
                  <Pressable
                    onPress={() => setShareToChat(v => !v)}
                    accessibilityRole="checkbox"
                    aria-checked={shareToChat}
                    style={[styles.pick, { flexDirection: rowDir, borderColor: colors.border }]}
                  >
                    <Ionicons
                      name={shareToChat ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={shareToChat ? ACCENT : colors.mutedForeground}
                    />
                    <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, textAlign: align }}>
                      {t('hwShareToChat')}
                    </Text>
                  </Pressable>
                )}

                {notice ? (
                  <Text style={{ color: ACCENT, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: align }}>{notice}</Text>
                ) : null}

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
                    onPress={() => void onShare()}
                    disabled={saving}
                    accessibilityRole="button"
                    style={[styles.deleteBtn, { flexDirection: rowDir, gap: SPACE.xs, opacity: saving ? 0.5 : 1 }]}
                  >
                    <Ionicons name="chatbubbles-outline" size={18} color={ACCENT} />
                    <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label }}>{t('hwShareToChat')}</Text>
                  </Pressable>
                ) : null}

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

      {/* After the form's Modal, so it opens on top of it. */}
      <LibraryPickerSheet
        visible={open && pickerOpen}
        group={libraryGroup}
        added={new Set(draft.resources.map(r => r.key))}
        busyKey={null}
        onAdd={onAddResource}
        onClose={() => setPickerOpen(false)}
      />
      <MaterialPickerSheet
        visible={open && materialPickerOpen}
        added={new Set(draft.resources.flatMap(r => (r.key.startsWith('material:') ? [r.key.slice('material:'.length)] : [])))}
        onAdd={onAddMaterial}
        onClose={() => setMaterialPickerOpen(false)}
      />
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
