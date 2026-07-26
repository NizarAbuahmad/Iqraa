import React, { useState } from 'react';
import {
  Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

function InfoRow({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: '#7A8E8C' }]}>{label}</Text>
        <Text style={[styles.infoValue]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function SettingRow({ icon, label, onPress, destructive, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={destructive ? colors.destructive : colors.primary} />
      <Text style={[styles.settingLabel, { color: destructive ? colors.destructive : colors.foreground, fontFamily: 'Inter_500Medium' }]}>
        {label}
      </Text>
      {!destructive && <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} style={{ marginLeft: 'auto' }} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const initials = user?.name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') ?? 'T';

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace('/(auth)/login');
        }
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
            {user?.name ?? 'Teacher'}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={[styles.roleText, { color: colors.primaryForeground, fontFamily: 'Inter_500Medium' }]}>
              {user?.role === 'teacher' ? 'Teacher' : user?.role === 'school_admin' ? 'School Admin' : 'System Admin'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        {/* Info card */}
        <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>PROFILE INFO</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? ''} color={colors.primary} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow icon="call-outline" label="Phone" value={user?.phone ?? ''} color={colors.info} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <InfoRow icon="business-outline" label="School" value={user?.school ?? ''} color={colors.accent} />
        </View>

        {/* Subjects & Grades */}
        <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginTop: 20 }]}>TEACHING</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={styles.tagSection}>
            <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>Subjects</Text>
            {(user?.subjects?.length ?? 0) === 0 ? (
              <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }]}>Not set</Text>
            ) : (
              <View style={styles.tags}>
                {user?.subjects?.map(s => (
                  <View key={s} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.tagText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.tagSection}>
            <Text style={[styles.tagLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>Grades</Text>
            {(user?.grades?.length ?? 0) === 0 ? (
              <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }]}>Not set</Text>
            ) : (
              <View style={styles.tags}>
                {user?.grades?.map(g => (
                  <View key={g} style={[styles.tag, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.tagText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Settings */}
        <Text style={[styles.section, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginTop: 20 }]}>SETTINGS</Text>
        <View style={{ gap: 8 }}>
          <SettingRow icon="person-outline" label="Edit Profile" onPress={() => {}} colors={colors} />
          <SettingRow icon="lock-closed-outline" label="Change Password" onPress={() => {}} colors={colors} />
          <SettingRow icon="language-outline" label="Language / اللغة" onPress={() => {}} colors={colors} />
          <SettingRow icon="moon-outline" label="Theme" onPress={() => {}} colors={colors} />
          <SettingRow icon="help-circle-outline" label="Help & Support" onPress={() => {}} colors={colors} />
          <SettingRow icon="log-out-outline" label="Sign Out" onPress={handleLogout} destructive colors={colors} />
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
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#1A2B2A' },
  divider: { height: 1, marginHorizontal: 14 },
  tagSection: { padding: 14, gap: 8 },
  tagLabel: { fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderWidth: 1 },
  settingLabel: { fontSize: 15 },
});
