/**
 * Where a parent or student says which class they are in, so the curriculum
 * shows only that. A student picks one; a parent picks one per child.
 *
 * Same two ways in as `/setup-subjects`:
 *  - Mandatory, via the routing gate in `app/_layout.tsx` (`needsGradeSetup`
 *    in routeGating.ts), once the roster claim is done. No back button.
 *  - Optional, from Settings, with `mode=edit`: a back arrow, "Save", and
 *    `goBack()` on success.
 *
 * Saves to `gradeIds` through the same PATCH /users/profile a teacher uses;
 * the server keeps a student to one (`limitGradesForRole`). The names this
 * account is linked to are shown with their grade, and those grades start
 * ticked — a parent sees which child they picked instead of guessing. First
 * time through, «اخترت اسمًا خاطئًا؟» undoes the claim (`DELETE /auth/claim`)
 * and the gate sends the account back to the code screen.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isStudentRole, useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { getPickerGrades } from '@/services/curriculumData';
import { goBack } from '@/services/navigation';
import { listMyRosterLinks, unclaimRoster } from '@/services/roster';
import { BackButton } from '@/components/ui/BackButton';

export default function SetupGradeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const { user, updateProfile, markRosterClaimed } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editMode = mode === 'edit';
  const isStudent = isStudentRole(user?.role);

  const grades = getPickerGrades();
  // Highest grade first, as /setup-subjects lists them; the picker's own order
  // is persisted state, so sort a copy.
  const ordered = [...grades].sort((x, y) => y.level - x.level);
  const [selected, setSelected] = useState<string[]>(() => user?.gradeIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<{ studentId: string; displayName: string; gradeId: string | null }[]>([]);
  const [unlinking, setUnlinking] = useState(false);

  // The roster already says which grade each linked name is in — show it, and
  // start there rather than on an empty choice.
  useEffect(() => {
    let cancelled = false;
    listMyRosterLinks()
      .then(rows => {
        if (cancelled) return;
        setLinks(rows);
        const known = [...new Set(rows.map(r => r.gradeId).filter((id): id is string => !!id && grades.some(g => g.id === id)))];
        if (known.length) setSelected(prev => (prev.length === 0 ? (isStudent ? known.slice(0, 1) : known) : prev));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent]);

  const handleWrongName = async () => {
    if (unlinking) return;
    setUnlinking(true);
    setError('');
    try {
      await unclaimRoster();
      markRosterClaimed(false);
    } catch {
      setError(t('gradeSetupUnlinkFailed'));
      setUnlinking(false);
    }
  };
  const gradeName = (id: string | null) => {
    const g = id ? grades.find(x => x.id === id) : undefined;
    return g ? (lang === 'ar' ? g.nameAr : g.name) : '';
  };

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected(prev => {
      if (isStudent) return [id];
      return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    });
  };

  const canSubmit = selected.length > 0 && !saving;
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile({ gradeIds: selected });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (editMode) goBack();
      else router.replace('/(tabs)');
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('gradeSetupFailed'));
      setSaving(false);
    }
  };

  const align = isRTL ? 'right' : 'left';
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (editMode ? 16 : 40), paddingBottom: insets.bottom + 32 }]}
      >
        {editMode ? (
          <BackButton color={colors.foreground} style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        ) : (
          <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="school-outline" size={32} color={colors.primary} />
          </View>
        )}

        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t(isStudent ? 'gradeSetupTitleStudent' : 'gradeSetupTitleParent')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(isStudent ? 'gradeSetupDescStudent' : 'gradeSetupDescParent')}
        </Text>

        {links.length > 0 ? (
          <View style={[styles.linked, { borderColor: colors.border, backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
              {t('gradeSetupLinked')}
            </Text>
            {links.map(l => (
              <Text key={l.studentId} style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 15, textAlign: align }}>
                {l.displayName}{gradeName(l.gradeId) ? ` · ${gradeName(l.gradeId)}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={[styles.chips, isRTL && { flexDirection: 'row-reverse' }]}>
          {ordered.map(g => {
            const on = selected.includes(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => toggle(g.id)}
                accessibilityRole={isStudent ? 'radio' : 'checkbox'}
                aria-checked={on}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.muted, borderColor: on ? colors.primary : colors.border }]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.chipText, { color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}
                >
                  {lang === 'ar' ? g.nameAr : g.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={editMode ? t('teacherSetupSave') : t('gradeSetupContinue')}
          onPress={handleSubmit}
          loading={saving}
          disabled={!canSubmit}
          fullWidth
          style={{ marginTop: 24 }}
        />

        {!editMode && links.length > 0 ? (
          <Pressable onPress={handleWrongName} disabled={unlinking} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 20, opacity: unlinking ? 0.5 : 1 }}>
            <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>
              {t('gradeSetupWrongName')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { marginBottom: 12, width: 40 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, marginBottom: 8, lineHeight: 30 },
  desc: { fontSize: 15, lineHeight: 24, marginBottom: 20 },
  linked: { borderWidth: 1, padding: 12, gap: 4, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 15, lineHeight: 24 },
});
