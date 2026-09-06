/**
 * Class detail — who is in this class, and what was made for it.
 *
 * Three tabs over one class. The roster (الطلاب) is the register; materials
 * (الموارد) is what the teacher attached from their workspace; exams
 * (الامتحانات) is what they set and are marking. Together they turn a class
 * from an address book into "what did I give صف أ, and how did they do".
 *
 * The exams tab exists because marking was only reachable through the tools
 * catalog — a teacher standing on their own class, looking at their own
 * students, had no path to "mark their paper" at all.
 *
 * Attaching happens here rather than at generation time on purpose: a material
 * is usually written before there is a class to hang it on, and putting a class
 * picker into every generator would mean editing seven tool screens to answer a
 * question that belongs to the class.
 *
 * The add-students flow takes a pasted block rather than one input per name.
 * A teacher's register already exists in a WhatsApp message or a spreadsheet
 * column, and thirty separate inputs is the difference between using this and
 * abandoning it halfway.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useStudentAccountsEnabled } from '@/services/features';
import {
  RosterError,
  addStudents,
  generateJoinCode,
  getClass,
  parseStudentNames,
  removeStudentFromClass,
  updateStudent,
  type ClassGroup,
  type RosterStudent,
} from '@/services/roster';
import { copyToClipboard, shareAsText } from '@/services/share';
import { Toast } from '@/components/ui/Toast';
import { getItems, updateItem, type SavedMaterial } from '@/services/workspace';
import { listEvaluations, setEvaluationClass, type Evaluation } from '@/services/evaluations';
import {
  MATERIAL_COLOR,
  MATERIAL_ICON,
  MATERIAL_LABEL_KEY,
} from '@/constants/materialKind';
import { countMaterials, countStudents } from '@/services/i18n';
import { confirm } from '@/services/confirm';

const ACCENT = '#1B6B62';

type Tab = 'students' | 'materials' | 'exams';

export default function ClassDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  // v1 is teacher-only: minting a link code answers 403
  // `student_accounts_disabled` server-side, so the key icon below would be
  // a door onto an error. Asked of the server, not a build-time constant —
  // see services/features.ts.
  const studentAccounts = useStudentAccountsEnabled();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [tab, setTab] = useState<Tab>('students');
  const [group, setGroup] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [namesText, setNamesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [exams, setExams] = useState<Evaluation[]>([]);
  const [showAttachExam, setShowAttachExam] = useState(false);
  const [attachableExams, setAttachableExams] = useState<Evaluation[]>([]);
  const [examCount, setExamCount] = useState(0);
  const [attachingExamId, setAttachingExamId] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [attachable, setAttachable] = useState<SavedMaterial[]>([]);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [noteStudent, setNoteStudent] = useState<RosterStudent | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [mintingCode, setMintingCode] = useState(false);
  const [toast, setToast] = useState('');

  /** Server errors arrive in English; this screen is Arabic-first. */
  const describe = useCallback(
    (err: unknown): string => {
      if (err instanceof RosterError) {
        if (err.isStorageUnavailable) return t('rosterStorageUnavailable');
        if (err.status === 0 || err.status >= 500) return t('rosterLoadFailed');
        return err.message;
      }
      return t('rosterNeedsConnection');
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const { group: g, students: s } = await getClass(id);
      setGroup(g);
      setStudents(s);
    } catch (err) {
      setError(describe(err));
    } finally {
      setLoading(false);
    }
    // Materials are a separate store with its own offline fallback, so a
    // roster failure must not blank the materials tab and vice versa. Loaded
    // outside the try above for exactly that reason.
    setMaterials(await getItems({ classId: id }));
    setExams(await listEvaluations({ classId: id }));
  }, [id, describe]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Parsed live so the teacher sees the count before committing — pasting a
  // messy list and getting a surprising number is how duplicate rows happen.
  const parsedNames = useMemo(() => parseStudentNames(namesText), [namesText]);

  const onAdd = async () => {
    if (parsedNames.length === 0 || saving || !id) return;
    setSaving(true);
    setError('');
    try {
      const result = await addStudents(
        id,
        parsedNames.map(displayName => ({ displayName })),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAdd(false);
      setNamesText('');
      await load();
      // Say so when names were skipped. A teacher who pastes 30 and gets 27
      // needs to know the 3 were already on the roster, not lost.
      if (result.skipped.length > 0) {
        setError(t('skippedExisting', result.skipped.join('، ')));
      } else if (result.added === 0) {
        setError(t('noNewStudents'));
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Minting overwrites any live code, so a teacher who already handed one out
   * is asked first — the people still holding the old one are exactly the ones
   * who have not joined yet, which is the group this code exists for.
   */
  const onMintJoinCode = async () => {
    if (!id || mintingCode) return;
    if (group?.joinCode) {
      const ok = await confirm({
        title: t('joinCodeRegenerate'),
        message: t('joinCodeRegenerateConfirm'),
        confirmLabel: t('joinCodeRegenerate'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    setMintingCode(true);
    setError('');
    try {
      const minted = await generateJoinCode(id);
      setGroup(prev =>
        prev ? { ...prev, joinCode: minted.joinCode, joinCodeExpiresAt: minted.joinCodeExpiresAt } : prev,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(describe(err));
      setShowJoinCode(false);
    } finally {
      setMintingCode(false);
    }
  };

  const onRemove = async (student: RosterStudent) => {
    if (!id) return;
    const ok = await confirm({
      title: t('removeStudent'),
      message: t('removeStudentConfirm', student.displayName),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await removeStudentFromClass(id, student.id);
      setStudents(prev => prev.filter(s => s.id !== student.id));
    } catch (err) {
      setError(describe(err));
    }
  };

  const openNote = (student: RosterStudent) => {
    setNoteStudent(student);
    setNoteText(student.teacherNote);
  };

  const onSaveNote = async () => {
    if (!noteStudent || savingNote) return;
    setSavingNote(true);
    setError('');
    try {
      const updated = await updateStudent(noteStudent.id, { teacherNote: noteText });
      // Take the server's row rather than `noteText`: it trimmed the value, and
      // showing something the database does not hold is how a note that looks
      // saved turns out not to be.
      setStudents(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNoteStudent(null);
    } catch (err) {
      setError(describe(err));
    } finally {
      setSavingNote(false);
    }
  };

  /**
   * Only materials that are in no class are offered. A material belongs to one
   * class, so showing an attached one would present a silent move as an add.
   */
  const openAttach = async () => {
    setShowAttach(true);
    const all = await getItems({});
    // Kept so the empty state can tell the two cases apart. They read
    // identically as a blank list and mean opposite things: "you have not made
    // anything yet" needs a way to go make something, "they are all in other
    // classes" does not.
    setSavedCount(all.length);
    setAttachable(all.filter(m => !m.classGroupId));
  };

  const onAttach = async (material: SavedMaterial) => {
    if (!id || attachingId) return;
    setAttachingId(material.id);
    try {
      // Say so when it did not stick, rather than closing the sheet on a
      // success buzz and letting the reload quietly show the same list.
      if (!(await updateItem(material.id, { classGroupId: id }))) {
        setError(t('saveToClassFailed'));
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAttach(false);
      await load();
    } finally {
      setAttachingId(null);
    }
  };

  /**
   * Only exams in no class are offered, asked of the server rather than
   * filtered here — same reason as materials: an exam belongs to one class, so
   * offering an attached one would present a silent move as an add.
   */
  const openAttachExam = async () => {
    setShowAttachExam(true);
    const [all, free] = await Promise.all([
      listEvaluations({}),
      listEvaluations({ classId: 'none' }),
    ]);
    // Kept apart so the empty state can tell "you have not made an exam yet"
    // from "they are all in other classes" — identical blank lists, opposite
    // meanings, and only one of them needs a way out.
    setExamCount(all.length);
    setAttachableExams(free);
  };

  const onAttachExam = async (exam: Evaluation) => {
    if (!id || attachingExamId) return;
    setAttachingExamId(exam.id);
    try {
      await setEvaluationClass(exam.id, id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAttachExam(false);
      await load();
    } catch {
      setError(t('saveToClassFailed'));
    } finally {
      setAttachingExamId(null);
    }
  };

  const onDetachExam = async (exam: Evaluation) => {
    const title = (lang === 'ar' ? exam.titleAr : exam.title) || t('newEvaluation');
    const ok = await confirm({
      title: t('detachExam'),
      message: t('detachMaterialConfirm', title),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await setEvaluationClass(exam.id, null);
      await load();
    } catch {
      setError(t('saveToClassFailed'));
    }
  };

  const onDetach = async (material: SavedMaterial) => {
    const ok = await confirm({
      title: t('detachMaterial'),
      message: t('detachMaterialConfirm', material.title),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    // Only drop it from the list once the detach actually persisted. Removing
    // it optimistically made a failed detach look done until the next load put
    // the material straight back.
    if (!(await updateItem(material.id, { classGroupId: null }))) {
      setError(t('saveToClassFailed'));
      return;
    }
    setMaterials(prev => prev.filter(m => m.id !== material.id));
  };

  const align = isRTL ? 'right' : 'left';
  const title = group ? (lang === 'ar' && group.nameAr ? group.nameAr : group.name) : '';

  const errorBanner = error ? (
    <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
      <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
      <Text
        style={{
          color: colors.destructive,
          fontFamily: 'Almarai_400Regular',
          flex: 1,
          textAlign: align,
        }}
      >
        {error}
      </Text>
    </View>
  ) : null;

  const empty = (
    icon: keyof typeof Ionicons.glyphMap,
    titleKey: 'noStudentsYet' | 'noMaterialsYet' | 'noExamsYet',
    descKey: 'noStudentsDesc' | 'noMaterialsDesc' | 'noExamsDesc',
  ) => (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
        {t(titleKey)}
      </Text>
      <Text
        style={[
          styles.emptyText,
          { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' },
        ]}
      >
        {t(descKey)}
      </Text>
    </View>
  );

  const renderTab = (key: Tab, label: string, count: string) => {
    const active = tab === key;
    return (
      <Pressable
        key={key}
        onPress={() => setTab(key)}
        style={[
          styles.tab,
          {
            borderBottomColor: active ? '#fff' : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.tabLabel,
            {
              fontFamily: active ? 'Cairo_700Bold' : 'Cairo_500Medium',
              color: active ? '#fff' : 'rgba(255,255,255,0.7)',
            },
          ]}
        >
          {label}
        </Text>
        <Text style={[styles.tabCount, { fontFamily: 'Almarai_400Regular' }]}>{count}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
        </View>
        {/*
          The chat button sits on the title row, not opposite the back arrow.
          Alone in a space-between header it was stranded in the far corner
          with the class name on the line below, so nothing said which class it
          would open — and a bare speech bubble does not say who you would be
          talking to. Labelled, beside the name, it reads as one phrase.
          Deliberately not a fourth tab: the three tabs swap what this screen
          shows, this leaves the screen.
        */}
        <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]} numberOfLines={1}>
          {title}
        </Text>
        {/*
          Two pills on their own row rather than trailing the class name. The
          chat pill used to sit beside the title; a second one next to it
          overflows a 375pt phone, and the pair reads better as a row of
          actions than as a title that happens to have buttons stuck to it.

          The join code is here, labelled, because it was the thing nobody
          could find: it lived behind an unlabelled icon on a single student's
          row, four navigations deep, and had to be repeated per child.
        */}
        <View style={[styles.heroActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable
            onPress={() => router.push(`/messaging/class/${id}`)}
            hitSlop={8}
            style={[styles.classChatPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="chatbubbles-outline" size={15} color="#fff" />
            <Text style={[styles.classChatPillText, { fontFamily: 'Cairo_500Medium' }]}>
              {t('messagingClassChat')}
            </Text>
          </Pressable>
          {/* Minting a class join code answers 403 `student_accounts_disabled`
              while v1 is teacher-only, and the modal behind this pill has no
              other purpose — so the pill goes rather than opening onto an
              error. Comes back on its own when STUDENT_ACCOUNTS is enabled. */}
          {studentAccounts ? (
            <Pressable
              onPress={() => setShowJoinCode(true)}
              hitSlop={8}
              style={[styles.classChatPill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="key-outline" size={15} color="#fff" />
              <Text style={[styles.classChatPillText, { fontFamily: 'Cairo_500Medium' }]}>
                {t('joinCodeTitle')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.tabs, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {renderTab('students', t('classTabStudents'), countStudents(students.length, lang))}
          {renderTab('materials', t('classTabMaterials'), countMaterials(materials.length, lang))}
          {renderTab('exams', t('classTabExams'), t('countExams', exams.length))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : tab === 'students' ? (
        <FlatList
          data={students}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 10 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={errorBanner}
          ListEmptyComponent={
            error ? null : empty('person-add-outline', 'noStudentsYet', 'noStudentsDesc')
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openNote(item)}
              style={[
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.rowName,
                    { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align },
                  ]}
                >
                  {item.displayName}
                </Text>
                {/* The note, when there is one, replaces the register number in
                    the second line. Both at once makes a thirty-row list
                    unreadable, and the note is the thing a teacher scans for. */}
                {item.teacherNote ? (
                  <Text
                    style={[
                      styles.rowRef,
                      {
                        color: colors.mutedForeground,
                        fontFamily: 'Almarai_400Regular',
                        textAlign: align,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.teacherNote}
                  </Text>
                ) : item.externalRef ? (
                  <Text
                    style={[
                      styles.rowRef,
                      {
                        color: colors.mutedForeground,
                        fontFamily: 'Almarai_400Regular',
                        textAlign: align,
                      },
                    ]}
                  >
                    {item.externalRef}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name={item.teacherNote ? 'create' : 'create-outline'}
                size={18}
                color={item.teacherNote ? ACCENT : colors.mutedForeground}
              />
              {/* Who has actually signed up — the question a shared join code
                  immediately creates, and the one nothing on this screen used
                  to answer. Only shown once somebody has joined: thirty grey
                  "not joined yet" pills on day one is noise, not information.
                  Needs no flag guard of its own — nobody can be linked while
                  student accounts are off, so it never renders in v1. */}
              {item.linked ? (
                <View style={[styles.linkedPill, { backgroundColor: ACCENT + '18' }]}>
                  <Text style={[styles.linkedPillText, { color: ACCENT, fontFamily: 'Cairo_500Medium' }]}>
                    {t('rosterLinked')}
                  </Text>
                </View>
              ) : null}
              {studentAccounts ? (
                <Pressable
                  onPress={() => router.push(`/messaging/claim/${item.id}?studentName=${encodeURIComponent(item.displayName)}`)}
                  hitSlop={10}
                >
                  {/* A key, not a speech bubble: this opens the student's link
                      code. The bubble read as "chat with them" and hid the one
                      thing teachers were hunting for. */}
                  <Ionicons name="key-outline" size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => { void onRemove(item); }} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : tab === 'materials' ? (
        <FlatList
          data={materials}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 10 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={empty('folder-open-outline', 'noMaterialsYet', 'noMaterialsDesc')}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/workspace/view', params: { id: item.id } })}
              style={[
                styles.row,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View
                style={[styles.matIcon, { backgroundColor: MATERIAL_COLOR[item.type] + '18' }]}
              >
                <Ionicons name={MATERIAL_ICON[item.type]} size={20} color={MATERIAL_COLOR[item.type]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.rowName,
                    { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align },
                  ]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.rowRef,
                    {
                      color: MATERIAL_COLOR[item.type],
                      fontFamily: 'Almarai_400Regular',
                      textAlign: align,
                    },
                  ]}
                >
                  {t(MATERIAL_LABEL_KEY[item.type])}
                </Text>
              </View>
              <Pressable onPress={() => { void onDetach(item); }} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={exams}
          keyExtractor={e => e.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 10 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={empty('clipboard-outline', 'noExamsYet', 'noExamsDesc')}
          renderItem={({ item }) => {
            const title = (lang === 'ar' ? item.titleAr : item.title) || t('newEvaluation');
            const draft = item.status !== 'published';
            return (
              <Pressable
                onPress={() =>
                  router.push(
                    draft
                      ? { pathname: '/evaluations/[id]', params: { id: item.id } }
                      : { pathname: '/evaluations/[id]/answers', params: { id: item.id } },
                  )
                }
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text style={[styles.rowRef, { color: draft ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                    {draft
                      ? t('examNotPublished')
                      : t('examMarkedCount', String(item.markedCount ?? 0), String(students.length))}
                  </Text>
                </View>
                <Pressable onPress={() => { void onDetachExam(item); }} hitSlop={10}>
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        onPress={() => {
          if (tab === 'students') setShowAdd(true);
          else if (tab === 'exams') void openAttachExam();
          else void openAttach();
        }}
        style={[styles.fab, { backgroundColor: ACCENT, bottom: insets.bottom + 24 }]}
      >
        <Ionicons name={tab === 'students' ? 'person-add' : 'add'} size={22} color="#fff" />
      </Pressable>

      <Modal
        visible={showJoinCode}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoinCode(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
              {t('joinCodeTitle')}
            </Text>
            <Text style={[styles.modalHint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('joinCodeDesc')}
            </Text>

            {group?.joinCode ? (
              <>
                <Text style={[styles.codeText, { color: ACCENT, fontFamily: 'Cairo_700Bold' }]} selectable>
                  {group.joinCode}
                </Text>
                {group.joinCodeExpiresAt ? (
                  <Text style={[styles.modalHint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
                    {t('messagingCodeExpires')}: {new Date(group.joinCodeExpiresAt).toLocaleDateString()}
                  </Text>
                ) : null}
                <View style={[styles.codeActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Pressable
                    onPress={async () => {
                      await copyToClipboard(group.joinCode!);
                      setToast(t('messagingCodeCopied'));
                    }}
                    style={[styles.pickRow, { borderColor: colors.border, flex: 1, justifyContent: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.mutedForeground} />
                    <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium' }}>{t('messagingCopyCode')}</Text>
                  </Pressable>
                  <Pressable
                    // shareAsText falls back to the clipboard where the OS share
                    // sheet does not exist (react-native-web), so this is never
                    // a dead button — it just tells the truth about what it did.
                    onPress={async () => {
                      const how = await shareAsText(`${t('joinCodeTitle')}: ${group.joinCode}`, title);
                      if (how === 'copied') setToast(t('messagingCodeCopied'));
                    }}
                    style={[styles.pickRow, { borderColor: colors.border, flex: 1, justifyContent: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                  >
                    <Ionicons name="share-outline" size={18} color={colors.mutedForeground} />
                    <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium' }}>{t('joinCodeShare')}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={[styles.modalHint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', paddingVertical: 12 }]}>
                {t('joinCodeNone')}
              </Text>
            )}

            <Pressable
              onPress={() => { void onMintJoinCode(); }}
              disabled={mintingCode}
              style={[styles.createRow, { borderColor: ACCENT, justifyContent: 'center', opacity: mintingCode ? 0.5 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              {mintingCode ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={ACCENT} />
                  <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold' }}>
                    {group?.joinCode ? t('joinCodeRegenerate') : t('joinCodeGenerate')}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={() => setShowJoinCode(false)} style={{ paddingVertical: 12 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: 'center' }}>
                {t('cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align },
              ]}
            >
              {t('addStudents')}
            </Text>
            <Text
              style={[
                styles.modalHint,
                { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
              ]}
            >
              {t('studentNamesHint')}
            </Text>
            <TextInput
              value={namesText}
              onChangeText={setNamesText}
              placeholder={t('studentNamesPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoFocus
              style={[
                styles.textarea,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: align,
                },
              ]}
            />
            {/* Only once there is something to count — "will add no students"
                is not a sentence anyone wants to read in either language. */}
            {parsedNames.length > 0 ? (
              <Text
                style={[
                  styles.count,
                  { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
                ]}
              >
                {t('willAddCount', parsedNames.length)}
              </Text>
            ) : null}
            {/* The code is minted per student and only after the name exists,
                so this dialog cannot show one — it can say where to find it,
                which is the whole complaint. */}
            <Text
              style={[
                styles.modalHint,
                { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align, marginTop: 10 },
              ]}
            >
              {t('addStudentsCodeHint')}
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowAdd(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                  {t('cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onAdd}
                disabled={parsedNames.length === 0 || saving}
                style={[
                  styles.modalBtn,
                  styles.modalPrimary,
                  {
                    backgroundColor: ACCENT,
                    opacity: parsedNames.length === 0 || saving ? 0.5 : 1,
                  },
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold' }}>
                    {t('addToClass')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={noteStudent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteStudent(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align },
              ]}
            >
              {noteStudent?.displayName}
            </Text>
            <Text
              style={[
                styles.modalHint,
                { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
              ]}
            >
              {t('studentNoteHint')}
            </Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t('studentNotePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              autoFocus
              style={[
                styles.textarea,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: align,
                  minHeight: 120,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setNoteStudent(null)} style={styles.modalBtn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                  {t('cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { void onSaveNote(); }}
                disabled={savingNote}
                style={[
                  styles.modalBtn,
                  styles.modalPrimary,
                  { backgroundColor: ACCENT, opacity: savingNote ? 0.5 : 1 },
                ]}
              >
                {savingNote ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold' }}>
                    {t('saveNote')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAttach}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttach(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align },
              ]}
            >
              {t('attachMaterial')}
            </Text>
            <Text
              style={[
                styles.modalHint,
                { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
              ]}
            >
              {t('attachMaterialHint')}
            </Text>
            <FlatList
              data={attachable}
              keyExtractor={m => m.id}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <Text
                  style={[
                    styles.modalHint,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Almarai_400Regular',
                      textAlign: 'center',
                      paddingVertical: 24,
                    },
                  ]}
                >
                  {savedCount === 0 ? t('noSavedMaterials') : t('noMaterialsToAttach')}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { void onAttach(item); }}
                  disabled={attachingId !== null}
                  style={[
                    styles.pickRow,
                    {
                      borderColor: colors.border,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      opacity: attachingId && attachingId !== item.id ? 0.5 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={MATERIAL_ICON[item.type]}
                    size={18}
                    color={MATERIAL_COLOR[item.type]}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: 'Almarai_400Regular',
                      flex: 1,
                      textAlign: align,
                    }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {attachingId === item.id ? <ActivityIndicator size="small" color={ACCENT} /> : null}
                </Pressable>
              )}
            />
            {/* The sheet offered one way out — pick something that exists.
                A teacher with nothing saved, or nothing left to attach, was
                shown a dead end and a Cancel button. */}
            <Pressable
              onPress={() => {
                setShowAttach(false);
                router.push('/(tabs)/ai-tools');
              }}
              style={[
                styles.createRow,
                { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
              <Text
                style={{
                  color: ACCENT,
                  fontFamily: 'Cairo_600SemiBold',
                  flex: 1,
                  textAlign: align,
                }}
              >
                {t('createNewMaterial')}
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowAttach(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                  {t('cancel')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAttachExam}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachExam(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align },
              ]}
            >
              {t('attachExam')}
            </Text>
            <Text
              style={[
                styles.modalHint,
                { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
              ]}
            >
              {t('attachExamHint')}
            </Text>
            <FlatList
              data={attachableExams}
              keyExtractor={e => e.id}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ gap: 8 }}
              ListEmptyComponent={
                <Text
                  style={[
                    styles.modalHint,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Almarai_400Regular',
                      textAlign: 'center',
                      paddingVertical: 24,
                    },
                  ]}
                >
                  {examCount === 0 ? t('noExamsAtAll') : t('noExamsToAttach')}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { void onAttachExam(item); }}
                  disabled={attachingExamId !== null}
                  style={[
                    styles.pickRow,
                    {
                      borderColor: colors.border,
                      opacity: attachingExamId && attachingExamId !== item.id ? 0.5 : 1,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontFamily: 'Almarai_400Regular',
                      fontSize: 14,
                      flex: 1,
                      textAlign: align,
                    }}
                    numberOfLines={1}
                  >
                    {(lang === 'ar' ? item.titleAr : item.title) || t('newEvaluation')}
                  </Text>
                  {attachingExamId === item.id ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
                  )}
                </Pressable>
              )}
            />
            {/* Same dead end the materials sheet above already grew out of: a
                teacher with no exams was told to "create one first" and given
                only Cancel — with the create screen three navigations away,
                in a tools menu they had no reason to be looking at. */}
            <Pressable
              onPress={() => {
                setShowAttachExam(false);
                router.push('/evaluations/new');
              }}
              style={[
                styles.createRow,
                { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
              <Text
                style={{
                  color: ACCENT,
                  fontFamily: 'Cairo_600SemiBold',
                  flex: 1,
                  textAlign: align,
                }}
              >
                {t('createNewExam')}
              </Text>
            </Pressable>
            <Pressable onPress={() => setShowAttachExam(false)} style={{ paddingVertical: 12 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: 'center' }}>
                {t('cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 0, gap: 8 },
  heroTitle: { fontSize: 24, color: '#fff' },
  heroActions: { alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  // Translucent white rather than a solid fill: it has to read as a control on
  // the teal hero without competing with the class name beside it.
  classChatPill: {
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  classChatPillText: { fontSize: 12, color: '#fff' },
  tabs: { marginTop: 6 },
  tab: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 2, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 15 },
  tabCount: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  matIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15 },
  rowRef: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17 },
  emptyText: { fontSize: 14, maxWidth: 280, lineHeight: 20 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { width: '100%', maxWidth: 460, borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18 },
  modalHint: { fontSize: 13 },
  pickRow: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  createRow: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  count: { fontSize: 13 },
  codeText: { fontSize: 28, letterSpacing: 4, textAlign: 'center', marginTop: 4 },
  codeActions: { gap: 8 },
  linkedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  linkedPillText: { fontSize: 11 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalPrimary: { minWidth: 120, alignItems: 'center' },
});
