/**
 * The one popover shell the timetable uses — anchored to a cell on desktop,
 * a bottom sheet on a phone. Both the class picker (SlotPopover) and the
 * period editor (PeriodPopover) sit inside it, so "where does it open and
 * how does it close" is decided once.
 *
 * A full-screen transparent Modal underneath catches the outside tap; the
 * card is positioned inside it from `measureInWindow` coordinates, which on
 * web are window-relative like the Modal's own overlay.
 */
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { useColors } from '@/hooks/useColors';

export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fits comfortably in a 900px-wide desktop next to a 120px cell. */
const CARD_WIDTH = 300;
/** Estimated card height for the below/above flip — measured after layout would flicker. */
const CARD_HEIGHT_ESTIMATE = 340;

export function Popover({ anchor, isDesktop, isRTL, colors, onClose, children }: {
  anchor: Anchor | null;
  isDesktop: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (!anchor) return null;

  let cardStyle: object;
  if (isDesktop) {
    // Align the card's RTL-start edge with the cell's; clamp inside the window.
    const rawLeft = isRTL ? anchor.x + anchor.width - CARD_WIDTH : anchor.x;
    const left = Math.min(Math.max(8, rawLeft), Math.max(8, winW - CARD_WIDTH - 8));
    const fitsBelow = anchor.y + anchor.height + CARD_HEIGHT_ESTIMATE + 8 <= winH;
    cardStyle = fitsBelow
      ? { position: 'absolute', left, top: anchor.y + anchor.height + 6, width: CARD_WIDTH }
      : { position: 'absolute', left, bottom: winH - anchor.y + 6, width: CARD_WIDTH };
  } else {
    cardStyle = {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
      paddingBottom: insets.bottom + 12,
    };
  }

  return (
    <Modal visible transparent animationType={isDesktop ? 'fade' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
          cardStyle,
          // Web needs an explicit shadow; native gets elevation via the same style.
          Platform.OS === 'web' ? ({ boxShadow: '0 8px 28px rgba(0,0,0,0.18)' } as object) : styles.nativeShadow,
        ]}
      >
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  card: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 8 },
  nativeShadow: { elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
});
