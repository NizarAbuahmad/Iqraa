/**
 * Opening state for the IQRA chat.
 *
 * The screen used to open on a single grey bubble plus a lot of empty space,
 * which gives a teacher no idea what the assistant is actually good at. This
 * replaces it with a short introduction and four concrete openers, so the first
 * tap is always one gesture away.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo } from './BrandLogo';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  muted: string;
  primary: string;
  secondary: string;
};

export type WelcomeCard = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  /** Sent as-is when tapped. Empty means "open the attach sheet" (handled by caller). */
  prompt: string;
};

type Props = {
  greeting: string;
  headline: string;
  subline: string;
  cards: WelcomeCard[];
  colors: Colors;
  isRTL: boolean;
  onPick: (card: WelcomeCard) => void;
};

/** Fades + lifts each row in sequence so the panel assembles rather than pops. */
function Stagger({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: 90 * index,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function ChatWelcome({
  greeting,
  headline,
  subline,
  cards,
  colors,
  isRTL,
  onPick,
}: Props) {
  const align = isRTL ? ('right' as const) : ('left' as const);
  const dir = isRTL ? ('rtl' as const) : ('ltr' as const);
  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);

  return (
    <View style={styles.wrap}>
      <Stagger index={0}>
        <View style={styles.hero}>
          <View style={[styles.haloOuter, { backgroundColor: colors.primary + '12' }]}>
            <View style={[styles.haloInner, { backgroundColor: colors.primary + '1F' }]}>
              <View style={[styles.mark, { backgroundColor: colors.primary }]}>
                <BrandLogo variant="mark" onDark width={26} height={24} />
              </View>
            </View>
          </View>
          <Text style={[styles.greeting, { color: colors.primary, writingDirection: dir }]}>
            {greeting}
          </Text>
          <Text style={[styles.headline, { color: colors.foreground, writingDirection: dir }]}>
            {headline}
          </Text>
          <Text style={[styles.subline, { color: colors.mutedForeground, writingDirection: dir }]}>
            {subline}
          </Text>
        </View>
      </Stagger>

      <View style={styles.cards}>
        {cards.map((card, i) => (
          <Stagger key={card.id} index={i + 1}>
            <Pressable
              onPress={() => onPick(card)}
              accessibilityRole="button"
              accessibilityLabel={card.title}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: pressed ? colors.primary + '66' : colors.border,
                  flexDirection: rowDir,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.primary + '14' }]}>
                <Ionicons name={card.icon} size={17} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.foreground, textAlign: align, writingDirection: dir },
                  ]}
                >
                  {card.title}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.cardSub,
                    { color: colors.mutedForeground, textAlign: align, writingDirection: dir },
                  ]}
                >
                  {card.subtitle}
                </Text>
              </View>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={15}
                color={colors.mutedForeground}
              />
            </Pressable>
          </Stagger>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 4, gap: 14 },
  hero: { alignItems: 'center', gap: 3 },
  haloOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  haloInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.2 },
  headline: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', lineHeight: 26 },
  subline: {
    fontSize: 12.5,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
    marginTop: 2,
  },
  cards: { gap: 8 },
  card: {
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
  cardSub: { fontSize: 11.5, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
