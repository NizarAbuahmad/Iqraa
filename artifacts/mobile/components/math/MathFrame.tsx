/**
 * The Math Corner's page frame: the library's teal header band, a back button,
 * and a centred, width-capped scroll area — `LabFrame`'s layout, plus a way for
 * a canvas to stop the page scrolling while a finger is on it.
 *
 * Without the lock a drag on the grapher scrolls the page instead of panning
 * the graph. A tool calls `useScrollLock()(true)` when a touch starts on its
 * canvas and `(false)` when it ends.
 */
import React, { createContext, useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';

const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** Lock (true) or release (false) the page's scrolling. A no-op outside a `MathFrame`. */
export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}

type Props = { title: string; subtitle?: string; children: React.ReactNode };

export function MathFrame({ title, subtitle, children }: Props) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const [locked, setLocked] = useState(false);
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + SPACE.md }]}>
        <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: SPACE.sm }} />
        <Text style={[styles.title, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{subtitle}</Text>
        ) : null}
      </View>
      <ScrollView
        scrollEnabled={!locked}
        contentContainerStyle={{ paddingBottom: 48, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollLockContext.Provider value={setLocked}>{children}</ScrollLockContext.Provider>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg },
  title: { color: '#fff', fontSize: TYPE.title },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: TYPE.caption, marginTop: SPACE.xs },
});
