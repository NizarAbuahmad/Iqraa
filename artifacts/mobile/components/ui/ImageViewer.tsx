/**
 * Full-screen image viewer with close + download — the one place every content
 * image (chat photo, book figure, lesson media, slide figure) enlarges to.
 *
 * `saveRemoteImage` is the same save path chat used on its own: a download on
 * web, the share sheet's "Save Image" natively.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { saveRemoteImage } from '@/services/share';

const MAX_SCALE = 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Pinch, drag (once zoomed) and double-tap-to-zoom state for one image.
 * `runOnJS` + React state rather than reanimated worklets: the app uses no
 * reanimated elsewhere, and an image viewer does not need 60fps UI-thread math.
 * ponytail: pan is not clamped to the image edges; add bounds if it gets lost.
 */
function useZoom(resetKey: string | null, onTapClose: () => void) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const base = useRef({ scale: 1, x: 0, y: 0 });
  const closeRef = useRef(onTapClose);
  closeRef.current = onTapClose;

  useEffect(() => {
    base.current = { scale: 1, x: 0, y: 0 };
    setView({ scale: 1, x: 0, y: 0 });
  }, [resetKey]);

  const gesture = useMemo(() => {
    const commit = (v: { scale: number; x: number; y: number }) => {
      const next = v.scale <= 1.01 ? { scale: 1, x: 0, y: 0 } : v;
      base.current = next;
      setView(next);
    };
    const pinch = Gesture.Pinch().runOnJS(true)
      .onUpdate(e => setView(v => ({ ...v, scale: clamp(base.current.scale * e.scale, 1, MAX_SCALE) })))
      .onEnd(e => commit({ ...base.current, scale: clamp(base.current.scale * e.scale, 1, MAX_SCALE) }));
    const pan = Gesture.Pan().runOnJS(true).minDistance(4)
      .onUpdate(e => {
        if (base.current.scale <= 1) return;
        setView(v => ({ ...v, x: base.current.x + e.translationX, y: base.current.y + e.translationY }));
      })
      .onEnd(e => {
        if (base.current.scale <= 1) return;
        commit({ ...base.current, x: base.current.x + e.translationX, y: base.current.y + e.translationY });
      });
    const doubleTap = Gesture.Tap().runOnJS(true).numberOfTaps(2)
      .onEnd((_e, ok) => { if (ok) commit(base.current.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 }); });
    const singleTap = Gesture.Tap().runOnJS(true)
      .onEnd((_e, ok) => { if (ok && base.current.scale <= 1) closeRef.current(); });
    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
  }, []);

  return { view, gesture };
}

function filenameFor(url: string): string {
  const ext = /\.(png|jpe?g|webp|gif|svg)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'jpg';
  return `iqra-image-${Date.now()}.${ext}`;
}

type ViewerProps = {
  /** `null` = closed. */
  url: string | null;
  onClose: () => void;
  caption?: string;
  /** Diagrams are mostly white strokes and need their own ground on the dark backdrop. */
  whiteGround?: boolean;
};

export function ImageViewerModal({ url, onClose, caption, whiteGround }: ViewerProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const { view, gesture } = useZoom(url, () => { setFailed(false); onClose(); });

  const save = async () => {
    if (!url || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveRemoteImage(url, filenameFor(url));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const close = () => { setFailed(false); onClose(); };

  return (
    <Modal
      visible={!!url}
      transparent
      animationType="fade"
      onRequestClose={close}
      supportedOrientations={['portrait', 'landscape']}
    >
      <GestureHandlerRootView style={styles.backdrop}>
        <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={close} hitSlop={12} style={styles.btn} accessibilityRole="button" accessibilityLabel={t('closeImage')}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Pressable onPress={() => { void save(); }} disabled={saving} hitSlop={12} style={styles.btn} accessibilityRole="button" accessibilityLabel={t('saveImage')}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download-outline" size={24} color="#fff" />}
          </Pressable>
        </View>
        {url ? (
          <GestureDetector gesture={gesture}>
            <View style={styles.stage} collapsable={false}>
              <Image
                source={{ uri: url }}
                style={[
                  styles.image,
                  whiteGround && styles.white,
                  { transform: [{ translateX: view.x }, { translateY: view.y }, { scale: view.scale }] },
                ]}
                resizeMode="contain"
                accessibilityLabel={caption || ''}
              />
            </View>
          </GestureDetector>
        ) : null}
        {failed ? <Text style={styles.note}>{t('messagingImageSaveFailed')}</Text> : null}
        {caption ? <Text style={[styles.note, { fontFamily: 'Almarai_400Regular' }]}>{caption}</Text> : null}
        <View style={{ height: insets.bottom + 12 }} />
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Wraps any thumbnail: tap it and it opens in the viewer. */
export function TapToEnlarge({
  url, caption, whiteGround, style, children,
}: {
  url: string;
  caption?: string;
  whiteGround?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={style} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('enlargeImage')}>
        {children}
      </Pressable>
      <ImageViewerModal url={open ? url : null} onClose={() => setOpen(false)} caption={caption} whiteGround={whiteGround} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, overflow: 'hidden', padding: 16 },
  image: { flex: 1, width: '100%' },
  white: { backgroundColor: '#fff', borderRadius: 12 },
  note: { color: '#E6E3DB', textAlign: 'center', fontSize: 14, paddingHorizontal: 16, paddingTop: 8 },
});
