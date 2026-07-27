import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  hint?: string;
  isRTL?: boolean;
}

export function Input({
  label, error, leftIcon, rightIcon, onRightIconPress,
  hint, style, isRTL = false, ...props
}: InputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.destructive : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputRow,
          {
            borderColor,
            borderRadius: colors.radius,
            backgroundColor: focused ? colors.card : colors.input,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={18}
            color={colors.mutedForeground}
            style={isRTL ? styles.rightIcon : styles.leftIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: 'Inter_400Regular',
              flex: 1,
              textAlign: isRTL ? 'right' : 'left',
            },
            style,
          ]}
          placeholderTextColor={colors.mutedForeground}
          writingDirection={isRTL ? 'rtl' : 'ltr'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && (
          <Pressable onPress={onRightIconPress} style={isRTL ? styles.leftIconBtn : styles.rightIconBtn}>
            <Ionicons name={rightIcon} size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 6, letterSpacing: 0.2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  input: { fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  leftIcon: { marginLeft: 12 },
  rightIcon: { marginRight: 12 },
  rightIconBtn: { paddingRight: 12, padding: 4 },
  leftIconBtn: { paddingLeft: 12, padding: 4 },
  error: { fontSize: 12, marginTop: 4 },
  hint: { fontSize: 12, marginTop: 4 },
});
