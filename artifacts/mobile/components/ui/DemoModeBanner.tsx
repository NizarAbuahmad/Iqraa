import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEMO_MODE } from '@/services/ai/demoMode';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  /** Use on dark colored headers (teal/purple). */
  onDark?: boolean;
  isRTL?: boolean;
};

/** Quiet Demo Mode label — secondary to the IQRA brand in headers. */
export function DemoModeBanner({ onDark = false, isRTL }: Props) {
  const { t, isRTL: ctxRtl } = useLanguage();
  const rtl = isRTL ?? ctxRtl;

  if (!DEMO_MODE) return null;

  const iconColor = onDark ? 'rgba(255,255,255,0.55)' : '#8BA0B8';
  const textColor = onDark ? 'rgba(255,255,255,0.55)' : '#8BA0B8';

  return (
    <View
      style={[
        styles.wrap,
        onDark ? styles.wrapDark : styles.wrapLight,
        { flexDirection: rtl ? 'row-reverse' : 'row', alignSelf: rtl ? 'flex-end' : 'flex-start' },
      ]}
    >
      <Ionicons name="flask-outline" size={11} color={iconColor} />
      <Text
        style={[
          styles.text,
          { color: textColor, fontFamily: 'Almarai_400Regular', textAlign: rtl ? 'right' : 'left' },
        ]}
      >
        {t('demoModeBadge')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 2,
  },
  wrapDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  wrapLight: {
    backgroundColor: 'rgba(139,160,184,0.12)',
  },
  text: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});