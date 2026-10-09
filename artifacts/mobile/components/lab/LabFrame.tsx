/**
 * The Science Lab's page frame: the library's teal header band, a back button,
 * and a centred, width-capped scroll area. Shared by the shelf and present mode
 * so the two screens cannot drift apart in layout.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { goBack } from '@/services/navigation';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function LabFrame({ title, subtitle, children }: Props) {
  const colors = useColors();
  const { isRTL, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => goBack()}
          hitSlop={10}
          style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{subtitle}</Text>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 48,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 22 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
});
