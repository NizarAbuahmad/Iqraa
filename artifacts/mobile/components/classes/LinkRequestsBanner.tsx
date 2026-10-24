/**
 * «طلبات الانضمام» — students who picked their names with the class code and
 * are waiting for the teacher's yes. Shown above the roster, hidden at zero.
 *
 * Approving links the account as the child's own; rejecting removes the request.
 * Either way the request list and the class are refetched, so the name's
 * «joined» state and the claimed-by line move with it. The teacher decides on
 * what they can see here — the account's own name next to the name it asked
 * for — which is the check the class code alone cannot give.
 *
 * It draws nothing while the list cannot be read: a teacher must never take an
 * empty-looking banner for «nobody is waiting».
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PressableScale } from '@/components/ui/PressableScale';
import { Surface } from '@/components/ui/Surface';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RosterError, approveLinkRequest, listLinkRequests, rejectLinkRequest, type LinkRequest } from '@/services/roster';
import { classQueryKey } from '@/services/rosterQueryKeys';
import { formatLinkedOn, linkDisplayName } from '@/services/rosterLinks';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

const requestsKey = (classId: string) => ['classLinkRequests', classId] as const;

/** How long an answer's failure notice stays up once the list it was about has emptied. */
const NOTICE_MS = 8000;

export function LinkRequestsBanner({ classId }: { classId: string }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const align = isRTL ? 'right' : 'left';

  const { data, isError } = useQuery({
    queryKey: requestsKey(classId),
    queryFn: () => listLinkRequests(classId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [error]);

  // A failed read (including a failed refetch after an answer) shows nothing.
  const requests: LinkRequest[] = isError || !data ? [] : data;
  // A 409 «already linked» clears the request server-side, so the list can be
  // empty by the time the notice is wanted: keep the notice until it times out.
  if (requests.length === 0 && !(error && !isError)) return null;

  const act = async (request: LinkRequest, kind: 'approve' | 'reject') => {
    if (busyId) return;
    setBusyId(request.id);
    setError('');
    try {
      if (kind === 'approve') await approveLinkRequest(request.studentId, request.id);
      else await rejectLinkRequest(request.studentId, request.id);
    } catch (err) {
      // claim_request_stale, 404 and anything else all mean «look again»: the refetch below shows what is left.
      setError(t(err instanceof RosterError && err.code === 'claim_already_linked' ? 'linkRequestTaken' : 'linkRequestFailed'));
    } finally {
      setBusyId(null);
      // Both can have changed whatever the answer was.
      void queryClient.invalidateQueries({ queryKey: requestsKey(classId) });
      void queryClient.invalidateQueries({ queryKey: classQueryKey(classId) });
    }
  };

  return (
    <Surface style={styles.card}>
      {requests.length > 0 ? (
        <>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}
          >
            {t('linkRequestsTitle')} · {requests.length}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('linkRequestsHint')}
          </Text>
        </>
      ) : null}
      {requests.map(request => {
        const busy = busyId === request.id;
        const locked = busyId !== null;
        const when = formatLinkedOn(request.requestedAt, lang);
        return (
          <View key={request.id} style={[styles.row, { borderTopColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
              {request.studentName}
            </Text>
            <Text style={[styles.account, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]} numberOfLines={1}>
              {t('rosterClaimedByLabel')} {linkDisplayName(request)}
              {when ? ` · ${when}` : ''}
            </Text>
            <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <PressableScale
                onPress={() => void act(request, 'approve')}
                disabled={locked}
                accessibilityLabel={`${t('linkRequestApprove')} — ${request.studentName}`}
                aria-busy={busy}
                aria-disabled={locked}
                style={[styles.btn, { backgroundColor: colors.primary, opacity: locked && !busy ? 0.5 : 1 }]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.btnLabel, { color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                    {t('linkRequestApprove')}
                  </Text>
                )}
              </PressableScale>
              <PressableScale
                onPress={() => void act(request, 'reject')}
                disabled={locked}
                accessibilityLabel={`${t('linkRequestReject')} — ${request.studentName}`}
                aria-busy={false}
                aria-disabled={locked}
                style={[styles.btn, { borderColor: colors.border, borderWidth: 1, opacity: locked ? 0.5 : 1 }]}
              >
                <Text style={[styles.btnLabel, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                  {t('linkRequestReject')}
                </Text>
              </PressableScale>
            </View>
          </View>
        );
      })}
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}
        >
          {error}
        </Text>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, gap: SPACE.sm },
  title: { fontSize: TYPE.bodyLg },
  hint: { fontSize: TYPE.label, lineHeight: 22 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.md, gap: SPACE.xxs },
  name: { fontSize: TYPE.body },
  account: { fontSize: TYPE.caption, lineHeight: 21 },
  actions: { gap: SPACE.sm, marginTop: SPACE.sm },
  btn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: { fontSize: TYPE.label },
});
