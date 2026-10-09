/**
 * «مجموعات الدعم» — per objective, the students under 60% and what to do for
 * them. The server derives the groups (api-server supportGroups.ts); this only
 * renders cards and routes the three actions.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { palette } from '@/constants/colors';
import { formatListDate } from '@/services/evaluationRow';
import { trackEvent } from '@/services/analytics';
import {
  groupCheckAction, groupDraftAction, groupWorksheetAction, membersBelowLabel, outcomeKey,
  visibleGroups, type CheckOutcome, type SupportGroup,
} from '@/services/supportGroups';

const ACCENT = palette.primary;

type Kind = 'worksheet' | 'check' | 'student';

export function SupportGroupsSection({
  classId, groups, isRTL, align, lang, t,
}: {
  classId: string;
  groups: SupportGroup[] | null;
  isRTL: boolean;
  align: 'left' | 'right';
  lang: 'ar' | 'en';
  t: (key: any, ...args: any[]) => string;
}) {
  const colors = useColors();
  const [showAll, setShowAll] = useState(false);
  if (!groups || groups.length === 0) return null;
  const row = isRTL ? 'row-reverse' : 'row';

  const go = (kind: Kind, target: { pathname: string; params: Record<string, string> } | null) => {
    if (!target) return;
    trackEvent('support_group_action', { kind });
    router.push(target as never);
  };

  const outcomeColor = (o: CheckOutcome) =>
    o === 'passed' ? palette.success : o === 'still_weak' ? colors.destructive : colors.mutedForeground;

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 17, textAlign: align }}>
        {t('supportGroupsTitle')}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 19, textAlign: align }}>
        {t('supportGroupsHint')}
      </Text>
      {visibleGroups(groups, showAll).map(g => {
        const ws = groupWorksheetAction(g);
        const draft = groupDraftAction(g);
        const checkDate = g.latestCheck ? formatListDate(g.latestCheck.createdAt, lang) : '';
        return (
          <View key={g.objectiveId} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 15, textAlign: align }}>{g.titleAr}</Text>
            {g.lessonTitleAr ? (
              <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{g.lessonTitleAr}</Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.destructive, textAlign: align }]}>{membersBelowLabel(g.members.length, lang)}</Text>
            <View style={[styles.wrap, { flexDirection: row }]}>
              {g.members.map(m => (
                <Pressable
                  key={m.studentId}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => go('student', { pathname: '/classes/[id]/student/[studentId]', params: { id: classId, studentId: m.studentId } })}
                  style={[styles.chip, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
                    {m.displayName} · {Math.round(m.percent)}%
                  </Text>
                </Pressable>
              ))}
            </View>

            {g.latestCheck ? (
              <View style={{ gap: 4, marginTop: 4 }}>
                <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
                  {t('supportGroupLatest')}: {g.latestCheck.title}
                  {checkDate ? ` · ${checkDate}` : ''}
                </Text>
                {g.latestCheck.outcomes.length === 0 ? (
                  <Text style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>{t('supportGroupNoneLeft')}</Text>
                ) : (
                  g.latestCheck.outcomes.map(x => (
                    <View key={x.studentId} style={{ flexDirection: row, justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: align }}>{x.displayName}</Text>
                      <Text style={{ color: outcomeColor(x.outcome), fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
                        {t(outcomeKey(x.outcome))}{x.percent !== null ? ` · ${Math.round(x.percent)}%` : ''}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}

            <View style={[styles.wrap, { flexDirection: row, marginTop: 4 }]}>
              {ws ? <Pill label={t('supportGroupWorksheet')} onPress={() => go('worksheet', ws)} /> : null}
              {draft ? (
                <Pill label={t('supportGroupFinishCheck')} onPress={() => go('check', draft)} />
              ) : (
                <Pill
                  label={t(g.latestCheck ? 'supportGroupNewCheck' : 'supportGroupCheck')}
                  onPress={() => go('check', groupCheckAction(classId, g))}
                />
              )}
            </View>
          </View>
        );
      })}
      {!showAll && groups.length > visibleGroups(groups, false).length ? (
        <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{t('supportGroupsShowAll', String(groups.length))}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.pill, { borderColor: ACCENT }]}>
      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  meta: { fontSize: 13, fontFamily: 'Almarai_400Regular' },
  wrap: { flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
});
