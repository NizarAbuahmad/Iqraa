/**
 * Post-generation feedback — thumbs up/down plus an optional comment, on the
 * content a teacher was just shown. One explicit Submit rather than firing on
 * tap: a thumb alone can't tell "wrong on purpose" from "wrong, here's why",
 * and firing immediately would mean either a second request to attach a
 * comment (a PATCH endpoint that doesn't otherwise need to exist) or losing
 * the comment entirely. Tapping a thumb only selects it; Submit sends both
 * together in one row.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { apiFetch } from '@/services/apiClient';
import { trackEvent } from '@/services/analytics';

type Rating = 'up' | 'down';

type Props = {
  /** Matches workspace.ts's MaterialType — 'lesson' | 'worksheet' | 'quiz' | 'flow' | 'activity' | 'slides'. */
  materialType: string;
  /** toolCatalog id, e.g. 'lesson-plan', 'simplify', 'homework'. */
  toolId: string;
};

export function FeedbackWidget({ materialType, toolId }: Props) {
  const colors = useColors();
  const { lang, isRTL } = useLanguage();
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pick = (next: Rating) => {
    Haptics.selectionAsync();
    setRating(r => (r === next ? null : next));
  };

  const submit = async () => {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({ materialType, toolId, rating, comment: comment.trim() }),
      });
      trackEvent('feedback_submitted', { rating, materialType, toolId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } catch {
      // A signed-out or offline teacher just doesn't get to leave feedback
      // right now — never block or error the screen they're actually using.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.thanks, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {lang === 'ar' ? '🙏 شكرًا لملاحظتك.' : '🙏 Thanks for the feedback.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={[styles.prompt, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {lang === 'ar' ? 'هل كان هذا مفيدًا؟' : 'Was this helpful?'}
        </Text>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
          <Pressable
            onPress={() => pick('up')}
            accessibilityRole="button"
            accessibilityLabel={lang === 'ar' ? 'مفيد' : 'Helpful'}
            style={[styles.thumb, {
              borderColor: rating === 'up' ? '#10B981' : colors.border,
              backgroundColor: rating === 'up' ? '#10B98118' : 'transparent',
            }]}
          >
            <Ionicons name="thumbs-up" size={16} color={rating === 'up' ? '#10B981' : colors.mutedForeground} />
          </Pressable>
          <Pressable
            onPress={() => pick('down')}
            accessibilityRole="button"
            accessibilityLabel={lang === 'ar' ? 'غير مفيد' : 'Not helpful'}
            style={[styles.thumb, {
              borderColor: rating === 'down' ? colors.destructive : colors.border,
              backgroundColor: rating === 'down' ? colors.destructive + '18' : 'transparent',
            }]}
          >
            <Ionicons name="thumbs-down" size={16} color={rating === 'down' ? colors.destructive : colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {rating && (
        <View style={{ gap: 8 }}>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={lang === 'ar' ? 'أضف تعليقًا (اختياري)' : 'Add a comment (optional)'}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.input, {
              color: colors.foreground,
              borderColor: colors.border,
              borderRadius: colors.radius,
              fontFamily: 'Almarai_400Regular',
              textAlign: isRTL ? 'right' : 'left',
            }]}
          />
          <Pressable
            onPress={submit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed || submitting ? 0.75 : 1 },
            ]}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[styles.submitText, { fontFamily: 'Cairo_600SemiBold' }]}>{lang === 'ar' ? 'إرسال' : 'Send'}</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  row: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  prompt: { fontSize: 13.5, flex: 1 },
  thumb: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 44 },
  submitBtn: { alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 9 },
  submitText: { color: '#fff', fontSize: 13 },
  thanks: { fontSize: 13.5 },
});
