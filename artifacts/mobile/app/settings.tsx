import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);

  const isArabic = user?.language === 'ar';

  const toggleLanguage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateProfile({ language: isArabic ? 'en' : 'ar' });
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Language */}
        <SectionLabel label="LANGUAGE" colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="language-outline"
            label="Arabic / English"
            colors={colors}
            right={
              <Pressable
                onPress={toggleLanguage}
                style={[styles.langToggle, { backgroundColor: isArabic ? colors.primary : colors.muted, borderRadius: 20 }]}
              >
                <Text style={[{ color: isArabic ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12 }]}>
                  {isArabic ? 'عربي' : 'English'}
                </Text>
              </Pressable>
            }
          />
        </View>

        {/* Notifications */}
        <SectionLabel label="NOTIFICATIONS" colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="notifications-outline"
            label="In-app notifications"
            colors={colors}
            right={
              <Switch
                value={notifications}
                onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNotifications(v); }}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon="mail-outline"
            label="Email updates"
            colors={colors}
            right={
              <Switch
                value={emailUpdates}
                onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEmailUpdates(v); }}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            }
          />
        </View>

        {/* About */}
        <SectionLabel label="ABOUT" colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow icon="information-circle-outline" label="Version" colors={colors} right={<Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13 }]}>1.0.0</Text>} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="shield-checkmark-outline" label="Privacy Policy" colors={colors} onPress={() => {}} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow icon="document-text-outline" label="Terms of Service" colors={colors} onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ label, colors, top }: { label: string; colors: any; top?: boolean }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', marginTop: top ? 20 : 0 }]}>
      {label}
    </Text>
  );
}

function SettingRow({ icon, label, colors, right, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; colors: any; right?: React.ReactNode; onPress?: () => void }) {
  const inner = (
    <View style={styles.settingRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
      <View style={{ marginLeft: 'auto' }}>{right ?? <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />}</View>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>{inner}</Pressable>;
  return inner;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { marginBottom: 8, width: 40 },
  title: { fontSize: 28 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 8 },
  card: { borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  settingLabel: { fontSize: 15, flex: 1 },
  divider: { height: 1, marginHorizontal: 16 },
  langToggle: { paddingHorizontal: 14, paddingVertical: 7 },
});
