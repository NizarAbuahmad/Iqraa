import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/Button';
import { GoogleSignInButton } from '@/components/ui/GoogleSignInButton';
import { Input } from '@/components/ui/Input';

const NAVY = '#081B3A';
const TEAL = '#00A99D';
const AQUA = '#34D6C6';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { login, loginWithGoogle } = useAuth();
  const { t, lang, isRTL, toggleLang } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Prefer real browser viewport on web (RN dimensions can lag behind device emulation)
  const [viewportW, setViewportW] = useState(width);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setViewportW(width);
      return;
    }
    const sync = () => setViewportW(window.innerWidth);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [width]);

  const isWide = viewportW >= 900;

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.message ?? (lang === 'ar' ? 'تعذّر تسجيل الدخول' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle(credential);
    } catch (e: any) {
      setError(e.message ?? (lang === 'ar' ? 'تعذّر تسجيل الدخول عبر Google' : 'Google sign-in failed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const brandPanel = (
    <LinearGradient
      colors={[NAVY, '#0B274F', '#0A3A4A']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[
        styles.brandPanel,
        isWide ? styles.brandPanelWide : styles.brandPanelNarrow,
        { paddingTop: isWide ? 48 : insets.top + 16 },
      ]}
    >
      {/* Soft atmospheric accents — not busy */}
      <View style={[styles.glow, styles.glowTeal]} />
      <View style={[styles.glow, styles.glowAqua]} />

      <Pressable
        onPress={() => { Haptics.selectionAsync(); toggleLang(); }}
        style={[
          styles.langBtn,
          {
            alignSelf: isRTL ? 'flex-start' : 'flex-end',
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderColor: 'rgba(255,255,255,0.16)',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={lang === 'ar' ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
      >
        <Ionicons name="language-outline" size={15} color="rgba(255,255,255,0.9)" />
        <Text style={[styles.langBtnText, { fontFamily: 'Cairo_500Medium' }]}>
          {lang === 'ar' ? 'English' : 'عربي'}
        </Text>
      </Pressable>

      <View style={[styles.brandContent, isWide && styles.brandContentWide]}>
        <Text style={[styles.eyebrow, { fontFamily: 'Cairo_500Medium', textAlign: 'center' }]}>
          {t('loginBrandEyebrow')}
        </Text>

        <BrandLogo
          variant="lockup"
          onDark
          style={[styles.logo, isWide ? styles.logoWide : styles.logoNarrow]}
          accessibilityLabel="IQRA"
        />

        <Text
          style={[
            styles.valueProp,
            {
              fontFamily: lang === 'ar' ? 'Cairo_500Medium' : 'Almarai_400Regular',
              textAlign: 'center',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        >
          {t('loginValueProp')}
        </Text>

        <View style={styles.brandRule} />
      </View>
    </LinearGradient>
  );

  const formPanel = (
    <KeyboardAvoidingView
      style={[styles.formPanel, isWide && styles.formPanelWide]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.formScroll,
          {
            paddingTop: isWide ? 56 : 28,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
            maxWidth: isWide ? 440 : 480,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formHeader}>
          <Text
            style={[
              styles.cardTitle,
              {
                color: colors.foreground,
                fontFamily: 'Cairo_700Bold',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            {t('welcomeBack')}
          </Text>
          <Text
            style={[
              styles.cardSubtitle,
              {
                color: colors.mutedForeground,
                fontFamily: 'Almarai_400Regular',
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            {t('signInSubtitle')}
          </Text>
        </View>

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.destructive + '14',
                borderColor: colors.destructive + '33',
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text
              style={[
                styles.errorText,
                {
                  color: colors.destructive,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <GoogleSignInButton onCredential={handleGoogleCredential} locale={lang} />
        {googleLoading ? (
          <Text style={[styles.googleLoadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {lang === 'ar' ? 'جارٍ تسجيل الدخول…' : 'Signing in…'}
          </Text>
        ) : null}

        <View style={[styles.dividerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('orDivider')}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Input
          label={t('emailAddress')}
          placeholder={t('emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          leftIcon="mail-outline"
          isRTL={isRTL}
        />

        <Input
          label={t('password')}
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="password"
          leftIcon="lock-closed-outline"
          rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
          onRightIconPress={() => setShowPassword(v => !v)}
          isRTL={isRTL}
        />

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          style={[styles.forgotRow, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}
        >
          <Text style={[styles.forgotText, { color: colors.primary, fontFamily: 'Cairo_500Medium' }]}>
            {t('forgotPassword')}
          </Text>
        </Pressable>

        <Button
          label={t('signIn')}
          onPress={handleLogin}
          loading={loading}
          disabled={!email || !password}
          size="lg"
          fullWidth
          style={styles.signInBtn}
        />

        <View style={[styles.registerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.registerPrompt, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('newToIqra')}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text style={[styles.registerLink, { color: colors.primary, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('createAccount')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, isWide && { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {brandPanel}
      {formPanel}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  brandPanel: {
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  brandPanelNarrow: {
    minHeight: 320,
  },
  brandPanelWide: {
    flex: 1.05,
    minWidth: 380,
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingBottom: 48,
  },
  brandContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  brandContentWide: {
    maxWidth: 420,
    alignSelf: 'center',
    gap: 18,
  },

  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.22,
  },
  glowTeal: {
    width: 220,
    height: 220,
    backgroundColor: TEAL,
    top: -60,
    right: -40,
  },
  glowAqua: {
    width: 180,
    height: 180,
    backgroundColor: AQUA,
    bottom: -50,
    left: -30,
    opacity: 0.14,
  },

  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 2,
  },
  langBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.92)' },

  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: AQUA,
    marginBottom: 2,
  },
  logo: { alignSelf: 'center' },
  logoNarrow: { width: 168, height: 168 },
  logoWide: { width: 260, height: 260 },
  valueProp: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.82)',
    maxWidth: 320,
    marginTop: 2,
  },
  brandRule: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: TEAL,
    marginTop: 6,
  },

  formPanel: { flex: 1, backgroundColor: '#F5F7FA' },
  formPanelWide: { flex: 1, justifyContent: 'center' },
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    gap: 14,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  formHeader: { gap: 6, marginBottom: 6 },
  cardTitle: { fontSize: 28, letterSpacing: -0.3 },
  cardSubtitle: { fontSize: 15, lineHeight: 22 },
  errorBanner: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13 },
  dividerRow: { alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },
  googleLoadingText: { fontSize: 12, textAlign: 'center', marginTop: -6 },
  forgotRow: { marginTop: -2, marginBottom: 4 },
  forgotText: { fontSize: 13 },
  signInBtn: { marginTop: 4 },
  registerRow: {
    justifyContent: 'center',
    gap: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  registerPrompt: { fontSize: 14 },
  registerLink: { fontSize: 14 },
});
