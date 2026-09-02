/**
 * Save / Favourite / Export / Regenerate row that follows a generator's
 * result, plus the feedback and related-resources panels beneath it.
 *
 * Shared by the four generator screens with this exact shape — lesson plan,
 * worksheet, quiz, activity. Slides and Lesson Flow are deliberately not
 * forced through this: they have their own export formats (PPTX, no Word)
 * and no in-place regenerate flow, so their action rows stay screen-owned.
 *
 * Actions render before the feedback/related-resources panels, not after:
 * they used to be the last thing on the screen, so a teacher who had just
 * generated a plan scrolled past "rate this" and a related-resources list
 * before reaching Save (23 Aug review). That fix landed in lesson-plan.tsx
 * and worksheet.tsx but not activity.tsx — nothing enforced the same order
 * in the fourth screen because there was no shared place for it to live.
 * Centralizing the row here is what keeps a fix like that from silently
 * missing a screen again.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService } from '@/services/ai/RemoteAIService';
import { confirm } from '@/services/confirm';
import { MaterialClassField } from './MaterialClassField';
import { FeedbackWidget } from './FeedbackWidget';
import { RelatedResourcesPanel } from './RelatedResourcesPanel';

export type SaveState = 'save' | 'saved' | 'updated';

export interface GeneratorResultActionsProps {
  /** The screen's own accent color — differs per tool. */
  accent: string;
  savedId: string | null | undefined;
  onToast: (message: string) => void;
  saveState: SaveState;
  onSave: () => void;
  /** Omit entirely for a screen with no favouriting (activity has none). */
  favorite?: { favorited: boolean; onToggle: () => void };
  /** Opens the screen's own ExportMenu. */
  onExport: () => void;
  onRegenerate: () => void;
  /**
   * The shared-pool id of the artifact on screen, from `pooledVariantId()`.
   *
   * Its presence is what decides whether "report a problem" is offered:
   * without it this artifact was never pooled and no other teacher can be
   * served it, so withdrawing it would do nothing. Omit for a screen with no
   * pooled result.
   */
  variantId?: string;
  /** Matches workspace.ts's MaterialType — 'lesson' | 'worksheet' | 'quiz' | 'activity' | ... */
  materialType: string;
  /** toolCatalog id, e.g. 'lesson-plan', 'worksheet', 'quiz', 'activity'. */
  toolId: string;
  topic: string;
  /** Space above the row. Screens currently vary (4 vs 8px); default matches the majority. */
  marginTop?: number;
}

export function GeneratorResultActions({
  accent,
  savedId,
  onToast,
  saveState,
  onSave,
  favorite,
  onExport,
  onRegenerate,
  variantId,
  materialType,
  toolId,
  topic,
  marginTop = 4,
}: GeneratorResultActionsProps) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [reporting, setReporting] = React.useState(false);

  /**
   * Withdraw this artifact from the shared pool, then regenerate.
   *
   * Both halves matter. Withdrawing alone would leave the teacher holding the
   * paper they just reported and no replacement; regenerating alone would give
   * them a good one and leave the bad one being served to everybody else.
   *
   * A failed withdrawal does NOT go on to regenerate. The teacher would get a
   * fresh artifact and reasonably conclude the bad one was dealt with, when it
   * is still in the pool — the report has to fail visibly or not at all.
   */
  const reportProblem = async () => {
    if (!variantId || reporting) return;
    const ok = await confirm({
      title: t('reportArtifactTitle'),
      message: t('reportArtifactMsg'),
      confirmLabel: t('reportArtifactConfirm'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setReporting(true);
    try {
      const retired = await remoteAIService.retireVariant(variantId);
      // Already gone counts as done — the teacher wanted it out of the pool
      // and it is out of the pool. Said differently so a second report on the
      // same artifact does not look like the first one silently failed.
      onToast(retired ? t('reportArtifactDone') : t('reportArtifactGone'));
      onRegenerate();
    } catch {
      onToast(t('reportArtifactFailed'));
    } finally {
      setReporting(false);
    }
  };

  const saveDone = saveState === 'saved' || saveState === 'updated';
  const saveBtnLabel =
    saveState === 'saved' ? t('savedSuccess')
      : saveState === 'updated' ? t('updatedSuccess')
        : savedId ? t('updateInWorkspace')
          : t('saveToWorkspace');

  return (
    <>
      <View style={{ marginHorizontal: 20, gap: 10, marginTop, marginBottom: 20 }}>
        {/* Which class this material is for — nothing until it is saved. */}
        <MaterialClassField materialId={savedId} onToast={onToast} />

        <Pressable
          onPress={onSave}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: saveDone ? accent : 'transparent',
              borderColor: accent,
              borderRadius: colors.radius,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name={saveDone ? 'checkmark-circle' : 'bookmark-outline'} size={16} color={saveDone ? '#fff' : accent} />
          <Text style={[styles.actionText, { color: saveDone ? '#fff' : accent, fontFamily: 'Cairo_600SemiBold' }]}>
            {saveBtnLabel}
          </Text>
        </Pressable>

        {/* Favourite — only once there is something saved to favourite. */}
        {favorite && !!savedId && (
          <Pressable
            onPress={favorite.onToggle}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: favorite.favorited ? '#F59E0B' : colors.mutedForeground,
                borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                backgroundColor: favorite.favorited ? '#F59E0B18' : 'transparent',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name={favorite.favorited ? 'star' : 'star-outline'} size={16} color={favorite.favorited ? '#F59E0B' : colors.mutedForeground} />
            <Text style={[styles.actionText, { color: favorite.favorited ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>
              {favorite.favorited ? t('inFavorites') : t('addToFavorites')}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onExport}
          style={[styles.actionBtn, { borderColor: colors.mutedForeground, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="share-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.actionText, { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>{t('exportBtn')}</Text>
        </Pressable>

        <Pressable
          onPress={onRegenerate}
          style={[styles.actionBtn, { borderColor: accent, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="refresh-outline" size={16} color={accent} />
          <Text style={[styles.actionText, { color: accent, fontFamily: 'Cairo_600SemiBold' }]}>{t('regenerateBtn')}</Text>
        </Pressable>

        {/* Report a problem — only for an artifact that is actually shared.
            Deliberately last and in muted red: it is the rarest action here and
            the only one that affects other teachers' material. */}
        {!!variantId && (
          <Pressable
            onPress={reportProblem}
            disabled={reporting}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: colors.destructive,
                borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: reporting ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="flag-outline" size={16} color={colors.destructive} />
            <Text style={[styles.actionText, { color: colors.destructive, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('reportArtifactBtn')}
            </Text>
          </Pressable>
        )}
      </View>

      <FeedbackWidget materialType={materialType} toolId={toolId} />
      <RelatedResourcesPanel toolId={toolId} topic={topic} isRTL={isRTL} />
    </>
  );
}

const styles = StyleSheet.create({
  actionBtn: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1.5 },
  actionText: { fontSize: 14 },
});
