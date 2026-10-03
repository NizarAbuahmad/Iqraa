/**
 * One account in a list of accounts signed in on this device.
 *
 * Shared by Settings (where it switches), the login screen (where it signs back
 * in without a password) and the claim screen, so the same person looks the same
 * in all three.
 *
 * The remove control is a sibling of the pressable body, never a child of it.
 * On web a Pressable is a <button>, and a <button> inside a <button> is invalid
 * HTML: React logs a hydration error, and a click on the inner one can reach the
 * outer one's handler — which here would switch accounts instead of removing one.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';

interface Props {
  name: string;
  email: string;
  roleLabel: string;
  /** «آخر استخدام» — the account that was open most recently. */
  badge?: string;
  /** The account that is open right now; shows a tick and is not pressable. */
  current?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
}

export function AccountRow({
  name, email, roleLabel, badge, current, busy, disabled, onPress, onRemove, removeLabel, colors, isRTL,
}: Props) {
  const initial = (name.trim()[0] ?? email.trim()[0] ?? '?').toUpperCase();
  const align = isRTL ? 'right' : 'left';
  const direction = isRTL ? 'row-reverse' : 'row';

  const body = (
    <View style={[styles.body, { flexDirection: direction }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary + '1F' }]}>
        <Text style={{ color: colors.primary, fontFamily: 'Cairo_700Bold', fontSize: 16 }}>{initial}</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: align }}>
          {name}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
          {email}
        </Text>
        <View style={[styles.chips, { flexDirection: direction }]}>
          <View style={[styles.chip, { backgroundColor: colors.muted }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>{roleLabel}</Text>
          </View>
          {badge ? (
            <View style={[styles.chip, { backgroundColor: colors.primary + '1F' }]}>
              <Text style={{ color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 11 }}>{badge}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : current ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
      ) : null}
    </View>
  );

  const main =
    onPress && !current ? (
      <Pressable
        onPress={onPress}
        disabled={disabled || busy}
        accessibilityRole="button"
        style={({ pressed }) => [{ flex: 1, opacity: pressed || disabled ? 0.7 : 1 }]}
      >
        {body}
      </Pressable>
    ) : (
      <View style={{ flex: 1 }}>{body}</View>
    );

  return (
    <View style={[styles.row, { flexDirection: direction }]}>
      {main}
      {onRemove && !busy ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={removeLabel}
          style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="close-circle-outline" size={22} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center' },
  body: { alignItems: 'center', padding: 14, gap: 12 },
  remove: { padding: 2, marginHorizontal: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 6, marginTop: 4, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
});
