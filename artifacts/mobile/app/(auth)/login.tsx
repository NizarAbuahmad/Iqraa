import React, { useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { t, lang, isRTL, toggleLang } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Language toggle */}
        <Pressable
          onPress={() => { Haptics.selectionAsync(); toggleLang(); }}
          style={[styles.langBtn, { alignSelf: isRTL ? 'flex-start' : 'flex-end', backgroundColor: colors.muted, borderRadius: 16 }]}
        >
          <Ionicons name="language" size={16} color={colors.mutedForeground} />
          <Text style={[styles.langBtnText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
            {lang === 'ar' ? 'English' : 'عربي'}
          </Text>
        </Pressable>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
            {t('appName')}
          </Text>
          <Text style={[styles.appTagline, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {t('appTagline')}
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius * 1.5 }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('welcomeBack')}
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('signInSubtitle')}
          </Text>

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '18', borderRadius: 10 }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Inter_400Regular' }]}>{error}</Text>
            </View>
          ) : null}

          <Input
            label={t('emailAddress')}
            placeholder={t('emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            isRTL={isRTL}
          />

          <Input
            label={t('password')}
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(v => !v)}
            isRTL={isRTL}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            style={[styles.forgotRow, isRTL ? { alignItems: 'flex-start' } : { alignItems: 'flex-end' }]}
          >
            <Text style={[styles.forgotText, { color: colors.primary, fontFamily: 'Inter_500Medium' }]}>
              {t('forgotPassword')}
            </Text>
          </Pressable>

          <Button
            label={t('signIn')}
            onPress={handleLogin}
            loading={loading}
            disabled={!email || !password}
          />
        </View>

        {/* Register */}
        <View style={styles.registerRow}>
          <Text style={[styles.registerPrompt, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {t('newToIqra')}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.registerLink, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
              {t('createAccount')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, gap: 16 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  langBtnText: { fontSize: 13 },
  logoWrap: { alignItems: 'center', paddingVertical: 16, gap: 6 },
  logo: { width: 80, height: 80, borderRadius: 18 },
  appName: { fontSize: 28 },
  appTagline: { fontSize: 13 },
  card: { padding: 24, borderWidth: 1, gap: 16 },
  cardTitle: { fontSize: 22 },
  cardSubtitle: { fontSize: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  errorText: { flex: 1, fontSize: 13 },
  forgotRow: { marginTop: -4 },
  forgotText: { fontSize: 13 },
  registerRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, alignItems: 'center' },
  registerPrompt: { fontSize: 14 },
  registerLink: { fontSize: 14 },
});
