/**
 * The screen a mistyped, stale, or shared-and-since-moved link lands on.
 *
 * It used to be the Expo starter's — "Oops! / This screen doesn't exist." in
 * English, left-aligned, offering one link back to `/`. For an app whose whole
 * product language is Arabic, the one screen a teacher reaches when something
 * has already gone wrong was the one screen that stopped speaking to them.
 */
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

export default function NotFoundScreen() {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const router = useRouter();

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  /*
    Two destinations rather than one. "Home" is the reflex, but a broken link
    is most often a link *into* the curriculum — a lesson someone shared, a
    unit bookmarked last term — so the second button lands closer to what the
    teacher was actually after than the home tab does.
  */
  const destinations = [
    { key: 'home', label: t('notFoundHome'), icon: 'home-outline' as const, href: '/(tabs)', primary: true },
    { key: 'curriculum', label: t('notFoundCurriculum'), icon: 'library-outline' as const, href: '/(tabs)/curriculum', primary: false },
  ];

  return (
    <>
      <Stack.Screen options={{ title: t('notFoundTitle') }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
          <Ionicons name="compass-outline" size={30} color={colors.mutedForeground} />
        </View>

        <Text style={[styles.title, { color: colors.foreground, textAlign: 'center' }]}>
          {t('notFoundTitle')}
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground, textAlign: 'center' }]}>
          {t('notFoundBody')}
        </Text>

        <View style={styles.actions}>
          {destinations.map(d => (
            <Pressable
              key={d.key}
              onPress={() => router.replace(d.href as any)}
              style={({ pressed }) => [
                styles.action,
                {
                  flexDirection: rowDir,
                  backgroundColor: d.primary ? colors.primary : colors.card,
                  borderColor: d.primary ? colors.primary : colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={d.label}
            >
              <Ionicons
                name={d.icon}
                size={17}
                color={d.primary ? colors.primaryForeground || '#fff' : colors.foreground}
              />
              <Text
                style={[
                  styles.actionText,
                  {
                    color: d.primary ? colors.primaryForeground || '#fff' : colors.foreground,
                    textAlign: align,
                  },
                ]}
              >
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 19,
  },
  body: {
    fontFamily: 'Almarai_400Regular',
    fontSize: 14,
    lineHeight: 24,
    maxWidth: 340,
  },
  actions: {
    marginTop: 12,
    gap: 10,
    width: '100%',
    maxWidth: 340,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
  },
});
