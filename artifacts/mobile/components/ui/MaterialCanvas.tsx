/**
 * The material, at the size a teacher actually reads it.
 *
 * A generated lesson plan is a document, and a document inside an 82%-wide
 * chat bubble is a document read through a letterbox: the plan a teacher will
 * print, project and edit was rendered in the same 13px column as "حاضر،
 * جهّزتها لك". On desktop the conversation narrows to a side column and the
 * material gets the rest of the window — the chat stays a conversation, and
 * the thing the conversation produced becomes the screen.
 *
 * The canvas owns no material state. It renders what the message holds and
 * hands every edit back, so the message stays the single copy — the same
 * `artifactData` that copy, export, save and "start class" already read.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LessonPlanView } from '@/components/ui/LessonPlanView';
import { MathParagraph } from '@/components/ui/MathParagraph';
import type { ChatArtifactData } from '@/services/ai/chatArtifacts';

export type CanvasAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Filled accent button — at most one, the next step (project it). */
  primary?: boolean;
  disabled?: boolean;
};

export function MaterialCanvas({
  title,
  subtitle,
  data,
  text,
  colors,
  isRTL,
  t,
  actions,
  closeLabel,
  onClose,
  onEditPlan,
}: {
  title: string;
  subtitle?: string;
  /** Structured material, when the kind has a renderer. */
  data?: ChatArtifactData | null;
  /** Everything else: the material as the generator wrote it. */
  text: string;
  colors: any;
  isRTL: boolean;
  t: (k: any, ...a: any[]) => string;
  actions: CanvasAction[];
  closeLabel: string;
  onClose: () => void;
  /** Same signature LessonPlanView edits with — the canvas only forwards it. */
  onEditPlan?: React.ComponentProps<typeof LessonPlanView>['onEdit'];
}) {
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;
  const plan = data?.kind === 'lesson-plan' ? data.plan : null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <View style={[styles.bar, { backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: rowDir }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground, textAlign: align }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.subtitle, { color: colors.mutedForeground, textAlign: align }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[{ flexDirection: rowDir, alignItems: 'center', gap: 8 }]}>
          {actions.map(action => (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              disabled={action.disabled}
              style={({ pressed }) => [
                styles.btn,
                {
                  flexDirection: rowDir,
                  backgroundColor: action.primary ? colors.primary : colors.card,
                  borderColor: action.primary ? colors.primary : colors.border,
                  opacity: action.disabled ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Ionicons
                name={action.icon}
                size={15}
                color={action.primary ? colors.primaryForeground : colors.foreground}
              />
              <Text
                style={[
                  styles.btnText,
                  { color: action.primary ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.close, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          >
            <Ionicons name="close" size={17} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.paper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {plan ? (
            <LessonPlanView
              plan={plan}
              colors={colors}
              isRTL={isRTL}
              t={t}
              accent={colors.primary}
              onEdit={onEditPlan}
            />
          ) : (
            <MaterialText text={text} colors={colors} isRTL={isRTL} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The material as the generator wrote it, for the kinds with no structured
 * renderer yet (worksheet, quiz, activity). Deliberately the same three cases
 * the chat bubble handles — a heading, a bullet, a paragraph — so a worksheet
 * does not change shape when it moves from the thread to the canvas. Maths
 * goes through `MathParagraph`, which is the whole reason this is not a single
 * `<Text>`.
 */
function MaterialText({ text, colors, isRTL }: { text: string; colors: any; isRTL: boolean }) {
  const align = isRTL ? 'right' as const : 'left' as const;
  return (
    <View>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <View key={i} style={{ height: 8 }} />;
        if (line.startsWith('**') && line.includes('**')) {
          return (
            <Text key={i} style={[styles.heading, { color: colors.foreground, textAlign: align }]}>
              {line.replace(/\*\*/g, '')}
            </Text>
          );
        }
        const bullet = line.trimStart().startsWith('•') || line.trimStart().startsWith('- ');
        if (bullet) {
          return (
            <View key={i} style={[styles.bulletRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={{ color: colors.primary, fontSize: 15, lineHeight: 26 }}>•</Text>
              {/* The flex lives on the wrapper: MathParagraph takes a text style, and `flex` is not one. */}
              <View style={{ flex: 1 }}>
                <MathParagraph
                  text={line.trimStart().replace(/^[•-]\s*/, '')}
                  style={{ fontSize: 14.5, lineHeight: 26, color: colors.foreground, textAlign: align, writingDirection: isRTL ? 'rtl' : 'ltr' }}
                  isRTL={isRTL}
                />
              </View>
            </View>
          );
        }
        return (
          <MathParagraph
            key={i}
            text={line}
            style={{ fontSize: 14.5, lineHeight: 27, color: colors.foreground, textAlign: align, writingDirection: isRTL ? 'rtl' : 'ltr' }}
            isRTL={isRTL}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  bar: {
    minHeight: 60,
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  title: { fontSize: 15, fontFamily: 'Cairo_600SemiBold' },
  subtitle: { fontSize: 11.5, lineHeight: 18, fontFamily: 'Almarai_400Regular', marginTop: 1 },
  btn: { alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },
  btnText: { fontSize: 12.5, fontFamily: 'Cairo_600SemiBold' },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  paper: {
    width: '100%',
    maxWidth: 760,
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
    shadowColor: '#081B3A',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  heading: { fontSize: 15.5, fontFamily: 'Cairo_600SemiBold', marginTop: 14, marginBottom: 4 },
  bulletRow: { gap: 8, alignItems: 'flex-start' },
});
