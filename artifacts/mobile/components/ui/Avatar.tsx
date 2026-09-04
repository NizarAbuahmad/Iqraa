/**
 * Initials-only avatar — no photo upload exists anywhere in this app to hang
 * a picture on, so this is the whole of "who is this" for now.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Colors {
  secondary: string;
  primary: string;
}

interface Props {
  firstName: string;
  lastName?: string;
  size?: number;
  colors: Colors;
}

export function Avatar({ firstName, lastName, size = 40, colors }: Props) {
  const initials = `${firstName.trim().charAt(0)}${(lastName ?? '').trim().charAt(0)}`.toUpperCase() || '?';

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4, color: colors.primary, fontFamily: 'Cairo_600SemiBold' }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text: {},
});
