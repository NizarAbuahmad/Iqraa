/**
 * Stands in front of the roster until the teacher confirms their school holds
 * the parental consent that lets them enter student information.
 *
 * A student row is personal data about a minor, created before any account
 * for that child exists — the earliest consent surface in the product, and
 * the only one live in a teacher-only v1. The server refuses roster *writes*
 * without the attestation (`lib/rosterConsent.ts`); this is the door that
 * lets a teacher give it, rather than discovering a 403 after typing thirty
 * names.
 *
 * State comes from `/auth/me` rather than the auth context: that object is
 * built from six different responses and only `/me` reports consent, so
 * reading it here keeps one source instead of six that can drift. Unknown is
 * treated as not-consented, which is the safe direction — the cost of being
 * wrong is one extra tap on a statement that is true anyway.
 *
 * The wording is the server's (`GET /auth/roster-consent`), and the version
 * travels back with the acceptance so agreement can never be recorded against
 * text nobody can identify later.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { apiJson } from '@/services/apiClient';

/**
 * Translations of the server's statement. The English here must stay a
 * faithful rendering of ROSTER_CONSENT_STATEMENT_EN — the server's copy is
 * canonical and is what the version stamp identifies.
 */
const STATEMENT = {
  ar:
    'أُقرّ بأنّ مدرستي حصلت على موافقة وليّ الأمر اللازمة لإدخال بيانات طلبتي في «اقرأ»، ' +
    'وبأنّني لن أُدخل إلّا ما تقتضيه الحاجة التعليمية.',
  en:
    'I confirm that my school has obtained the parental or guardian consent required for me ' +
    "to enter my students' information into IQRA, and that I will enter only what I need for teaching.",
};

const COPY = {
  ar: {
    title: 'قبل إضافة بيانات الطلبة',
    lead: 'أسماء الطلبة وملاحظاتك عنهم بيانات شخصية تخصّ قاصرين. قبل إدخالها، نحتاج إقرارك بأنّ المدرسة حصلت على الموافقة اللازمة.',
    note: 'يمكنك الاطّلاع على ما نحفظه وكيف تحذفه في سياسة الخصوصية.',
    accept: 'أُقرّ بذلك',
    failed: 'تعذّر حفظ الإقرار. حاول مرّة أخرى.',
  },
  en: {
    title: 'Before you add student information',
    lead: "Students' names and your notes about them are personal data about minors. Before entering any, we need your confirmation that the school has the consent required.",
    note: 'What we store and how to delete it is in the Privacy Policy.',
    accept: 'I confirm',
    failed: 'Could not save the confirmation. Please try again.',
  },
};

type MeResponse = { rosterConsentAt?: string | null };
type ConsentDoc = { version?: string };

export function RosterConsentGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { lang, isRTL } = useLanguage();
  const copy = COPY[lang];
  const align = isRTL ? 'right' : 'left';

  // `undefined` while unknown — neither the gate nor the roster renders yet,
  // so a consented teacher never sees the statement flash past.
  const [consented, setConsented] = useState<boolean | undefined>(undefined);
  const [version, setVersion] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([
      apiJson<MeResponse>('/auth/me'),
      apiJson<ConsentDoc>('/auth/roster-consent').catch(() => ({}) as ConsentDoc),
    ])
      .then(([me, doc]) => {
        if (!live) return;
        setConsented(!!me.rosterConsentAt);
        setVersion(doc.version);
      })
      .catch(() => {
        // Unreachable server: show the gate rather than the roster. Accepting
        // will fail loudly and visibly, which beats letting writes through to
        // a server that is about to refuse them anyway.
        if (live) setConsented(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const accept = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      await apiJson('/auth/roster-consent', {
        method: 'POST',
        body: JSON.stringify(version ? { version } : {}),
      });
      setConsented(true);
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : copy.failed);
      setBusy(false);
    }
  }, [version, copy.failed]);

  if (consented === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (consented) return <>{children}</>;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <Ionicons name="shield-checkmark-outline" size={34} color={colors.primary} />

      <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
        {copy.title}
      </Text>
      <Text style={[styles.lead, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
        {copy.lead}
      </Text>

      <View style={[styles.statement, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.statementText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {STATEMENT[lang]}
        </Text>
      </View>

      <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
        {copy.note}
      </Text>

      {error ? (
        <Text style={[styles.error, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={accept}
        disabled={busy}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: busy ? 0.6 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={{ color: colors.primaryForeground, fontFamily: 'Cairo_700Bold', fontSize: 15 }}>
            {copy.accept}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { padding: 24, paddingTop: 56, gap: 14 },
  title: { fontSize: 19, marginTop: 6 },
  lead: { fontSize: 14, lineHeight: 24 },
  statement: { borderWidth: 1, padding: 14, marginTop: 4 },
  statementText: { fontSize: 14, lineHeight: 25 },
  note: { fontSize: 12.5, lineHeight: 21 },
  error: { fontSize: 13 },
  button: { marginTop: 10, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
});
