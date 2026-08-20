import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { classifyMediaUrl } from '@/services/classMedia';
import {
  addLessonMedia, getLessonMedia, removeLessonMedia, type LessonMediaItem,
} from '@/services/lessonMedia';

const TEAL = '#1B6B62';

type Props = {
  /** Lesson these resources belong to. Empty means no lesson picked yet. */
  topic: string;
  /** Told when the list changes, so a generator can plan around it. */
  onChange?: (items: LessonMediaItem[]) => void;
};

/**
 * The teacher's own resources for a lesson, pinned once and reused.
 *
 * The store behind this (`services/lessonMedia.ts`) has been complete for
 * months — per user, per lesson, with duplicate rejection — but its only UI
 * lived on the home screen, which was retired when chat became the landing
 * tab. Nothing routes there any more, so `addLessonMedia` became unreachable
 * while `startClass.ts` carried on reading the store on every Class Mode
 * deck: a lesson library that could be read but never written.
 *
 * This is that UI, in a place a teacher can actually get to, as a component
 * so the next screen that wants it doesn't copy it a third time.
 */
export function LessonResources({ topic, onChange }: Props) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [items, setItems] = useState<LessonMediaItem[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async (forTopic: string) => {
    const next = forTopic.trim() ? await getLessonMedia(forTopic) : [];
    setItems(next);
    onChange?.(next);
    // `onChange` is a fresh closure each render; depending on it would reload
    // the list on every keystroke in the parent's form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void refresh(topic); }, [topic, refresh]);

  const add = async () => {
    const trimmed = url.trim();
    const kind = classifyMediaUrl(trimmed);
    // Same refusal the deck editor makes: a URL the app cannot embed would
    // project as a blank frame in front of a class.
    if (!kind) { setError(t('addMediaInvalid')); return; }
    setError('');
    await addLessonMedia(topic, { kind, url: trimmed, caption: caption.trim() });
    setUrl('');
    setCaption('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refresh(topic);
  };

  const drop = async (target: string) => {
    await removeLessonMedia(topic, target);
    await refresh(topic);
  };

  if (!topic.trim()) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(v => !v)}
        style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        accessibilityRole="button"
      >
        <Ionicons name={open ? 'chevron-down' : isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
        <Ionicons name="attach-outline" size={16} color={TEAL} />
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
          {t('addMediaTitle')}
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
        <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('addMediaHint')}
        </Text>
      )}

      {/* The list shows whether or not the form is open: a teacher needs to
          see what is already pinned before deciding to add more. */}
      {items.map(m => (
        <View
          key={m.url}
          style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons
            name={m.kind === 'video' ? 'logo-youtube' : 'image-outline'}
            size={18}
            color={m.kind === 'video' ? '#EF4444' : TEAL}
          />
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}
          >
            {m.caption || m.url}
          </Text>
          <Pressable onPress={() => { void drop(m.url); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('remove')}>
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}

      {open && (
        <>
          <TextInput
            value={url}
            onChangeText={v => { setUrl(v); setError(''); }}
            placeholder={t('addMediaPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            // A URL is latin text: left-aligned even in the RTL layout, or it
            // renders with the scheme at the wrong end.
            style={[styles.input, { backgroundColor: colors.card, borderColor: error ? '#EF4444' : colors.border, borderRadius: colors.radius, color: colors.foreground, textAlign: 'left' }]}
          />
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={t('addMediaCaption')}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}
          />
          {error ? (
            <Text style={{ color: '#EF4444', fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}>
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={() => { void add(); }}
            disabled={!url.trim()}
            style={[styles.addBtn, { borderColor: url.trim() ? TEAL : colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={16} color={url.trim() ? TEAL : colors.mutedForeground} />
            <Text style={{ color: url.trim() ? TEAL : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
              {t('addMediaAdd')}
            </Text>
          </Pressable>
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
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: 'Almarai_400Regular' },
  addBtn: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, paddingVertical: 10 },
});
