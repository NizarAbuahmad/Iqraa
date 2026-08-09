import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { setCoachDismissed } from '@/services/lessonContext';

function InfoRow({ icon, label, value, color, isRTL }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string; isRTL: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={[styles.infoIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function SettingRow({ icon, label, onPress, destructive, isRTL, colors }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
  destructive?: boolean; isRTL: boolean; colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Ionicons name={icon} size={20} color={destructive ? colors.destructive : colors.primary} />
      <Text style={[styles.settingLabel, { color: destructive ? colors.destructive : colors.foreground, fontFamily: 'Inter_500Medium', flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      {!destructive && <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user, logout } = useAuth();

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const initials = user
    ? [user.firstName?.[0], user.lastName?.[0]]
        .filter(Boolean)
        .map(c => c!.toUpperCase())
        .join('') || 'T'
    : 'T';

  const roleLabel =
    user?.role === 'teacher'
      ? t('roleTeacher')
      : user?.role === 'school_admin'
        ? t('roleAdmin')
        : t('roleSysAdmin');

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(isRTL ? 'ar-JO' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const performLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logout();
    router.replace('/(auth)/login');
  };

  const handleLogout = () => {
    // RN Alert.alert action buttons are unreliable on web — use window.confirm there.
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm(`${t('signOut')}\n\n${t('signOutConfirm')}`);
      if (ok) void performLogout();
      return;
    }

    Alert.alert(t('signOut'), t('signOutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: () => { void performLogout(); },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.headerBg, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={[styles.initials, { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' }]}>
              {initials}
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' }]}>
            {user ? `${user.firstName} ${user.lastName}` : t('roleTeacher')}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={[styles.roleText, { color: colors.primaryForeground, fontFamily: 'Inter_500Medium' }]}>
              {roleLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        {/* Info card */}
        <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('profileInfo')}
        </Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <InfoRow icon="mail-outline" label={t('email')} value={user?.email ?? ''} color={colors.primary} isRTL={isRTL} />
          {memberSince ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow icon="calendar-outline" label={t('memberSince')} value={memberSince} color={colors.info} isRTL={isRTL} />
            </>
          ) : null}
          {user?.phone ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow icon="call-outline" label={t('phone')} value={user.phone} color={colors.info} isRTL={isRTL} />
            </>
          ) : null}
          {user?.school ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow icon="business-outline" label={t('school')} value={user.school} color={colors.accent} isRTL={isRTL} />
            </>
          ) : null}
        </View>

        {/* Subjects & Grades — only show if populated */}
        {((user?.subjects?.length ?? 0) > 0 || (user?.grades?.length ?? 0) > 0) ? (
          <>
            <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginTop: 20, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('teaching')}
            </Text>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {(user?.subjects?.length ?? 0) > 0 ? (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('mySubjects')}</Text>
                  <View style={[styles.tags, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {user?.subjects?.map(s => (
                      <View key={s} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.tagText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {(user?.grades?.length ?? 0) > 0 ? (
                <View style={styles.tagSection}>
                  <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('myGrades')}</Text>
                  <View style={[styles.tags, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    {user?.grades?.map(g => (
                      <View key={g} style={[styles.tag, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.tagText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>{g}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Settings */}
        <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginTop: 20, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('settingsSection')}
        </Text>
        <View style={{ gap: 8 }}>
          <SettingRow icon="folder-outline" label={t('myWorkspace')} onPress={() => router.push('/workspace')} isRTL={isRTL} colors={colors} />
          <SettingRow icon="people-outline" label={t('myClasses')} onPress={() => router.push('/classes')} isRTL={isRTL} colors={colors} />
          <SettingRow icon="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} isRTL={isRTL} colors={colors} />
          {/* Bring the home "start here" card back — dismissing it should never
              be a one-way door for a teacher who wants the reminder again. */}
          <SettingRow
            icon="help-circle-outline"
            label={t('coachReopen')}
            onPress={() => {
              void setCoachDismissed(false).then(() => router.push('/(tabs)'));
            }}
            isRTL={isRTL}
            colors={colors}
          />
          <SettingRow icon="log-out-outline" label={t('signOut')} onPress={handleLogout} destructive isRTL={isRTL} colors={colors} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerBg: { paddingBottom: 32, alignItems: 'center' },
  avatarWrap: { alignItems: 'center', gap: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  initials: { fontSize: 34 },
  userName: { fontSize: 22 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 2 },
  roleText: { fontSize: 12 },
  section: { fontSize: 11, letterSpacing: 0.8, marginBottom: 8 },
  infoCard: { borderWidth: 1, overflow: 'hidden' },
  infoRow: { alignItems: 'center', padding: 14, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, marginBottom: 2, fontFamily: 'Inter_400Regular' },
  infoValue: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  divider: { height: 1, marginHorizontal: 14 },
  tagSection: { padding: 14, gap: 8 },
  tagLabel: { fontSize: 13 },
  tags: { flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12 },
  settingRow: { alignItems: 'center', padding: 16, gap: 12, borderWidth: 1 },
  settingLabel: { fontSize: 15 },
});
