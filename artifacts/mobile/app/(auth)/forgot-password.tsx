import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>

        <View style={[styles.iconWrap, { backgroundColor: colors.secondary, borderRadius: 40 }]}>
          <Ionicons name="key-outline" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.heading, { color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}>
          Reset your password
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          Enter your email address and we'll send you a reset link.
        </Text>

        {sent ? (
          <View style={[styles.successBox, { backgroundColor: colors.success + '18', borderColor: colors.success + '44', borderRadius: colors.radius }]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success, fontFamily: 'Cairo_500Medium' }]}>
              Reset link sent! Check your inbox.
            </Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius }]}>
                <Text style={[{ color: colors.destructive, fontSize: 13, fontFamily: 'Almarai_400Regular' }]}>{error}</Text>
              </View>
            ) : null}
            <Input
              label="Email address"
              placeholder="you@school.edu.jo"
              value={email}
              onChangeText={setEmail}
              leftIcon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button label="Send Reset Link" onPress={handleSend} loading={loading} fullWidth />
          </>
        )}

        <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.backToLogin}>
          <Text style={[styles.backToLoginText, { color: colors.primary, fontFamily: 'Cairo_500Medium' }]}>
            ← Back to sign in
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  back: { marginBottom: 24, width: 40 },
  iconWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heading: { fontSize: 24, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 21, marginBottom: 28 },
  errorBanner: { padding: 12, borderWidth: 1, marginBottom: 16 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderWidth: 1, marginBottom: 20 },
  successText: { fontSize: 14, flex: 1 },
  backToLogin: { marginTop: 24, alignSelf: 'center' },
  backToLoginText: { fontSize: 14 },
});
