import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TranslationKey } from '@/services/i18n';

const TOOL_TITLE_KEYS: Record<string, TranslationKey> = {
  homework: 'toolHomeworkTitle',
  exam: 'toolExamTitle',
};

export default function ComingSoonScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { tool } = useLocalSearchParams<{ tool?: string }>();

  const toolTitleKey = tool ? TOOL_TITLE_KEYS[tool] : undefined;
  const toolTitle = toolTitleKey ? t(toolTitleKey) : t('aiTools');

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {toolTitle}
        </Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15', borderRadius: 40 }]}>
          <Ionicons name="construct-outline" size={56} color={colors.primary} />
        </View>

        <Text style={[styles.heading, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: 'center' }]}>
          {t('comingSoon')}
        </Text>

        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
          {t('comingSoonDesc')}
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtnLarge, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={[styles.backBtnText, { color: colors.primaryForeground, fontFamily: 'Cairo_600SemiBold' }]}>
            {t('comingSoonBack')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { marginBottom: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  iconWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heading: { fontSize: 28 },
  desc: { fontSize: 15, lineHeight: 23, maxWidth: 280 },
  backBtnLarge: { marginTop: 16, paddingHorizontal: 28, paddingVertical: 14 },
  backBtnText: { fontSize: 15 },
});
