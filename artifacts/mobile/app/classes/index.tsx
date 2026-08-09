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
import { createClass, listClasses, type ClassGroup } from '@/services/roster';
import { countStudents } from '@/services/i18n';

const ACCENT = '#1B6B62';

export default function ClassesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setClasses(await listClasses());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rosterNeedsConnection'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError('');
    try {
      const created = await createClass({ name, gradeId: 'grade-10' });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowNew(false);
      setNewName('');
      setClasses(prev => [...prev, created]);
      router.push({ pathname: '/classes/[id]', params: { id: created.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rosterNeedsConnection'));
    } finally {
      setCreating(false);
    }
  };

  const align = isRTL ? 'right' : 'left';

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
          style={[styles.heroTitle, { fontFamily: 'Inter_700Bold', textAlign: align }]}
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
          data={classes}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            error ? (
              <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
                <Text
                  style={{
                    color: colors.destructive,
                    fontFamily: 'Inter_400Regular',
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
                    { color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
                  ]}
                >
                  {t('noClassesYet')}
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_400Regular',
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
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: align },
                  ]}
                >
                  {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
                </Text>
                <Text
                  style={[
                    styles.cardMeta,
                    { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: align },
                  ]}
                >
                  {countStudents(item.studentCount, lang)}
                </Text>
              </View>
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
                { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: align },
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
                  fontFamily: 'Inter_400Regular',
                  textAlign: align,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowNew(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }}>
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
                  <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>
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
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalPrimary: { minWidth: 110, alignItems: 'center' },
});
