/**
 * First-run hero for the iQra chat.
 *
 * A single full-width welcome bubble told the teacher nothing about what the
 * assistant can actually do. This replaces it with a greeting plus four
 * tappable starting points, so the empty screen is the fastest path into work.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo } from '@/components/ui/BrandLogo';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  muted: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
};

export type StarterCard = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
};

type Props = {
  colors: Colors;
  isRTL: boolean;
  greeting: string;
  subtitle: string;
  cards: StarterCard[];
};

export function ChatEmptyState({ colors, isRTL, greeting, subtitle, cards }: Props) {
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <View style={styles.wrap}>
      <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
        <BrandLogo variant="mark" onDark width={30} height={28} />
      </View>

      <Text
        style={[
          styles.greeting,
          { color: colors.foreground, textAlign: 'center', writingDirection: isRTL ? 'rtl' : 'ltr' },
        ]}
      >
        {greeting}
      </Text>
      <Text
        style={[
          styles.sub,
          {
            color: colors.mutedForeground,
            textAlign: 'center',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        {subtitle}
      </Text>

      <View style={styles.grid}>
        {cards.map(card => (
          <Pressable
            key={card.id}
            onPress={card.onPress}
            style={({ pressed, hovered }: any) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: hovered || pressed ? colors.primary + '66' : colors.border,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={card.title}
          >
            <View style={[styles.cardRow, { flexDirection: rowDir }]}>
              <View style={[styles.cardIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={card.icon} size={17} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.cardTitle, { color: colors.foreground, textAlign: align }]}
                >
                  {card.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.cardSub, { color: colors.mutedForeground, textAlign: align }]}
                >
                  {card.subtitle}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 18, paddingBottom: 8, gap: 8 },
  brandBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 30 },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 21,
    maxWidth: 460,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 200,
    flexGrow: 1,
    flexBasis: '46%',
    maxWidth: 320,
  },
  cardRow: { alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5 },
  cardSub: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
});
