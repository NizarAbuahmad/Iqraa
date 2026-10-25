/**
 * Join a live game: a 6-character code and a typed name, no account.
 *
 * Public on purpose (`/live` is in PUBLIC_ROUTES): a student opens the link or
 * scans the QR on the projector from whatever device is in front of them. A
 * signed-in student is recognised by the server (the join sends the session
 * only if there is one) and has their first name filled in — as a suggestion
 * they can overwrite, never a lock.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isStudentRole, useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSurface } from '@/components/ui/Surface';
import { LiveApiError, joinGame, saveLiveToken } from '@/services/liveGameApi';
import { isCompleteCode, joinErrorKey, normalizeCode, normalizeName, LIVE_CODE_LENGTH, LIVE_NAME_MAX } from '@/services/liveGame';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

export default function LiveJoinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState(() => normalizeCode(params.code));
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // A link opened after this screen mounted (web: the same tab, a new ?code=).
  useEffect(() => {
    if (typeof params.code === 'string') setCode(normalizeCode(params.code));
  }, [params.code]);

  // A signed-in student's first name, once, unless they have typed their own.
  const typed = useRef(false);
  useEffect(() => {
    if (typed.current || !user || !isStudentRole(user.role)) return;
    setName(normalizeName(user.firstName));
  }, [user]);

  const join = async () => {
    const cleanName = normalizeName(name);
    if (!isCompleteCode(code)) return setError(t('liveNeedCode'));
    if (!cleanName) return setError(t('liveNeedName'));
    setError('');
    setBusy(true);
    try {
      const res = await joinGame(code, cleanName);
      await saveLiveToken(code, res.playerToken);
      router.replace(`/live/${code}` as never);
    } catch (e) {
      const err = e instanceof LiveApiError ? e : null;
      setError(t(joinErrorKey(err ? err.status : 0, err?.code)));
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + SPACE.xxl, paddingBottom: insets.bottom + SPACE.xxl }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[surface, styles.card]}>
        <Text style={[styles.title, { color: colors.foreground, textAlign: 'center' }]}>{t('liveJoinTitle')}</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: 'center' }]}>{t('liveJoinSub')}</Text>

        <Input
          label={t('liveCode')}
          value={code}
          onChangeText={v => { setCode(normalizeCode(v)); setError(''); }}
          maxLength={LIVE_CODE_LENGTH + 40}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          placeholder="ABC123"
          isRTL={isRTL}
          style={styles.codeInput}
          returnKeyType="next"
        />
        <Input
          label={t('liveNameLabel')}
          value={name}
          onChangeText={v => { typed.current = true; setName(v.slice(0, LIVE_NAME_MAX)); setError(''); }}
          maxLength={LIVE_NAME_MAX}
          placeholder={t('liveNamePlaceholder')}
          autoCorrect={false}
          isRTL={isRTL}
          returnKeyType="go"
          onSubmitEditing={() => void join()}
        />

        {!!error && (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
        )}

        <Button
          label={busy ? t('liveJoining') : t('liveJoinBtn')}
          size="lg"
          fullWidth
          onPress={() => void join()}
          loading={busy}
          disabled={busy}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: SPACE.lg },
  card: { width: '100%', maxWidth: 440, padding: SPACE.xl, gap: SPACE.lg },
  title: { fontSize: TYPE.headline, fontFamily: 'ReadexPro_700Bold' },
  sub: { fontSize: TYPE.body, fontFamily: 'ReadexPro_500Medium' },
  codeInput: { textAlign: 'center', letterSpacing: SPACE.xs, fontSize: TYPE.title, writingDirection: 'ltr', borderRadius: RADIUS.md },
  error: { fontSize: TYPE.label, fontFamily: 'ReadexPro_600SemiBold' },
});
