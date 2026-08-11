/**
 * Class detail — the roster for one class.
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
  addStudents,
  getClass,
  parseStudentNames,
  removeStudentFromClass,
  type ClassGroup,
  type RosterStudent,
} from '@/services/roster';
import { countStudents } from '@/services/i18n';
import { confirm } from '@/services/confirm';

const ACCENT = '#1B6B62';

export default function ClassDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [group, setGroup] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [namesText, setNamesText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const { group: g, students: s } = await getClass(id);
      setGroup(g);
      setStudents(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rosterNeedsConnection'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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
      setError(err instanceof Error ? err.message : t('rosterNeedsConnection'));
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
      setError(err instanceof Error ? err.message : t('rosterNeedsConnection'));
    }
  };

  const align = isRTL ? 'right' : 'left';
  const title = group ? (lang === 'ar' && group.nameAr ? group.nameAr : group.name) : '';

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
        <Text style={[styles.heroMeta, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {countStudents(students.length, lang)}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 10 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            error ? (
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
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <View style={styles.empty}>
                <Ionicons name="person-add-outline" size={40} color={colors.mutedForeground} />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' },
                  ]}
                >
                  {t('noStudentsYet')}
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
                  {t('noStudentsDesc')}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
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
                {item.externalRef ? (
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
              <Pressable onPress={() => { void onRemove(item); }} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable
        onPress={() => setShowAdd(true)}
        style={[styles.fab, { backgroundColor: ACCENT, bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="person-add" size={22} color="#fff" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  heroTitle: { fontSize: 24, color: '#fff' },
  heroMeta: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
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
