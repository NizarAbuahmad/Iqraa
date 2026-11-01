/**
 * Profile → «ما الجديد»: every entry for this account's role, read or not,
 * newest first. The dialog (components/whatsNew/WhatsNewHost.tsx) shows only the
 * unseen few once; this is where they can be found again. Opening it marks them
 * all seen, so the dialog does not repeat what was read here.
 */
import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { SPACE, TYPE } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Surface } from '@/components/ui/Surface';
import { IconTile } from '@/components/ui/IconTile';
import { WhatsNewItem } from '@/components/whatsNew/WhatsNewItem';
import { goBack } from '@/services/navigation';
import { trackEvent } from '@/services/analytics';
import { tourRoleOf } from '@/services/tour';
import { entriesFor, type WhatsNewEntry } from '@/services/whatsNew';
import { markWhatsNewSeen } from '@/services/whatsNewStorage';

export default function WhatsNewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const role = tourRoleOf(user?.role);
  const entries = useMemo(() => (role ? entriesFor(role, Date.now()) : []), [role]);
  const align = isRTL ? 'right' : 'left';

  useEffect(() => {
    if (user?.id && entries.length > 0) void markWhatsNewSeen(user.id, entries.map(e => e.id));
  }, [user?.id, entries]);

  const tryIt = (entry: WhatsNewEntry) => {
    trackEvent('whats_new_opened', { id: entry.id, source: 'screen' });
    if (entry.route) router.push(entry.route as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (insets.top === 0 ? SPACE.md : SPACE.sm), backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.column}>
          <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable onPress={() => goBack()} hitSlop={8} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('back')}>
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.foreground} />
            </Pressable>
            <IconTile icon="sparkles-outline" color={colors.primary} size={36} />
            <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, textAlign: align, flex: 1 }]}>
              {t('whatsNewTitle')}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: align }]}>{t('whatsNewSubtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.page }]}>
        <View style={[styles.column, styles.list]}>
          {entries.length === 0 ? (
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: 'center' }]}>{t('whatsNewEmpty')}</Text>
          ) : (
            entries.map(entry => (
              <Surface key={entry.id} style={styles.card}>
                <WhatsNewItem entry={entry} onTry={tryIt} />
              </Surface>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { alignItems: 'center', gap: SPACE.sm },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title },
  subtitle: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 23, marginTop: SPACE.xs },
  body: { padding: SPACE.lg },
  // The same reading column as the FAQ, so the page does not sprawl on a desktop browser.
  column: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  list: { gap: SPACE.md },
  card: { padding: SPACE.lg },
});
