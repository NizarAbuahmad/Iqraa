/**
 * The app's confirm dialog, on web and on the phone — see `services/confirm.ts`
 * for why neither `window.confirm` nor Android's stock `Alert` is used. Mounted
 * once in app/_layout.tsx; every `confirm()` call in the app resolves through it.
 *
 * A second `confirm()` while one is open cancels the first rather than stacking:
 * a double-click on a destructive button must never leave an orphaned promise.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { registerConfirmHandler, type ConfirmOptions } from '@/services/confirm';

export function ConfirmHost() {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  }, []);

  useEffect(() => {
    registerConfirmHandler(options => {
      resolver.current?.(false);
      return new Promise<boolean>(resolve => {
        resolver.current = resolve;
        setOpts(options);
      });
    });
    return () => registerConfirmHandler(null);
  }, []);

  if (!opts) return null;

  const tone = opts.destructive ? colors.destructive : colors.primary;
  const toneText = opts.destructive ? colors.destructiveForeground : '#FFFFFF';

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={() => settle(false)}>
      <Pressable style={styles.backdrop} onPress={() => settle(false)}>
        {/* Inner Pressable swallows taps so clicking the card doesn't dismiss. */}
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {}}
          accessibilityRole="alert"
          accessibilityViewIsModal
        >
          <View style={[styles.icon, { backgroundColor: `${tone}1F` }]}>
            <Ionicons
              name={opts.destructive ? 'warning-outline' : 'help-circle-outline'}
              size={26}
              color={tone}
            />
          </View>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>
            {opts.title}
          </Text>
          {opts.message ? (
            <Text style={[styles.message, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {opts.message}
            </Text>
          ) : null}
          <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable
              onPress={() => settle(true)}
              style={({ pressed }) => [styles.btn, { backgroundColor: tone, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: toneText, fontFamily: 'ReadexPro_700Bold' }]}>
                {opts.confirmLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => settle(false)}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.muted, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {opts.cancelLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,27,51,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, textAlign: 'center', lineHeight: 28 },
  message: { fontSize: 15, textAlign: 'center', lineHeight: 24 },
  actions: { width: '100%', gap: 10, marginTop: 16 },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnText: { fontSize: 15 },
});
