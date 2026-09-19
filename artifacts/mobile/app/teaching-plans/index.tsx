/**
 * Teaching plans — what a teacher intends to teach a class. The plan is
 * anchored to a شعبة and inherits its grade and subject (services/planScope.ts);
 * topics and schedule are still free text. See services/teachingPlans.ts.
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
import { listClasses, type ClassGroup } from '@/services/roster';
import { planScopeParts } from '@/services/planScope';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { confirm } from '@/services/confirm';
import type { TranslationKey } from '@/services/i18n';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';

const ACCENT = '#1B6B62';

const EMPTY_FORM = {
  title: '',
  schoolName: '',
  classGroupId: null as string | null,
  grades: '',
  topics: '',
  date: '',
  time: '',
  notes: '',
};

export default function TeachingPlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();

  const [plans, setPlans] = useState<TeachingPlan[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
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
    // Best-effort: the class picker is a convenience, not the point of this
    // screen, so a roster failure here should not block the plans list.
    try {
      setClasses(await listClasses());
    } catch {
      /* the picker just falls back to "no class" options */
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
      classGroupId: plan.classGroupId,
      grades: plan.grades,
      topics: plan.topics,
      date: plan.date,
      time: plan.time,
      notes: plan.notes,
    });
    setShowForm(true);
  };

  const classNameFor = (id: string | null): string => {
    if (!id) return '';
    const found = classes.find(c => c.id === id);
    return found ? (lang === 'ar' && found.nameAr ? found.nameAr : found.name) : '';
  };

  /**
   * A plan's grade and subject are the class's, not a typed string — see
   * services/planScope.ts. The naming lookups are passed in so that module
   * stays loadable by the bare `node --test` runner.
   */
  const naming = {
    grade: (id: string) => {
      const g = GRADES.find(x => x.id === id);
      return g ? (lang === 'ar' ? g.nameAr : g.name) : '';
    },
    subject: (id: string) => {
      const s = SUBJECTS.find(x => x.id === id);
      return s ? (lang === 'ar' ? s.nameAr : s.name) : '';
    },
  };
  const scopeOf = (plan: { classGroupId: string | null; grades: string }) =>
    planScopeParts(plan, classes, naming);

  /**
   * A plan without a class has no grade and no subject, which is the state
   * this change exists to end. The roster fetch is best-effort, though, so an
   * offline teacher editing an existing plan must not be locked out of saving
   * a plan that already has one.
   */
  const canSave = Boolean(form.title.trim() && form.classGroupId);

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
                {(() => {
                  // Grade and subject now come from the class; a plan made
                  // before the anchor existed still shows the text it was
                  // given. planScopeParts decides which, never both.
                  const meta = [item.schoolName, classNameFor(item.classGroupId), ...scopeOf(item)]
                    .filter(Boolean)
                    .join(' · ');
                  return meta ? (
                    <Text style={[styles.cardMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                      {meta}
                    </Text>
                  ) : null;
                })()}
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
              {/* The class is the anchor, not a convenience: it is where the
                  plan's grade and subject come from, so there is no longer a
                  «بدون شعبة» option and no free-text grades box. A teacher
                  with no classes is sent to make one rather than being given
                  a plan that can hold nothing the app can read. */}
              {classes.length === 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, textAlign: align, lineHeight: 20 }}>
                    {t('planNeedsClass')}
                  </Text>
                  <Pressable
                    onPress={() => { setShowForm(false); router.push('/classes'); }}
                    style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: ACCENT }}
                  >
                    <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                      {t('createClass')}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, textAlign: align }}>
                    {t('planClass')}
                  </Text>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }}>
                    {classes.map(c => {
                      const active = form.classGroupId === c.id;
                      const label = lang === 'ar' && c.nameAr ? c.nameAr : c.name;
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => setForm(f => ({ ...f, classGroupId: c.id }))}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 18,
                            borderWidth: 1.5,
                            borderColor: active ? ACCENT : colors.border,
                            backgroundColor: active ? ACCENT + '16' : colors.card,
                          }}
                        >
                          <Text style={{ color: active ? ACCENT : colors.mutedForeground, fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular', fontSize: 13 }}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* Read-only, because it is not this screen's to edit — it
                      is whatever the chosen class says. Shown rather than
                      hidden so a teacher can see the plan picked up the
                      scope, and catch a wrong class here instead of later. */}
                  {form.classGroupId && scopeOf(form).length > 0 ? (
                    <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 12.5, textAlign: align, marginTop: 2 }}>
                      {`${t('planScope')}: ${scopeOf(form).join(' · ')}`}
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }}>
                        {`  (${t('planScopeFromClass')})`}
                      </Text>
                    </Text>
                  ) : null}
                  {/* A plan from before the anchor: show what its author
                      typed, so they can pick the class that matches it. The
                      stored text is left alone either way. */}
                  {!form.classGroupId && form.grades ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                      {t('planLegacyGrades', form.grades)}
                    </Text>
                  ) : null}
                </View>
              )}
              <TextInput
                value={form.topics}
                onChangeText={v => setForm(f => ({ ...f, topics: v }))}
                placeholder={t('planTopicsPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
              />
              <TextInput
                value={form.date}
                onChangeText={v => setForm(f => ({ ...f, date: v }))}
                placeholder={t('planDatePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                style={inputStyle}
              />
              <TextInput
                value={form.time}
                onChangeText={v => setForm(f => ({ ...f, time: v }))}
                placeholder={t('planTimePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                style={inputStyle}
              />
              <TextInput
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder={t('planNotesPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
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
                disabled={!canSave || saving}
                style={[styles.modalBtn, styles.modalPrimary, { backgroundColor: ACCENT, opacity: !canSave || saving ? 0.5 : 1 }]}
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
