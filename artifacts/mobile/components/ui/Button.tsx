import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', disabled, loading, style, fullWidth }: ButtonProps) {
  const colors = useColors();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const bgColor = {
    primary: colors.primary,
    secondary: colors.secondary,
    ghost: 'transparent',
    destructive: colors.destructive,
  }[variant];

  const textColor = {
    primary: colors.primaryForeground,
    secondary: colors.secondaryForeground,
    ghost: colors.foreground,
    destructive: colors.destructiveForeground,
  }[variant];

  const borderColor = {
    primary: 'transparent',
    secondary: colors.border,
    ghost: 'transparent',
    destructive: 'transparent',
  }[variant];

  const paddingH = { sm: 12, md: 20, lg: 28 }[size];
  const paddingV = { sm: 8, md: 13, lg: 16 }[size];
  const fontSize = { sm: 13, md: 15, lg: 17 }[size];

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: variant === 'secondary' ? 1 : 0,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
          borderRadius: colors.radius,
          opacity: pressed ? 0.75 : disabled || loading ? 0.5 : 1,
          ...(fullWidth ? { width: '100%' } : {}),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize, fontFamily: 'Cairo_600SemiBold' }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 44,
  },
  label: {
    letterSpacing: 0.1,
  },
});
