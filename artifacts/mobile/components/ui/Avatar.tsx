/**
 * Initials-only avatar, for showing *other* people.
 *
 * Profile pictures exist as of 2026-09-12, but only for the signed-in user's
 * own account (`app/(tabs)/profile.tsx`, which draws its own header avatar
 * rather than using this). Nothing that renders someone else — a thread
 * header, a message bubble, a participant list — is served their picture yet:
 * every one of the six participant selects in `routes/messaging.ts` would
 * have to carry `avatarKey` and presign it per row. So initials remain the
 * whole of "who is this" here, and adding an `imageUrl` prop before that
 * server work exists would be a prop with nothing to pass it.
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
