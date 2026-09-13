import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Colors {
  primary: string;
  primaryForeground: string;
  card: string;
  border: string;
  mutedForeground: string;
  radius: number;
}

interface Props {
  mode: 'login' | 'register';
  loginLabel: string;
  registerLabel: string;
  onSwitch: (mode: 'login' | 'register') => void;
  colors: Colors;
  isRTL: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Persistent login/signup toggle, pinned at the top of both auth screens.
 * Replaces the old pattern of a plain-text link buried below the form —
 * users couldn't tell which screen they were on without reading the small
 * print, and switching meant scrolling past the whole form first.
 */
export function AuthModeSwitch({ mode, loginLabel, registerLabel, onSwitch, colors, isRTL, style }: Props) {
  const segments: { key: 'login' | 'register'; label: string }[] = [
    { key: 'login', label: loginLabel },
    { key: 'register', label: registerLabel },
  ];

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
        style,
      ]}
    >
      {segments.map(s => {
        const active = s.key === mode;
        return (
          <Pressable
            key={s.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onSwitch(s.key);
            }}
            style={[
              styles.segment,
              { borderRadius: colors.radius - 2, backgroundColor: active ? colors.primary : 'transparent' },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? colors.primaryForeground : colors.mutedForeground,
                  fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
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
  track: { padding: 4, borderWidth: 1, marginBottom: 20 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  label: { fontSize: 14 },
});
