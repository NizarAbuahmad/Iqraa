/**
 * Lets a signed-in student/parent account link to one more roster row — a
 * second child, a second parent for the same child, or a second teacher's
 * class. `POST /auth/register` only ever runs this once, at signup; this
 * screen is the same code + roster-name-picker flow from register.tsx,
 * against `POST /auth/claim` instead, for an account that already exists.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import {
  RosterError,
  claimRosterCode,
  lookupJoinCode,
  type JoinRosterEntry,
} from '@/services/roster';

export default function JoinClassScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();

  const [code, setCode] = useState('');
  /** The class behind a whole-class code, or null when the code names its own student (or is simply wrong). */
  const [roster, setRoster] = useState<JoinRosterEntry[] | null>(null);
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  const align = isRTL ? 'right' : 'left';

  // Same trigger as register.tsx: a fixed six-character code, so length is the
  // whole condition. A 404 is the normal answer for a per-student code, which
  // needs no picker, so it clears the roster instead of surfacing an error.
  useEffect(() => {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setRoster(null);
      setClassName('');
      setStudentId('');
      return;
    }
    let live = true;
    void lookupJoinCode(trimmed)
      .then(res => {
        if (!live) return;
        setRoster(res.students);
        setClassName(res.class.name);
        setStudentId('');
      })
      .catch(() => {
        if (!live) return;
        setRoster(null);
        setClassName('');
        setStudentId('');
      });
    return () => {
      live = false;
    };
  }, [code]);

  const canSubmit =
    code.trim().length >= 6 && (!roster || roster.length === 0 || studentId !== '') && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoined(true);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof RosterError ? err.message : t('joinAnotherClassFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (joined) {
    return (
      <View style={[styles.successWrap, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <View style={[styles.successIcon, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: 'center' }]}>
          {t('joinAnotherClassSuccess')}
        </Text>
        <Button label={t('joinAnotherClassDone')} onPress={() => router.back()} fullWidth style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {t('joinAnotherClass')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('joinAnotherClassDesc')}
        </Text>

        <Input
          label={t('classCode')}
          placeholder={t('classCodePlaceholder')}
          hint={t('classCodeHint')}
          value={code}
          onChangeText={text => setCode(text.toUpperCase())}
          leftIcon="key-outline"
          autoCapitalize="characters"
          isRTL={isRTL}
        />

        {roster && roster.length > 0 ? (
          <View style={{ gap: 8, marginTop: 16 }}>
            <Text style={[styles.pickLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
              {className ? t('joinPickYourNameFor', className) : t('joinPickYourName')}
            </Text>
            <View style={[styles.nameChips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {roster.map(entry => {
                const blocked = entry.taken && user?.role === 'student';
                const picked = entry.id === studentId;
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => { if (!blocked) setStudentId(entry.id); }}
                    disabled={blocked}
                    style={[
                      styles.nameChip,
                      {
                        borderColor: picked ? colors.primary : colors.border,
                        backgroundColor: picked ? colors.primary + '18' : 'transparent',
                        opacity: blocked ? 0.45 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: picked ? colors.primary : colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                      {entry.displayName}
                    </Text>
                    {entry.taken ? (
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 10 }}>
                        {t('joinNameTaken')}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <Button
          label={t('joinAnotherClassSubmit')}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          fullWidth
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  title: { fontSize: 22 },
  desc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  pickLabel: { fontSize: 13 },
  nameChips: { flexWrap: 'wrap', gap: 8 },
  nameChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  errorBanner: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 16 },
  errorText: { flex: 1, fontSize: 13 },
  successWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 32 },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 19, lineHeight: 27 },
});
