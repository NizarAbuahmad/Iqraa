import React, { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message ?? 'Login failed. Please try again.');
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
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Brand */}
        <View style={styles.brand}>
          <View style={[styles.logoWrap, { backgroundColor: colors.primary, borderRadius: colors.radius * 2 }]}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>Iqra</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            AI Teaching Assistant
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderRadius: colors.radius * 1.5, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
            Welcome back
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Sign in to your teacher account
          </Text>

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '44', borderRadius: colors.radius }]}>
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Inter_400Regular' }]}>{error}</Text>
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
            autoComplete="email"
          />
          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(v => !v)}
            secureTextEntry={!showPassword}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotWrap}
          >
            <Text style={[styles.forgot, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
              Forgot password?
            </Text>
          </Pressable>

          <Button label="Sign In" onPress={handleLogin} loading={loading} fullWidth />
        </View>

        {/* Sign up */}
        <View style={styles.signupRow}>
          <Text style={[styles.signupText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            New to Iqra?{'  '}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.signupLink, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
              Create account
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logoWrap: { width: 72, height: 72, marginBottom: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 64, height: 64 },
  appName: { fontSize: 32, letterSpacing: -0.5, marginBottom: 4 },
  tagline: { fontSize: 14 },
  card: { padding: 24, borderWidth: 1, marginBottom: 24 },
  heading: { fontSize: 22, marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 20 },
  errorBanner: { padding: 12, borderWidth: 1, marginBottom: 16 },
  errorText: { fontSize: 13 },
  forgotWrap: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgot: { fontSize: 13 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupText: { fontSize: 14 },
  signupLink: { fontSize: 14 },
});
