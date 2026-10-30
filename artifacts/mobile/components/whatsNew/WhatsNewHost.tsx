/**
 * «ما الجديد»: the dialog that tells someone who already uses the app what has
 * changed since they joined. Mounted once at the root (app/_layout.tsx) beside
 * TourHost; whether and when it opens is `useWhatsNewAutostart`, and what it
 * holds is `services/whatsNew.ts`.
 *
 * A `<Modal>` like ConfirmHost — it has no text input, so the keyboard rule does
 * not apply, and Escape / Android back close it through `onRequestClose`.
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useSurface } from '@/components/ui/Surface';
import { IconTile } from '@/components/ui/IconTile';
import { useWhatsNewAutostart } from '@/hooks/useWhatsNew';
import { trackEvent } from '@/services/analytics';
import type { WhatsNewEntry } from '@/services/whatsNew';
import { WhatsNewItem } from './WhatsNewItem';

export function WhatsNewHost() {
  const [entries, setEntries] = useState<WhatsNewEntry[] | null>(null);
  useWhatsNewAutostart(setEntries);

  const close = useCallback(() => {
    setEntries(prev => {
      if (prev) trackEvent('whats_new_closed', { count: prev.length });
      return null;
    });
  }, []);

  const tryIt = useCallback((entry: WhatsNewEntry) => {
    trackEvent('whats_new_opened', { id: entry.id, source: 'dialog' });
    setEntries(null);
    if (entry.route) router.push(entry.route as never);
  }, []);

  return entries ? <WhatsNewDialog entries={entries} onClose={close} onTry={tryIt} /> : null;
}

function WhatsNewDialog({
  entries,
  onClose,
  onTry,
}: {
  entries: WhatsNewEntry[];
  onClose: () => void;
  onTry: (entry: WhatsNewEntry) => void;
}) {
  const colors = useColors();
  const surface = useSurface('raised');
  const { t } = useLanguage();

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: `${colors.ink}8C` }]} onPress={onClose}>
        {/* Inner Pressable swallows taps so a tap on the card does not close it. */}
        <Pressable
          style={[styles.card, surface]}
          onPress={() => {}}
          accessibilityRole="alert"
          accessibilityViewIsModal
          accessibilityLabel={t('whatsNewDialogTitle')}
        >
          <View style={styles.head}>
            <IconTile icon="sparkles-outline" color={colors.primary} size={44} />
            <Text accessibilityRole="header" style={[styles.heading, { color: colors.foreground }]}>
              {t('whatsNewDialogTitle')}
            </Text>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.listBody}>
            {entries.map((entry, i) => (
              <View key={entry.id} style={i > 0 ? [styles.divided, { borderTopColor: colors.border }] : null}>
                <WhatsNewItem entry={entry} onTry={onTry} />
              </View>
            ))}
          </ScrollView>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t('whatsNewGotIt')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  card: { width: '100%', maxWidth: 420, maxHeight: '85%', paddingHorizontal: SPACE.xxl, paddingTop: SPACE.xxl, paddingBottom: SPACE.xl, gap: SPACE.md },
  head: { alignItems: 'center', gap: SPACE.sm },
  heading: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, lineHeight: 30, textAlign: 'center' },
  list: { flexGrow: 0 },
  listBody: { gap: SPACE.md },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.md },
  btn: { minHeight: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.md, marginTop: SPACE.xs },
  btnText: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.body },
});
