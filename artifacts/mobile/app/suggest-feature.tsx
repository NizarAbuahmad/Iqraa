/**
 * «اقترح ميزة» — a teacher tells us what is missing, and is told we will look.
 *
 * Stored as a `feedback` row with `rating: 'idea'` and `materialType:
 * 'feature_request'`, so it lands in the admin dashboard's existing to-do list
 * (filter 💡) with no new table and no schema push. Reached from the profile
 * tab on every platform and from the desktop web sidebar.
 *
 * Same rule as FeedbackWidget: `apiFetch` resolves on any HTTP status, so the
 * thank-you only shows on `res.ok`. On failure the text stays in the box —
 * a teacher who typed out an idea must not lose it to a dropped connection.
 * It is also kept in suggestionDraft.ts as they type, so a session that ends
 * (which sends them to login and unmounts this screen) does not take it either.
 *
 * Signed out (a visitor who reached it from the login or register screen), the
 * same screen posts to the public `POST /site/ideas` instead: no account, so it
 * asks for an optional email to reply to, and lands in the admin «المسجّلون»
 * list as kind `idea`. That endpoint is rate-limited per IP and carries a
 * honeypot field — `website`, rendered off-screen on web only, where form bots
 * crawl the DOM. The route is in PUBLIC_ROUTES (services/routeGating.ts).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/services/apiClient';
import { trackEvent } from '@/services/analytics';
import { loadSuggestionDraft, saveSuggestionDraft } from '@/services/suggestionDraft';
import { BackButton } from '@/components/ui/BackButton';

const MAX_LENGTH = 2000;

export default function SuggestFeatureScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const [idea, setIdea] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState<null | 'network' | 'session' | 'email' | 'tooMany'>(null);
  const { user } = useAuth();
  const signedOut = !user;
  const [email, setEmail] = useState('');
  // Honeypot. Never shown to a person; see the header comment.
  const [website, setWebsite] = useState('');

  // A draft from before the session ended. `prev || draft`: never overwrite what
  // the teacher has typed since the screen opened.
  useEffect(() => {
    void loadSuggestionDraft().then(draft => { if (draft) setIdea(prev => prev || draft); });
  }, []);

  const align = isRTL ? 'right' : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' : 'row' as const;
  // The public endpoint refuses fewer than 5 characters; say so with a disabled button, not a 400.
  const canSend = idea.trim().length >= (signedOut ? 5 : 1) && !sending;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setFailed(null);
    try {
      const res = signedOut
        ? await apiFetch('/site/ideas', {
          method: 'POST',
          body: JSON.stringify({ message: idea.trim(), email: email.trim(), website, context: `app:${Platform.OS}` }),
        })
        : await apiFetch('/feedback', {
          method: 'POST',
          body: JSON.stringify({ materialType: 'feature_request', rating: 'idea', comment: idea.trim() }),
        });
      if (signedOut && res.status === 429) { setFailed('tooMany'); return; }
      if (signedOut && res.status === 400) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        if (body.error === 'email') { setFailed('email'); return; }
      }
      if (!signedOut && res.status === 401) {
        // Not a connection problem: the session is gone (apiFetch has already
        // signed the user out), so "check your connection" would send them hunting.
        setFailed('session');
        return;
      }
      if (!res.ok) throw new Error(`suggestion failed: ${res.status}`);
      trackEvent('feature_suggested', { length: idea.trim().length, signedIn: !signedOut });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSent(true);
      setIdea('');
      void saveSuggestionDraft('');
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFailed('network');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (insets.top === 0 ? 14 : 8),
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={[styles.headerRow, { flexDirection: rowDir }]}>
          <BackButton color={colors.foreground} />
          <Text style={[styles.title, { color: colors.foreground, textAlign: align, flex: 1 }]}>
            {t('suggestFeature')}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: align }]}>
          {t('suggestFeatureSubtitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          {sent ? (
            <View style={[styles.card, styles.thanksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="bulb" size={32} color={colors.primary} />
              <Text style={[styles.thanksTitle, { color: colors.foreground }]}>{t('suggestFeatureThanksTitle')}</Text>
              <Text style={[styles.thanksBody, { color: colors.mutedForeground }]}>{t('suggestFeatureThanks')}</Text>
              <Pressable
                onPress={() => setSent(false)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.secondaryText, { color: colors.primary }]}>{t('suggestFeatureAnother')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                value={idea}
                onChangeText={(v) => { setIdea(v); void saveSuggestionDraft(v); if (failed) setFailed(null); }}
                placeholder={t('suggestFeaturePlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={MAX_LENGTH}
                autoFocus
                accessibilityLabel={t('suggestFeature')}
                style={[styles.input, {
                  color: colors.foreground,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  textAlign: align,
                }]}
              />
              {signedOut && (
                <TextInput
                  value={email}
                  onChangeText={(v) => { setEmail(v); if (failed === 'email') setFailed(null); }}
                  placeholder={t('suggestFeatureEmailPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  maxLength={200}
                  accessibilityLabel={t('suggestFeatureEmailPlaceholder')}
                  style={[styles.emailInput, {
                    color: colors.foreground,
                    borderColor: failed === 'email' ? colors.destructive : colors.border,
                    borderRadius: colors.radius,
                    textAlign: align,
                  }]}
                />
              )}
              {signedOut && Platform.OS === 'web' && (
                <TextInput
                  value={website}
                  onChangeText={setWebsite}
                  {...({ tabIndex: -1, 'aria-hidden': true, name: 'website' } as object)}
                  autoComplete="off"
                  importantForAutofill="no"
                  style={styles.honeypot}
                />
              )}
              {failed && (
                <Text style={[styles.failed, { color: colors.destructive, textAlign: align }]}>
                  {t(
                    failed === 'session' ? 'suggestFeatureSessionExpired'
                      : failed === 'email' ? 'suggestFeatureEmailInvalid'
                        : failed === 'tooMany' ? 'suggestFeatureTooMany'
                          : 'suggestFeatureFailed',
                  )}
                </Text>
              )}
              <Pressable
                onPress={send}
                disabled={!canSend}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sendBtn,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                    alignSelf: isRTL ? 'flex-end' : 'flex-start',
                    opacity: !canSend ? 0.5 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.sendText}>{t('suggestFeatureSend')}</Text>}
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { alignItems: 'center', gap: 12 },
  title: { fontFamily: 'ReadexPro_700Bold', fontSize: 20 },
  subtitle: { fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 23, marginTop: 6 },
  body: { padding: 16 },
  // Matches the FAQ / chat column so the page does not sprawl on a desktop browser.
  column: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 24,
    minHeight: 140,
    textAlignVertical: 'top',
    fontFamily: 'Almarai_400Regular',
  },
  failed: { fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 21 },
  emailInput: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Almarai_400Regular' },
  // Off-screen rather than display:none — some bots skip fields that are not rendered.
  honeypot: { position: 'absolute', left: -10000, top: 0, width: 1, height: 1, opacity: 0 },
  sendBtn: { paddingHorizontal: 20, paddingVertical: 11, minWidth: 120, alignItems: 'center' },
  sendText: { color: '#fff', fontSize: 14, fontFamily: 'ReadexPro_600SemiBold' },
  thanksCard: { alignItems: 'center', paddingVertical: 28 },
  thanksTitle: { fontFamily: 'ReadexPro_700Bold', fontSize: 18, textAlign: 'center' },
  thanksBody: { fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' },
  secondaryBtn: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9, marginTop: 4 },
  secondaryText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 },
});
