/**
 * The composer's "+" menu — every teaching tool, one tap from the message box.
 *
 * The tools existed only on their own tab, which meant a teacher mid-conversation
 * had to leave the conversation to reach them. This puts the same catalog where
 * the work is happening. Tools the chat can carry out itself run inline and the
 * answer lands in the thread; the rest hand off to their own screen.
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToolDef } from '@/services/toolCatalog';

type Colors = {
  card: string;
  background: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  muted: string;
  primary: string;
  secondary: string;
};

export type MenuSection = {
  id: string;
  title: string;
  tools: ToolDef[];
};

/** Attach / upload rows, which are actions rather than catalog tools. */
export type MenuAction = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  colors: Colors;
  isRTL: boolean;
  title: string;
  /** Lesson the tools would act on, shown so the target is never a guess. */
  contextLabel?: string;
  actions: MenuAction[];
  sections: MenuSection[];
  /** Localised copy for a tool row. */
  labelFor: (tool: ToolDef) => string;
  descFor: (tool: ToolDef) => string;
  badgeFor: (tool: ToolDef) => string | null;
  onSelectTool: (tool: ToolDef) => void;
};

export function ComposerToolsMenu({
  visible,
  onClose,
  colors,
  isRTL,
  title,
  contextLabel,
  actions,
  sections,
  labelFor,
  descFor,
  badgeFor,
  onSelectTool,
}: Props) {
  const align = isRTL ? 'right' : 'left' as const;
  const rowDir = isRTL ? 'row-reverse' : 'row' as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the dimmed area closes — the sheet has no cancel button. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={title}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <View style={[styles.headerRow, { flexDirection: rowDir }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground, textAlign: align }]}>
                {title}
              </Text>
              {contextLabel ? (
                <Text
                  numberOfLines={1}
                  style={[styles.context, { color: colors.mutedForeground, textAlign: align }]}
                >
                  {contextLabel}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Ionicons name="close" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: 460 }}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {actions.length > 0 ? (
              <View style={styles.group}>
                {actions.map(action => (
                  <Pressable
                    key={action.id}
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.row,
                      { flexDirection: rowDir, backgroundColor: pressed ? colors.muted : 'transparent' },
                    ]}
                    accessibilityRole="button"
                  >
                    <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
                      <Ionicons name={action.icon} size={17} color={colors.primary} />
                    </View>
                    <Text style={[styles.rowTitle, { color: colors.foreground, textAlign: align, flex: 1 }]}>
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {sections.map(section => (
              <View key={section.id} style={styles.group}>
                <Text
                  style={[styles.sectionTitle, { color: colors.mutedForeground, textAlign: align }]}
                >
                  {section.title}
                </Text>
                {section.tools.map(tool => {
                  const badge = badgeFor(tool);
                  return (
                    <Pressable
                      key={tool.id}
                      onPress={() => onSelectTool(tool)}
                      style={({ pressed }) => [
                        styles.row,
                        { flexDirection: rowDir, backgroundColor: pressed ? colors.muted : 'transparent' },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={labelFor(tool)}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: tool.color + '18' }]}>
                        <Ionicons name={tool.icon} size={17} color={tool.color} />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <View style={[styles.titleRow, { flexDirection: rowDir }]}>
                          <Text
                            numberOfLines={1}
                            style={[styles.rowTitle, { color: colors.foreground, textAlign: align }]}
                          >
                            {labelFor(tool)}
                          </Text>
                          {badge ? (
                            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                                {badge}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[styles.rowDesc, { color: colors.mutedForeground, textAlign: align }]}
                        >
                          {descFor(tool)}
                        </Text>
                      </View>
                      <Ionicons
                        name={tool.externalAction ? 'open-outline' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                        size={15}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,27,58,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 28,
    paddingTop: 8,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  headerRow: { alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 6 },
  title: { fontFamily: 'Cairo_700Bold', fontSize: 16 },
  context: { fontFamily: 'Almarai_400Regular', fontSize: 11.5, marginTop: 1 },
  body: { paddingHorizontal: 10, paddingBottom: 4 },
  group: { paddingTop: 6 },
  sectionTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  row: { alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 14 },
  iconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  titleRow: { alignItems: 'center', gap: 6 },
  rowTitle: { fontFamily: 'Cairo_600SemiBold', fontSize: 13.5 },
  rowDesc: { fontFamily: 'Almarai_400Regular', fontSize: 11.5 },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 7 },
  badgeText: { fontFamily: 'Cairo_500Medium', fontSize: 9.5 },
});
