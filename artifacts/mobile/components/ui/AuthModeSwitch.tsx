import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Full-width two-segment switch shown at the top of both auth screens so a
 * first-time visitor sees "sign in" and "create account" as equally weighted
 * choices, instead of discovering sign-up as a small link at the bottom of a
 * screen titled "Welcome back".
 */
export function AuthModeSwitch({ mode }: { mode: 'login' | 'register' }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();

  const goTo = (target: 'login' | 'register') => {
    if (target === mode) return;
    Haptics.selectionAsync();
    router.replace(target === 'login' ? '/(auth)/login' : '/(auth)/register');
  };

  const segments: { key: 'login' | 'register'; label: string }[] = [
    { key: 'login', label: t('signIn') },
    { key: 'register', label: t('createAccount') },
  ];

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius * 1.5,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      {segments.map(s => {
        const active = s.key === mode;
        return (
          <Pressable
            key={s.key}
            onPress={() => goTo(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              {
                backgroundColor: active ? colors.primary : 'transparent',
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: active ? '#fff' : colors.mutedForeground,
                  fontFamily: active ? 'Cairo_600SemiBold' : 'Cairo_500Medium',
                },
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 14 },
});
