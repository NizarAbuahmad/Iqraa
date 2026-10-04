/**
 * One Library resource on a class's Resources tab, beside the teacher's own
 * materials. Tapping opens it; ✕ takes it off the class's shelf (and only
 * that — the Library item is never touched, so there is no confirmation).
 *
 * A staff upload the Library has since deleted stays on the shelf, greyed out
 * and labelled, with its ✕ still working: the teacher should see that it went,
 * not find the row silently gone.
 *
 * The ✕ is a sibling of the open action, not a child of it. On web a
 * `Pressable` with a button role renders a `<button>`, and a `<button>` inside
 * a `<button>` is invalid DOM that some browsers do not deliver clicks through.
 * It also lets the open action be properly `disabled` for a gone row without
 * swallowing the ✕.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RESOURCE_KIND_ICON, RESOURCE_KIND_LABEL } from '@/constants/resourceKind';
import type { ClassResource } from '@/services/classResources';

export function ClassResourceRow({
  resource,
  onOpen,
  onRemove,
}: {
  resource: ClassResource;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const gone = resource.unavailable;
  const tint = gone ? colors.mutedForeground : colors.primary;

  const direction = isRTL ? 'row-reverse' : 'row';

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          flexDirection: direction,
          opacity: gone ? 0.6 : 1,
        },
      ]}
    >
      <Pressable
        onPress={onOpen}
        disabled={gone}
        accessibilityRole="button"
        style={{ flex: 1, flexDirection: direction, alignItems: 'center', gap: 12 }}
      >
        <View style={[styles.icon, { backgroundColor: tint + '18' }]}>
          <Ionicons name={RESOURCE_KIND_ICON[resource.mediaKind]} size={20} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={2}
            style={[styles.name, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }]}
          >
            {resource.title}
          </Text>
          <Text style={[styles.meta, { color: tint, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {gone
              ? t('resourceUnavailable')
              : `${t('resourceTag')} · ${t(RESOURCE_KIND_LABEL[resource.mediaKind])}`}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('remove')}>
        <Ionicons name="close" size={20} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15 },
  meta: { fontSize: 13, lineHeight: 21, marginTop: 2 },
});
