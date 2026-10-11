/**
 * Sign in with the personal login code — for a parent or student who signed up
 * from a teacher's code and so has no email or password.
 *
 * This is the way back in on a new phone or after logging out. The teacher's
 * own code does not work here (it is shared, and expires); the 12-character code
 * the app showed once at sign-up does. If a sign-up was interrupted before the
 * person confirmed they had saved it, that code is still parked on the device
 * (services/pendingLoginCode.ts) and is filled in for them.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { AuthBrandPanel, useAuthLayout } from '@/components/ui/AuthBrandPanel';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { formatLoginCode, isCompleteLoginCode } from '@/services/loginCode';
import { readPendingLoginCode } from '@/services/pendingLoginCode';
import { SPACE, TYPE } from '@/constants/theme';

export default function LoginCodeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithCode } = useAuth();
  const { t, isRTL } = useLanguage();
  const { isWide } = useAuthLayout();

  const [code, setCode] = useState('');
  const [foundPending, setFoundPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void readPendingLoginCode().then(pending => {
      if (!live || !pending) return;
      setCode(formatLoginCode(pending));
      setFoundPending(true);
    });
    return () => { live = false; };
  }, []);

  const align = isRTL ? 'right' : 'left';

  const handleSubmit = async () => {
    if (!isCompleteLoginCode(code) || loading) return;
    setError('');
    setLoading(true);
    try {
      // Signing in is the routing gate's job once the open account is set.
      await loginWithCode(code);
    } catch (e: any) {
      setError(apiErrorMessage(e, 'errInvalidLoginCode', t));
    } finally {
      setLoading(false);
    }
  };

  const formPanel = (
    <View style={[styles.formPanel, isWide && styles.formPanelWide]}>
      <ScrollView
        contentContainerStyle={[
          styles.formScroll,
          { paddingTop: isWide ? SPACE.hero : insets.top + SPACE.lg, paddingBottom: Math.max(insets.bottom, SPACE.xxl) + SPACE.lg, maxWidth: isWide ? 440 : 480 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton color={colors.foreground} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} />

        <View style={styles.formHeader}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
            {t('loginWithCodeTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('loginWithCodeSub')}
          </Text>
        </View>

        {foundPending && !error ? (
          <View style={[styles.banner, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '33', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.bannerText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('loginWithCodeFoundPending')}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[styles.banner, { backgroundColor: colors.destructive + '14', borderColor: colors.destructive + '33', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            accessibilityLiveRegion="polite"
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.bannerText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text>
          </View>
        ) : null}

        <Input
          label={t('loginWithCodeField')}
          placeholder="XXXX-XXXX-XXXX"
          value={code}
          // Shown as it was first displayed (ABCD-EFGH-JKMN), however it is
          // typed or pasted — dashes and spaces are accepted and dropped.
          onChangeText={text => setCode(formatLoginCode(text))}
          leftIcon="key-outline"
          autoCapitalize="characters"
          autoComplete="off"
          isRTL={isRTL}
        />

        <Button
          label={t('signIn')}
          onPress={handleSubmit}
          loading={loading}
          disabled={!isCompleteLoginCode(code)}
          size="lg"
          fullWidth
        />

        <Text style={[styles.lost, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('loginWithCodeLost')}
        </Text>
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, isWide && { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <AuthBrandPanel isWide={isWide} />
      {formPanel}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  formPanel: { flex: 1, backgroundColor: '#F5F7FA' },
  formPanelWide: { flex: 1, justifyContent: 'center' },
  formScroll: { flexGrow: 1, paddingHorizontal: SPACE.xxl, gap: SPACE.md, width: '100%', alignSelf: 'center' },
  formHeader: { gap: SPACE.sm, marginBottom: SPACE.sm },
  title: { fontSize: TYPE.headline },
  subtitle: { fontSize: TYPE.body, lineHeight: 24 },
  banner: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderRadius: 12, borderWidth: 1 },
  bannerText: { flex: 1, fontSize: TYPE.body, lineHeight: 24 },
  lost: { fontSize: TYPE.caption, lineHeight: 21 },
});
