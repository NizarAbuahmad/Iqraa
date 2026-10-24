/**
 * The parent's page: `{origin}/guardian#{token}`. No account. The token is the URL fragment, which a browser
 * never sends to a server; it is read once here, posted in a body to /guardian-consent/lookup and /decide, kept
 * only in this component's memory, and never written to a path, a query, a log or an analytics event (the screen
 * is excluded from tracking in app/_layout.tsx). Approving needs the parent to tick that they are this child's
 * parent or the adult responsible for them; the server enforces that too.
 *
 * The root layout returns early for public routes, so a signed-in user opening the link is not redirected and
 * nothing here reads the session. On a phone the link is meant for a browser: no call is made.
 *
 * Which view follows which result is `services/guardianConsentView.ts` (pinned by its test).
 */
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { CheckRow } from '@/components/ui/CheckRow';
import { Surface } from '@/components/ui/Surface';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { SPACE, TYPE } from '@/constants/theme';
import { guardianApi } from '@/services/guardianApi';
import { parseConsentFragment } from '@/services/guardianConsentLink';
import {
  closedCopyKey,
  initialView,
  needsConfirmFirst,
  outcomeForDecideError,
  viewForDecision,
  viewForLookup,
  viewForLookupFailure,
  viewForMissingToken,
  type ConsentDecision,
  type ConsentView,
} from '@/services/guardianConsentView';

const IS_WEB = Platform.OS === 'web';

function readToken(): string | null {
  if (!IS_WEB || typeof window === 'undefined') return null;
  return parseConsentFragment(window.location.hash);
}

export default function GuardianConsentScreen() {
  const { t, lang, isRTL, toggleLang } = useLanguage();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [token] = useState<string | null>(() => readToken());
  const [view, setView] = useState<ConsentView>(() => initialView(IS_WEB));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');

  async function load() {
    if (!token) { setView(viewForMissingToken()); return; }
    setView({ kind: 'loading' });
    try {
      setView(viewForLookup(await guardianApi.lookup(token)));
    } catch {
      setView(viewForLookupFailure());
    }
  }

  useEffect(() => { if (IS_WEB) void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(decision: ConsentDecision) {
    if (!token) return;
    if (needsConfirmFirst(decision, confirmed)) { setWarn(t('parentConsentConfirmFirst')); return; }
    setBusy(true);
    setWarn('');
    try {
      const out = await guardianApi.decide(token, decision, confirmed);
      setView(viewForDecision(out.decision));
    } catch (e) {
      const outcome = outcomeForDecideError(e);
      if (outcome.next === 'reload') await load(); // used, expired or switched off meanwhile
      else setWarn(outcome.warn === 'confirmFirst' ? t('parentConsentConfirmFirst') : t('parentConsentRetry'));
    } finally {
      setBusy(false);
    }
  }

  const align = isRTL ? 'right' : 'left';
  const bodyStyle = (extra: object = {}) => [styles.body, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }, extra];

  let content: React.ReactNode;
  if (view.kind === 'loading') {
    content = <Text style={bodyStyle()}>…</Text>;
  } else if (view.kind === 'browser') {
    content = <Text style={bodyStyle()}>{t('parentConsentOpenInBrowser')}</Text>;
  } else if (view.kind === 'retry') {
    content = (
      <>
        <Text accessibilityLiveRegion="polite" style={bodyStyle()}>{t('parentConsentRetry')}</Text>
        <Button label={t('retry')} onPress={load} fullWidth style={{ marginTop: SPACE.lg }} />
      </>
    );
  } else if (view.kind === 'done') {
    content = (
      <Text accessibilityLiveRegion="polite" style={bodyStyle()}>
        {view.decision === 'approved' ? t('parentConsentApprovedDone') : t('parentConsentDeclinedDone')}
      </Text>
    );
  } else if (view.kind === 'open') {
    content = (
      <>
        <Text style={bodyStyle()}>{t('parentConsentIntro', view.childFirstName)}</Text>
        <Text style={bodyStyle({ color: colors.mutedForeground, marginTop: SPACE.md })}>{t('parentConsentMeaning')}</Text>
        <View style={{ marginTop: SPACE.lg }}>
          <CheckRow checked={confirmed} onPress={() => setConfirmed(c => !c)} isRTL={isRTL} colors={colors}>
            {t('parentConsentConfirm')}
          </CheckRow>
        </View>
        {warn ? <Text accessibilityLiveRegion="polite" style={bodyStyle({ color: colors.destructive, marginTop: SPACE.md })}>{warn}</Text> : null}
        <Button label={t('parentConsentApprove')} onPress={() => decide('approved')} loading={busy} fullWidth style={{ marginTop: SPACE.lg }} />
        <Button label={t('parentConsentDecline')} variant="secondary" onPress={() => decide('declined')} disabled={busy} fullWidth style={{ marginTop: SPACE.sm }} />
      </>
    );
  } else {
    content = <Text accessibilityLiveRegion="polite" style={bodyStyle()}>{t(closedCopyKey(view.reason))}</Text>;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACE.section, paddingBottom: insets.bottom + SPACE.section }]}
    >
      <Surface style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('parentConsentTitle')}
        </Text>
        <View style={{ marginTop: SPACE.md }}>{content}</View>
      </Surface>
      {/* Literal language names, not translated copy: each is written in its own language. */}
      <Button label={lang === 'ar' ? 'English' : 'العربية'} variant="ghost" onPress={toggleLang} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE.lg, gap: SPACE.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { padding: SPACE.lg },
  title: { fontSize: TYPE.title },
  body: { fontSize: TYPE.body, lineHeight: 24 },
});
