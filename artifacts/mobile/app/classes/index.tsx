/**
 * Classes list — the entry point to the roster.
 *
 * A class exists so an evaluation can be assigned and a level can be attached
 * to a named student. Nothing here is invented locally: without the API the
 * screen says so rather than showing a roster that the server has never seen.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { RosterError, archiveClass, createClass, listClasses, type ClassGroup } from '@/services/roster';
import { confirm } from '@/services/confirm';
import { countStudents, type TranslationKey } from '@/services/i18n';
import { SUBJECTS, getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { narrowSubjectsForGrade, resolveSelectedId } from '@/services/teacherCatalogFilter';
import { RosterConsentGate } from '@/components/RosterConsentGate';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';

const ACCENT = '#1B6B62';

/** A class's subject for the list card. Empty when unset or off-catalog. */
function subjectName(subjectId: string | undefined, lang: string): string {
  const subject = subjectId ? SUBJECTS.find(s => s.id === subjectId) : undefined;
  if (!subject) return '';
  return lang === 'ar' ? subject.nameAr : subject.name;
}

/**
 * One row of single-select pills in the new-class sheet — grade, then subject.
 *
 * Renders nothing for a list of one: the teacher has no decision to make, and
 * the single value is submitted either way.
 */
function ChipRow({ label, options, selectedId, onSelect, isRTL, lang, colors }: {
  label: string;
  options: readonly { id: string; name: string; nameAr: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  isRTL: boolean;
  lang: string;
  colors: ReturnType<typeof useColors>;
}) {
  if (options.length < 2) return null;
  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: 'Cairo_500Medium',
          fontSize: 12,
          textAlign: isRTL ? 'right' : 'left',
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }}>
        {options.map(o => {
          const active = selectedId === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o.id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: active ? ACCENT : colors.border,
                backgroundColor: active ? ACCENT + '16' : colors.card,
              }}
            >
              <Text
                style={{
                  color: active ? ACCENT : colors.mutedForeground,
                  fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                  fontSize: 13,
                }}
              >
                {lang === 'ar' ? o.nameAr : o.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The roster's front door, and so where the consent gate sits. A teacher with
 * no attestation also has no classes — creating one is a write, and the server
 * refuses roster writes without it — so there is nothing behind this screen to
 * reach around it to. The server is the enforcement either way
 * (`lib/rosterConsent.ts`); this is what stops a teacher meeting that refusal
 * as a raw 403 after typing a name.
 */
export default function ClassesScreen() {
  return (
    <RosterConsentGate>
      <ClassesList />
    </RosterConsentGate>
  );
}

function ClassesList() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGradeId, setNewGradeId] = useState('grade-10');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pickerGrades = getPickerGrades();

  /**
   * `classes.subject_id` has always existed and the API has always accepted
   * it, but this form never sent one — so every class created in the app
   * carries an empty subject, and a teacher who teaches two subjects to the
   * same grade has two indistinguishable classes.
   *
   * The choices are the subjects this teacher already said they teach *to
   * this grade* (`/setup-subjects`), which is the same narrowing the
   * curriculum browser does — nobody should have to state that twice.
   */
  const { user } = useAuth();
  const pickerSubjects = narrowSubjectsForGrade(
    getPickerSubjects(newGradeId),
    newGradeId,
    user?.teachingAssignments,
    user?.subjectIds,
  );
  const selectedSubjectId = resolveSelectedId(pickerSubjects, newSubjectId);

  /**
   * The API answers in English; this screen is Arabic-first. Translate the
   * condition rather than echoing the server's sentence into the dialog.
   */
  const describe = useCallback(
    (err: unknown, fallback: TranslationKey): string => {
      if (err instanceof RosterError) {
        if (err.isStorageUnavailable) return t('rosterStorageUnavailable');
        if (err.status === 0 || err.status >= 500) return t(fallback);
        return err.message;
      }
      return t('rosterNeedsConnection');
    },
    [t],
  );

  const load = useCallback(async () => {
    setError('');
    try {
      setClasses(await listClasses());
    } catch (err) {
      setError(describe(err, 'rosterLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [describe]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onDelete = async (group: ClassGroup) => {
    const name = lang === 'ar' && group.nameAr ? group.nameAr : group.name;
    const ok = await confirm({
      title: t('deleteClass'),
      message: t('deleteClassConfirm', name),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok || deletingId) return;
    setDeletingId(group.id);
    setError('');
    try {
      await archiveClass(group.id);
      // Drop it only once the archive actually persisted. Removing it
      // optimistically made a failed delete look done until the next focus
      // put the class straight back — the same trap the materials list hit.
      setClasses(prev => prev.filter(c => c.id !== group.id));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(describe(err, 'rosterLoadFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError('');
    try {
      const created = await createClass({
        name,
        gradeId: newGradeId,
        subjectId: selectedSubjectId || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowNew(false);
      setNewName('');
      setNewGradeId('grade-10');
      setNewSubjectId('');
      setClasses(prev => [...prev, created]);
      router.push({ pathname: '/classes/[id]', params: { id: created.id } });
    } catch (err) {
      setError(describe(err, 'rosterCreateFailed'));
    } finally {
      setCreating(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;
  const numColumns = isDesktop ? 3 : 1;
  const centered = { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const };

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
        <Text
          style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}
        >
          {t('myClasses')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={classes}
          keyExtractor={c => c.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
          contentContainerStyle={[{ padding: 20, paddingBottom: 100, gap: 12 }, centered]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            error ? (
              <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
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
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={40} color={colors.mutedForeground} />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' },
                  ]}
                >
                  {t('noClassesYet')}
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Almarai_400Regular',
                      textAlign: 'center',
                    },
                  ]}
                >
                  {t('noClassesDesc')}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/classes/[id]', params: { id: item.id } })}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, numColumns > 1 && { flex: 1 }]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align },
                  ]}
                >
                  {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
                </Text>
                <Text
                  style={[
                    styles.cardMeta,
                    { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
                  ]}
                >
                  {/* Storing the subject is only worth anything if it shows:
                      two classes of the same grade differ by this line.
                      Classes created before the picker existed have no
                      subject — they keep the bare student count. */}
                  {[subjectName(item.subjectId, lang), countStudents(item.studentCount, lang)]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {/* Deleting a class was reachable from nowhere: archiveClass has
                  existed in services/roster.ts since the roster shipped and no
                  screen ever called it, so a class created by mistake stayed on
                  this list forever. Put here rather than inside the class
                  screen — this is where you look at a class you no longer want,
                  and it saves opening the thing you are trying to get rid of. */}
              <Pressable
                onPress={() => { void onDelete(item); }}
                disabled={deletingId === item.id}
                hitSlop={10}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
                )}
              </Pressable>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => setShowNew(true)}
        style={[styles.fab, { backgroundColor: ACCENT, bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      <Modal visible={showNew} transparent animationType="fade" onRequestClose={() => setShowNew(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align },
              ]}
            >
              {t('newClass')}
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={t('classNamePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: align,
                },
              ]}
            />
            {/* Two pill rows now, so each needs saying which it is. Either one
                hides itself when it holds a single option — that is not a
                choice, and the value is sent regardless. */}
            <ChipRow
              label={t('grade')}
              options={pickerGrades}
              selectedId={newGradeId}
              onSelect={setNewGradeId}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
            />
            <ChipRow
              label={t('subject')}
              options={pickerSubjects}
              selectedId={selectedSubjectId}
              onSelect={setNewSubjectId}
              isRTL={isRTL}
              lang={lang}
              colors={colors}
            />
            {/* The list's error banner sits behind this sheet, so a failed
                create looked like nothing happened. Say it here too. */}
            {error ? (
              <View style={[styles.modalError, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                <Text
                  style={{
                    color: colors.destructive,
                    fontFamily: 'Almarai_400Regular',
                    fontSize: 12.5,
                    lineHeight: 19,
                    flex: 1,
                    textAlign: align,
                  }}
                >
                  {error}
                </Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowNew(false);
                  setNewGradeId('grade-10');
                  setNewSubjectId('');
                }}
                style={styles.modalBtn}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>
                  {t('cancel')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onCreate}
                disabled={!newName.trim() || creating}
                style={[
                  styles.modalBtn,
                  styles.modalPrimary,
                  { backgroundColor: ACCENT, opacity: !newName.trim() || creating ? 0.5 : 1 },
                ]}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold' }}>
                    {t('createClass')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  heroTitle: { fontSize: 26, color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardTitle: { fontSize: 16 },
  cardMeta: { fontSize: 13, marginTop: 4 },
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
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 20, gap: 14 },
  modalTitle: { fontSize: 18 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalError: { alignItems: 'flex-start', gap: 8 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalPrimary: { minWidth: 110, alignItems: 'center' },
});
