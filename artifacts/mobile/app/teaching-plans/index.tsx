/**
 * Teaching plans — a teacher's own free-text notes on what they intend to
 * teach: school, grades, topics, and schedule. See services/teachingPlans.ts.
 *
 * Deliberately simpler than /classes: no sub-resources (students, join
 * codes), so create and edit share one modal instead of a separate detail
 * screen — `editingId` says which mode it's in.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import {
  TeachingPlanError,
  archiveTeachingPlan,
  createTeachingPlan,
  listTeachingPlans,
  updateTeachingPlan,
  type TeachingPlan,
} from '@/services/teachingPlans';
import { confirm } from '@/services/confirm';
import type { TranslationKey } from '@/services/i18n';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';

const ACCENT = '#1B6B62';

const EMPTY_FORM = { title: '', schoolName: '', grades: '', topics: '', time: '' };

export default function TeachingPlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();

  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const describe = useCallback(
    (err: unknown, fallback: TranslationKey): string => {
      if (err instanceof TeachingPlanError) {
        if (err.isStorageUnavailable) return t('teachingPlansStorageUnavailable');
        if (err.status === 0 || err.status >= 500) return t(fallback);
        return err.message;
      }
      return t('teachingPlansNeedsConnection');
    },
    [t],
  );

  const load = useCallback(async () => {
    setError('');
    try {
      setPlans(await listTeachingPlans());
    } catch (err) {
      setError(describe(err, 'teachingPlansLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [describe]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (plan: TeachingPlan) => {
    setEditingId(plan.id);
    setForm({
      title: plan.title,
      schoolName: plan.schoolName,
      grades: plan.grades,
      topics: plan.topics,
      time: plan.time,
    });
    setShowForm(true);
  };

  const onSave = async () => {
    const title = form.title.trim();
    if (!title || saving) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const updated = await updateTeachingPlan(editingId, { ...form, title });
        setPlans(prev => prev.map(p => (p.id === editingId ? updated : p)));
      } else {
        const created = await createTeachingPlan({ ...form, title });
        setPlans(prev => [...prev, created]);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowForm(false);
    } catch (err) {
      setError(describe(err, editingId ? 'teachingPlansUpdateFailed' : 'teachingPlansCreateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (plan: TeachingPlan) => {
    const ok = await confirm({
      title: t('deleteTeachingPlan'),
      message: t('deleteTeachingPlanConfirm', plan.title),
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok || deletingId) return;
    setDeletingId(plan.id);
    setError('');
    try {
      await archiveTeachingPlan(plan.id);
      setPlans(prev => prev.filter(p => p.id !== plan.id));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(describe(err, 'teachingPlansLoadFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const align = isRTL ? 'right' : 'left';
  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;
  const numColumns = isDesktop ? 3 : 1;
  const centered = { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const };

  const inputStyle = [
    styles.input,
    { color: colors.foreground, borderColor: colors.border, fontFamily: 'Almarai_400Regular', textAlign: align as 'left' | 'right' },
  ];

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
          {t('myTeachingPlans')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={plans}
          keyExtractor={p => p.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
          contentContainerStyle={[{ padding: 20, paddingBottom: 100, gap: 12 }, centered]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            error ? (
              <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
                <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
                  {error}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
                  {t('noTeachingPlansYet')}
                </Text>
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' },
                  ]}
                >
                  {t('noTeachingPlansDesc')}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openEdit(item)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, numColumns > 1 && { flex: 1 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
                  {item.title}
                </Text>
                {item.schoolName || item.grades ? (
                  <Text style={[styles.cardMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                    {[item.schoolName, item.grades].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => { void onDelete(item); }} disabled={deletingId === item.id} hitSlop={10}>
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
                )}
              </Pressable>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.mutedForeground} />
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={openCreate} style={[styles.fab, { backgroundColor: ACCENT, bottom: insets.bottom + 24 }]}>
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
              {editingId ? t('editTeachingPlan') : t('newTeachingPlan')}
            </Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12 }}>
              <TextInput
                value={form.title}
                onChangeText={v => setForm(f => ({ ...f, title: v }))}
                placeholder={t('planTitlePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                style={inputStyle}
              />
              <TextInput
                value={form.schoolName}
                onChangeText={v => setForm(f => ({ ...f, schoolName: v }))}
                placeholder={t('schoolNamePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                style={inputStyle}
              />
              <TextInput
                value={form.grades}
                onChangeText={v => setForm(f => ({ ...f, grades: v }))}
                placeholder={t('planGradesPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                style={inputStyle}
              />
              <TextInput
                value={form.topics}
                onChangeText={v => setForm(f => ({ ...f, topics: v }))}
                placeholder={t('planTopicsPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
              />
              <TextInput
                value={form.time}
                onChangeText={v => setForm(f => ({ ...f, time: v }))}
                placeholder={t('planTimePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                style={inputStyle}
              />
            </ScrollView>
            {error ? (
              <View style={[styles.modalError, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 12.5, lineHeight: 19, flex: 1, textAlign: align }}>
                  {error}
                </Text>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowForm(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={onSave}
                disabled={!form.title.trim() || saving}
                style={[styles.modalBtn, styles.modalPrimary, { backgroundColor: ACCENT, opacity: !form.title.trim() || saving ? 0.5 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold' }}>{t('saveTeachingPlan')}</Text>
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
