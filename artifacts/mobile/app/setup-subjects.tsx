/**
 * Where a teacher says what they teach — grades and subjects, picked from the
 * same catalog the curriculum browser and AI-tools pickers already use (see
 * `@workspace/curriculum`'s GRADES/SUBJECTS).
 *
 * Two ways in:
 *  - Mandatory, via the routing gate in `app/_layout.tsx` (`needsTeacherSetup`
 *    in routeGating.ts), for any teacher who has picked neither yet. No back
 *    button, no skip — same shape as `claim-required.tsx`'s gate, and for the
 *    same reason: `getVisibleGrades`/`getSubjectsForGrade` need something to
 *    default `app/(tabs)/curriculum.tsx` to.
 *  - Optional, from the profile screen's "Grades & Subjects" row, to change
 *    or add more later. `editMode` distinguishes the two: a back arrow instead
 *    of nothing, "Save" instead of "Continue", and `router.back()` instead of
 *    `router.replace('/(tabs)')` on success.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
}

function Chip({ label, selected, onPress, colors, accent }: {
  label: string; selected: boolean; onPress: () => void;
  colors: ReturnType<typeof useColors>; accent: string;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? accent : colors.muted,
          borderColor: selected ? accent : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.primaryForeground : colors.foreground, fontFamily: 'Cairo_500Medium' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SetupSubjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const { user, updateProfile } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editMode = mode === 'edit';

  const [gradeIds, setGradeIds] = useState<string[]>(user?.gradeIds ?? []);
  const [subjectIds, setSubjectIds] = useState<string[]>(user?.subjectIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = gradeIds.length > 0 && subjectIds.length > 0 && !saving;
  const align = isRTL ? 'right' : 'left';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await updateProfile({ gradeIds, subjectIds });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (editMode) router.back();
      else router.replace('/(tabs)');
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('teacherSetupFailed'));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (editMode ? 16 : 40), paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {editMode ? (
          <Pressable
            onPress={() => router.back()}
            style={[styles.back, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="school-outline" size={32} color={colors.primary} />
          </View>
        )}

        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {editMode ? t('editTeachingTitle') : t('teacherSetupTitle')}
        </Text>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('teacherSetupDesc')}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
          {t('teacherSetupGradesLabel')}
        </Text>
        <View style={[styles.chips, isRTL && { flexDirection: 'row-reverse' }]}>
          {getPickerGrades().map(g => (
            <Chip
              key={g.id}
              label={lang === 'ar' ? g.nameAr : g.name}
              selected={gradeIds.includes(g.id)}
              onPress={() => setGradeIds(prev => toggle(prev, g.id))}
              colors={colors}
              accent={colors.primary}
            />
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align, marginTop: 20 }]}>
          {t('teacherSetupSubjectsLabel')}
        </Text>
        <View style={[styles.chips, isRTL && { flexDirection: 'row-reverse' }]}>
          {getPickerSubjects().map(s => (
            <Chip
              key={s.id}
              label={lang === 'ar' ? s.nameAr : s.name}
              selected={subjectIds.includes(s.id)}
              onPress={() => setSubjectIds(prev => toggle(prev, s.id))}
              colors={colors}
              accent={s.color}
            />
          ))}
        </View>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
          </View>
        ) : null}

        {!canSubmit && !saving && (gradeIds.length > 0 || subjectIds.length > 0) ? (
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('teacherSetupPickAtLeastOne')}
          </Text>
        ) : null}

        <Button
          label={editMode ? t('teacherSetupSave') : t('teacherSetupContinue')}
          onPress={handleSubmit}
          loading={saving}
          disabled={!canSubmit}
          fullWidth
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { marginBottom: 12, width: 40 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, marginBottom: 8, lineHeight: 30 },
  desc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  sectionLabel: { fontSize: 14, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  hint: { fontSize: 12, marginTop: 10 },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 13 },
});
