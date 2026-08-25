/**
 * A saved material's class, shown and changeable wherever the material is.
 *
 * The class used to be asked once, in a sheet that opened on first save, and
 * then never mentioned again. Nothing on any generator screen said which class
 * a material had gone to, nothing reopened the sheet, and the class screen's
 * attach list hides already-attached materials on purpose — so a wrong pick had
 * no route back except Remove, buried in the old class's الموارد tab. This is
 * the missing control: it states the class, and one tap changes or clears it.
 *
 * It owns the six lines every save site used to repeat — the `classPromptFor`
 * id, the `attachToClass` writer, the toast, the sheet — so those sites keep
 * one prop (`materialId`) instead of a copy each. That duplication is why the
 * fix had to be made in eight places to be made at all.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { ClassPickerSheet, type ClassPick } from '@/components/ui/ClassPickerSheet';
import { attachToClasses, getItem, updateItem } from '@/services/workspace';
import { describeAttachResult } from '@/services/classAttach';
import type { Lang } from '@/services/i18n';
import { listClasses } from '@/services/roster';
import { classNameFor } from '@/services/materialClass';

export function MaterialClassField({
  materialId,
  onToast,
  promptOnNew = true,
}: {
  /** The saved material. Null before the first save — nothing to file yet. */
  materialId: string | null | undefined;
  onToast: (message: string) => void;
  /**
   * Open the sheet by itself when a material is saved for the first time,
   * which is the behaviour every generator screen already had. Re-saving an
   * edit must not re-ask: the id does not change, so it does not.
   */
  promptOnNew?: boolean;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** The material whose class has actually been read back — see the prompt effect. */
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  /** Ids already auto-prompted, so the sheet asks once per material, not per render. */
  const promptedRef = useRef<Set<string>>(new Set());
  /**
   * The material this screen opened with, if any.
   *
   * Arriving with a saved id means the teacher opened an existing material to
   * edit it — a question they answered when they first saved it, so it is not
   * asked again. Only an id that appears later is a fresh save.
   */
  const openedWithRef = useRef<string | null | undefined>(materialId);

  // Read the material's current class whenever the material changes. The
  // stored id alone is not enough to render: a class that has since been
  // deleted still leaves its id behind, and `classNameFor` resolves that to
  // "no class" rather than a name that no longer exists.
  useEffect(() => {
    if (!materialId) {
      setClassId(null);
      setName(null);
      setResolvedFor(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      let id: string | null = null;
      let label: string | null = null;
      try {
        const item = await getItem(materialId);
        id = item?.classGroupId ?? null;
        if (id) label = classNameFor(await listClasses(), id, lang as 'ar' | 'en');
      } catch {
        // Offline: the roster is server-only, so the row simply reads as
        // unfiled. It never claims a class it could not confirm.
      }
      if (cancelled) return;
      setClassId(id);
      setName(label);
      setResolvedFor(materialId);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [materialId, lang]);

  useEffect(() => {
    if (!promptOnNew || !materialId) return;
    // Wait for the read-back on THIS id. `loading` alone is not enough: it
    // starts false, so on the render where the id first appears this effect
    // would run before the fetch effect had set it — and open the sheet on a
    // `classId` that is still null only because nothing had looked yet. That
    // put the sheet in front of a material already filed under a class, which
    // is exactly the interrogation this guard exists to prevent.
    if (resolvedFor !== materialId) return;
    // Opened on an existing material rather than freshly saved — already asked.
    if (openedWithRef.current === materialId) return;
    if (promptedRef.current.has(materialId)) return;
    promptedRef.current.add(materialId);
    if (!classId) setOpen(true);
  }, [promptOnNew, materialId, resolvedFor, classId]);

  const pick = useCallback(async (picks: ClassPick[]) => {
    if (!materialId || picks.length === 0) return;
    setOpen(false);
    setSaving(true);
    try {
      // `class_group_id` holds one class, so the first keeps this material and
      // the rest get copies — see attachToClasses. That is also why the field
      // below goes on showing the first: it is the one this screen still edits.
      const outcome = await attachToClasses(materialId, picks.map(p => p.id));
      if (outcome.attached === 0) {
        onToast(t('saveToClassFailed'));
        return;
      }
      setClassId(picks[0]!.id);
      setName(picks[0]!.name);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onToast(describeAttachResult(outcome, picks, t, lang as Lang));
    } finally {
      setSaving(false);
    }
  }, [materialId, onToast, t, lang]);

  const clear = useCallback(async () => {
    if (!materialId) return;
    setOpen(false);
    setSaving(true);
    try {
      // Same rule the class screen's detach follows: only report it gone once
      // the write actually persisted, or the next load puts it straight back.
      const ok = await updateItem(materialId, { classGroupId: null });
      if (!ok) {
        onToast(t('saveToClassFailed'));
        return;
      }
      setClassId(null);
      setName(null);
      onToast(t('removedFromClass'));
    } finally {
      setSaving(false);
    }
  }, [materialId, onToast, t]);

  // Nothing to file yet. The row appears with the first save, alongside the
  // sheet it used to open silently.
  if (!materialId) return null;

  const filed = !!classId;
  const label = filed
    ? t('materialInClass', name ?? '')
    : t('materialNoClass');

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={saving}
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: filed ? colors.primary + '55' : colors.border,
            backgroundColor: filed ? colors.primary + '10' : 'transparent',
            borderRadius: colors.radius,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            opacity: pressed || saving ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons
          name={filed ? 'people' : 'people-outline'}
          size={16}
          color={filed ? colors.primary : colors.mutedForeground}
        />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: filed ? colors.primary : colors.mutedForeground,
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        >
          {label}
        </Text>
        {saving || loading ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : (
          <Text style={[styles.action, { color: colors.mutedForeground }]}>
            {filed ? t('changeClass') : t('choose')}
          </Text>
        )}
      </Pressable>

      <ClassPickerSheet
        visible={open}
        selectedClassId={classId}
        onClose={() => setOpen(false)}
        multiple
        onPick={picks => { void pick(picks); }}
        onClear={() => { void clear(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  label: { flex: 1, fontSize: 13, fontFamily: 'Cairo_500Medium' },
  action: { fontSize: 12, fontFamily: 'Cairo_600SemiBold' },
});
