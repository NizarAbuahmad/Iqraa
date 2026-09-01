import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { pickLessonFiles, pickLessonPhotos } from '@/services/lessonMediaPick';
import {
  deleteLessonMedia, listLessonMedia, uploadLessonMedia, type LessonMediaItem,
} from '@/services/lessonMediaApi';

const TEAL = '#1B6B62';

type Props = {
  /** The lesson's own KB id (e.g. `kbl-math-s1-nccd-u2_l1`) — empty when the topic isn't a grounded lesson yet, in which case nothing renders. */
  lessonId: string;
  /** Told when the list changes, so a generator can pull the images into the deck it builds. */
  onChange?: (items: LessonMediaItem[]) => void;
};

/**
 * A teacher's own files — photos, voice notes, documents — attached to one
 * curriculum lesson and saved server-side, so they survive a reinstall and
 * show up again the next time this lesson is opened, on any device.
 *
 * Keyed by the lesson's KB id, not a topic string (`LessonResources`'s
 * pattern) — see `lib/db/src/schema/lessonMedia.ts` for why: a lesson title
 * can resolve to the wrong lesson, an id can't.
 */
export function LessonAttachments({ lessonId, onChange }: Props) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [items, setItems] = useState<LessonMediaItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (id: string) => {
    const next = id.trim() ? await listLessonMedia(id) : [];
    setItems(next);
    onChange?.(next);
    // `onChange` is a fresh closure each render; depending on it would reload
    // the list on every keystroke in the parent's form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void refresh(lessonId); }, [lessonId, refresh]);

  /** Uploads each picked file in turn — one failure doesn't stop the rest, and the list refreshes with whatever made it up. */
  const attach = async (pick: () => Promise<string[]>) => {
    setError('');
    const dataUrls = await pick();
    if (dataUrls.length === 0) return; // cancelled
    setBusy(true);
    let failures = 0;
    for (const dataUrl of dataUrls) {
      try {
        await uploadLessonMedia(lessonId, dataUrl, '');
      } catch {
        failures += 1;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refresh(lessonId);
    if (failures > 0) setError(t('lessonAttachmentsUploadFailed'));
    setBusy(false);
  };

  const drop = async (id: string) => {
    // Removed from the list immediately — the request runs behind it, and a
    // failed delete just reappears on the next refresh rather than blocking
    // the tap with a spinner for what is nearly always a fast, safe call.
    setItems(prev => prev.filter(m => m.id !== id));
    await deleteLessonMedia(id);
  };

  if (!lessonId.trim()) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        accessibilityRole="button"
      >
        <Ionicons name={open ? 'chevron-down' : isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
        <Ionicons name="folder-outline" size={16} color={TEAL} />
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
          {t('lessonAttachmentsTitle')}
        </Text>
        {items.length > 0 && (
          <View style={[styles.badge, { backgroundColor: TEAL + '1A' }]}>
            <Text style={{ color: TEAL, fontFamily: 'Cairo_600SemiBold', fontSize: 11 }}>
              {items.length}
            </Text>
          </View>
        )}
      </Pressable>

      {open && (
        <>
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('lessonAttachmentsHint')}
          </Text>

          {items.length === 0 && !busy && (
            <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('lessonAttachmentsEmpty')}
            </Text>
          )}

          {items.map(m => (
            <View
              key={m.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              {m.kind === 'image' && m.url ? (
                <Image source={{ uri: m.url }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <Ionicons
                  name={m.kind === 'audio' ? 'musical-notes-outline' : 'document-text-outline'}
                  size={18}
                  color={TEAL}
                />
              )}
              <Text
                numberOfLines={1}
                style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}
              >
                {m.caption || m.mimeType}
              </Text>
              <Pressable onPress={() => { void drop(m.id); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('remove')}>
                <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ))}

          {error ? (
            <Text style={{ color: '#EF4444', fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}

          <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable
              onPress={() => { void attach(pickLessonPhotos); }}
              disabled={busy}
              style={[styles.addBtn, { borderColor: TEAL, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: busy ? 0.6 : 1 }]}
              accessibilityRole="button"
            >
              <Ionicons name="image-outline" size={16} color={TEAL} />
              <Text style={{ color: TEAL, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                {busy ? t('lessonAttachmentsUploading') : t('lessonAttachmentsAddPhoto')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { void attach(pickLessonFiles); }}
              disabled={busy}
              style={[styles.addBtn, { borderColor: TEAL, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: busy ? 0.6 : 1 }]}
              accessibilityRole="button"
            >
              <Ionicons name="attach-outline" size={16} color={TEAL} />
              <Text style={{ color: TEAL, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                {busy ? t('lessonAttachmentsUploading') : t('lessonAttachmentsAddFile')}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 12, gap: 8 },
  header: { alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  hint: { fontSize: 12, lineHeight: 18 },
  row: { alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  thumb: { width: 28, height: 28, borderRadius: 4 },
  actions: { gap: 8 },
  addBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, paddingVertical: 10 },
});
