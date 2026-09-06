import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang, toggleLang } = useLanguage();
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);

  const handleToggleLanguage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleLang();
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('settingsTitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Language */}
        <SectionLabel label={t('languageSection')} isRTL={isRTL} colors={colors} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="language-outline"
            label={t('arabicEnglish')}
            isRTL={isRTL}
            colors={colors}
            right={
              <Pressable
                onPress={handleToggleLanguage}
                style={[styles.langToggle, { backgroundColor: lang === 'ar' ? colors.primary : colors.muted, borderRadius: 20 }]}
              >
                <Text style={[{ color: lang === 'ar' ? colors.primaryForeground : colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 12 }]}>
                  {lang === 'ar' ? 'عربي' : 'English'}
                </Text>
              </Pressable>
            }
          />
        </View>

        {/* Notifications */}
        <SectionLabel label={t('notificationsSection')} isRTL={isRTL} colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="notifications-outline"
            label={t('inAppNotifications')}
            isRTL={isRTL}
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
            label={t('emailUpdates')}
            isRTL={isRTL}
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
        <SectionLabel label={t('aboutSection')} isRTL={isRTL} colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="information-circle-outline"
            label={t('version')}
            isRTL={isRTL}
            colors={colors}
            right={<Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13 }]}>1.0.0</Text>}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon="shield-checkmark-outline"
            label={t('privacyPolicy')}
            isRTL={isRTL}
            colors={colors}
            onPress={() => router.push('/legal/privacy' as any)}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingRow
            icon="document-text-outline"
            label={t('termsOfService')}
            isRTL={isRTL}
            colors={colors}
            onPress={() => router.push('/legal/terms' as any)}
          />
        </View>

        {/* Account. Deleting is the only row here, and it is deliberately last
            and on its own card — both stores require the path to exist, and
            nothing else in Settings is irreversible. */}
        <SectionLabel label={t('accountSection')} isRTL={isRTL} colors={colors} top />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <SettingRow
            icon="trash-outline"
            label={t('deleteAccount')}
            isRTL={isRTL}
            colors={colors}
            destructive
            onPress={() => router.push('/delete-account' as any)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ label, isRTL, colors, top }: { label: string; isRTL: boolean; colors: ReturnType<typeof useColors>; top?: boolean }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', marginTop: top ? 20 : 0, textAlign: isRTL ? 'right' : 'left' }]}>
      {label}
    </Text>
  );
}

function SettingRow({ icon, label, colors, isRTL, right, onPress, destructive }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  colors: ReturnType<typeof useColors>; isRTL: boolean;
  right?: React.ReactNode; onPress?: () => void;
  /** Tints the row red. Only the irreversible one should set it. */
  destructive?: boolean;
}) {
  const tint = destructive ? colors.destructive : colors.primary;
  const inner = (
    <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.settingLabel, { color: destructive ? colors.destructive : colors.foreground, fontFamily: 'Cairo_500Medium', flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <View style={{ marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
        {right ?? <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />}
      </View>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>{inner}</Pressable>;
  return inner;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { marginBottom: 8, width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 28 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginBottom: 8 },
  card: { borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  settingRow: { alignItems: 'center', padding: 16, gap: 12 },
  settingLabel: { fontSize: 15 },
  divider: { height: 1, marginHorizontal: 16 },
  langToggle: { paddingHorizontal: 14, paddingVertical: 7 },
});
