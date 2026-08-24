/**
 * Class detail — who is in this class, and what was made for it.
 *
 * Two tabs over one class. The roster (الطلاب) is the register; materials
 * (الموارد) is what the teacher attached from their workspace, which is what
 * turns a class from an address book into "what did I give صف أ".
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
import {
  RosterError,
  addStudents,
  getClass,
  parseStudentNames,
  removeStudentFromClass,
  updateStudent,
  type ClassGroup,
  type RosterStudent,
} from '@/services/roster';
import { getItems, updateItem, type SavedMaterial } from '@/services/workspace';
import {
  MATERIAL_COLOR,
  MATERIAL_ICON,
  MATERIAL_LABEL_KEY,
} from '@/constants/materialKind';
import { countMaterials, countStudents } from '@/services/i18n';
import { confirm } from '@/services/confirm';

const ACCENT = '#1B6B62';

type Tab = 'students' | 'materials';

export default function ClassDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
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
  const [showAttach, setShowAttach] = useState(false);
  const [attachable, setAttachable] = useState<SavedMaterial[]>([]);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [noteStudent, setNoteStudent] = useState<RosterStudent | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

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
    setAttachable(all.filter(m => !m.classGroupId));
  };

  const onAttach = async (material: SavedMaterial) => {
    if (!id || attachingId) return;
    setAttachingId(material.id);
    try {
      await updateItem(material.id, { classGroupId: id });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAttach(false);
      await load();
    } finally {
      setAttachingId(null);
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
    await updateItem(material.id, { classGroupId: null });
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

  const empty = (icon: keyof typeof Ionicons.glyphMap, titleKey: 'noStudentsYet' | 'noMaterialsYet', descKey: 'noStudentsDesc' | 'noMaterialsDesc') => (
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
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {title}
        </Text>
        <View style={[styles.tabs, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {renderTab('students', t('classTabStudents'), countStudents(students.length, lang))}
          {renderTab('materials', t('classTabMaterials'), countMaterials(materials.length, lang))}
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
              <Pressable onPress={() => { void onRemove(item); }} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </Pressable>
          )}
        />
      ) : (
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
      )}

      <Pressable
        onPress={() => {
          if (tab === 'students') setShowAdd(true);
          else void openAttach();
        }}
        style={[styles.fab, { backgroundColor: ACCENT, bottom: insets.bottom + 24 }]}
      >
        <Ionicons name={tab === 'students' ? 'person-add' : 'add'} size={22} color="#fff" />
      </Pressable>

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
                  {t('noMaterialsToAttach')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 0, gap: 8 },
  heroTitle: { fontSize: 24, color: '#fff' },
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalPrimary: { minWidth: 120, alignItems: 'center' },
});
