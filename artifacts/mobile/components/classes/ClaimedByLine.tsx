/**
 * «الحساب: خالد التيس · 23 أكتوبر» under a roster name — which account holds
 * it and since when, so a teacher can see at a glance that the name on the
 * roster and the account behind it are the same child. Shows the student's own
 * account only; parents are listed on the code screen.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TYPE } from '@/constants/theme';
import { formatLinkedOn, linkDisplayName, selfLink, type RosterLink } from '@/services/rosterLinks';

export function ClaimedByLine({ links }: { links: readonly RosterLink[] | undefined }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const own = selfLink(links);
  if (!own) return null;
  const when = formatLinkedOn(own.linkedAt, lang);
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.line,
        { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
      ]}
    >
      {t('rosterClaimedByLabel')} {linkDisplayName(own)}
      {when ? ` · ${when}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: TYPE.caption, lineHeight: 21, marginTop: 2 },
});
