/**
 * The per-slide editor — shared by Slides and Prompt Slides. State and the
 * edit rules live in `useSlideEditor`; this only draws them.
 *
 * Media fields appear only when the editor was created with `mediaEditing`
 * (Slides). "Another suggestion" appears when the screen passes
 * `onSuggestVideo` — it needs the screen's own video search.
 */
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SlideEditor } from '@/hooks/useSlideEditor';
import type { TranslationKey } from '@/services/i18n';
import type { useColors } from '@/hooks/useColors';
import { DECK_ACCENT as ACCENT, DECK_ACCENT_FILL as ACCENT_FILL, deckStyles as styles } from './deckStyles';

export function SlideEditModal({ editor, onSuggestVideo, loadingSuggestion = false, isRTL, colors, t }: {
  editor: SlideEditor;
  onSuggestVideo?: () => void;
  loadingSuggestion?: boolean;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const { editing } = editor;
  const align = isRTL ? 'right' : 'left';
  const label = (key: TranslationKey) => (
    <Text style={[styles.modalLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
      {t(key)}
    </Text>
  );
  const inputStyle = {
    color: colors.foreground, borderColor: colors.border, borderRadius: colors.radius,
    fontFamily: 'Almarai_400Regular', textAlign: align,
  } as const;

  return (
    <Modal visible={editor.editIdx !== null} transparent animationType="fade" onRequestClose={editor.close}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
            {t('editSlide')}
          </Text>

          {/* The card is capped at 85% of the screen and the field list is
              type-dependent — a media slide adds two more. Without a scroll
              view the extra height clips silently and takes the Save button
              with it, which is unrecoverable for the teacher. */}
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            {label('slideTitleField')}
            <TextInput value={editor.title} onChangeText={editor.setTitle} style={[styles.modalInput, inputStyle]} />

            {label('slideContentField')}
            <TextInput
              value={editor.content}
              onChangeText={editor.setContent}
              multiline
              style={[styles.modalInput, styles.modalInputMultiline, inputStyle]}
            />

            {editor.mediaEditing && editing?.type === 'media' && (
              <>
                {label('slideMediaUrlField')}
                <TextInput
                  value={editor.mediaUrl}
                  onChangeText={v => { editor.setMediaUrl(v); editor.setMediaError(''); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="https://www.youtube.com/watch?v=..."
                  placeholderTextColor={colors.mutedForeground}
                  // A URL is latin text: left-aligned even in the RTL layout,
                  // or it renders with the scheme at the wrong end.
                  style={[styles.modalInput, {
                    color: colors.foreground, borderColor: editor.mediaError ? '#D97706' : colors.border,
                    borderRadius: colors.radius, fontFamily: 'Almarai_400Regular', textAlign: 'left',
                  }]}
                />
                {editor.mediaError ? (
                  <Text style={[styles.modalHint, { color: '#B25E02', fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                    {editor.mediaError}
                  </Text>
                ) : (
                  <Text style={[styles.modalHint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                    {t('slideMediaUrlHint')}
                  </Text>
                )}

                {onSuggestVideo && editing.mediaKind === 'video' && (
                  <Pressable
                    onPress={onSuggestVideo}
                    disabled={loadingSuggestion}
                    style={[styles.suggestBtn, {
                      borderColor: colors.border, borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      opacity: loadingSuggestion ? 0.6 : 1,
                    }]}
                    accessibilityRole="button"
                  >
                    {loadingSuggestion
                      ? <ActivityIndicator size="small" color={ACCENT} />
                      : <Ionicons name="shuffle-outline" size={16} color={ACCENT} />}
                    <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                      {t('suggestAnotherVideo')}
                    </Text>
                  </Pressable>
                )}

                {label('slideMediaCaptionField')}
                <TextInput
                  value={editor.mediaCaption}
                  onChangeText={editor.setMediaCaption}
                  placeholder={t('slideMediaCaptionPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, inputStyle]}
                />
              </>
            )}

            {editing?.type === 'challenge' && (
              <>
                {label('slideAnswerField')}
                <TextInput value={editor.answer} onChangeText={editor.setAnswer} style={[styles.modalInput, inputStyle]} />
              </>
            )}
          </ScrollView>

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={editor.close}
              style={[styles.secondaryBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={editor.applyEdit}
              style={[styles.secondaryBtn, { borderColor: ACCENT, backgroundColor: ACCENT_FILL, borderRadius: colors.radius }]}
            >
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{t('save')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
