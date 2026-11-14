/**
 * «رموز أولياء الأمور» — every student's per-student link code for one class, in one place. Before this, a teacher with
 * thirty students opened the per-student screen (`/messaging/claim/<student>`) thirty times. Opened from the class
 * page's join-status card.
 *
 * What the teacher can do here:
 * - create the missing codes in one press (`POST /classes/:id/claim-codes`, which never replaces a live code, so a
 *   slip already handed out keeps working, and a second press only fills in students added since);
 * - send one family its code (the same message the per-student screen sends, `composeClaimCodeMessage`) or copy it;
 * - print one slip per child (`slipsHtml`), to cut and hand out.
 *
 * What it deliberately cannot do: put every code in one message. Whoever redeems a code is linked to that child at
 * once, with no approval, so a list posted in a class group would let any parent claim any child.
 *
 * The filter defaults to the children with no parent linked yet, the ones a code is still for; «كل الطلبة» shows the
 * rest (a second parent, a lost slip). Re-minting one code, and unlinking a wrong parent, stay on the per-student
 * screen, which each row's name opens.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { getClass, getClassClaimCodes, mintClassClaimCodes, type RosterStudent } from '@/services/roster';
import {
  filterRows,
  missingCount,
  parentCodeRows,
  slipsHtml,
  type ClassCode,
  type ParentCodeFilter,
  type ParentCodeRow,
} from '@/services/parentCodes';
import { composeClaimCodeMessage } from '@/services/claimCodeMessage';
import { copyToClipboard, exportAsPDF, shareAsText } from '@/services/share';
import { PROD_ORIGIN } from '@/services/siteOrigin';
import { AR_LATIN } from '@/services/dateLabels';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { useStudentAccountsEnabled } from '@/services/features';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { LoadError } from '@/components/ui/LoadError';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { Toast } from '@/components/ui/Toast';

/** Minimum touch target. */
const TOUCH = 44;

const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default function ParentCodesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  const align = isRTL ? 'right' : 'left';
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const classId = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  // The class page hides its link when parent and student accounts are off, but the route stays reachable (a
  // bookmark, a typed URL): explain instead of offering codes nobody can redeem. The server's 403 is the boundary.
  const studentAccounts = useStudentAccountsEnabled();

  const [className, setClassName] = useState('');
  const [students, setStudents] = useState<RosterStudent[] | null>(null);
  const [codes, setCodes] = useState<ClassCode[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<ParentCodeFilter>('waiting');
  const [minting, setMinting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState('');
  /** A press is in flight: a second tap does nothing (the state only drives the look). */
  const busy = useRef(false);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!classId || !studentAccounts) return;
    const seq = ++loadSeq.current;
    setLoadError('');
    try {
      const [klass, list] = await Promise.all([getClass(classId), getClassClaimCodes(classId)]);
      if (seq !== loadSeq.current) return;
      setClassName(klass.group.name);
      setStudents(klass.students);
      setCodes(list);
    } catch (e) {
      if (seq === loadSeq.current) setLoadError(apiErrorMessage(e, 'parentCodesLoadFailed', t));
    }
  }, [classId, studentAccounts, t]);

  // On every focus: the per-student screen (each row's name) can re-mint or unlink.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows = students && codes ? parentCodeRows(students, codes, lang) : null;
  const shown = rows ? filterRows(rows, filter) : [];
  const missing = rows ? missingCount(rows) : 0;
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(lang === 'ar' ? AR_LATIN : undefined);

  const mint = async () => {
    if (busy.current || !classId) return;
    busy.current = true;
    setMinting(true);
    try {
      const out = await mintClassClaimCodes(classId);
      loadSeq.current++; // a load already in flight must not land on top of this answer
      setCodes(out.codes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setToast(t('parentCodesMinted'));
    } catch (e) {
      setToast(apiErrorMessage(e, 'parentCodesMintFailed', t));
    } finally {
      busy.current = false;
      setMinting(false);
    }
  };

  const print = async () => {
    if (busy.current) return;
    const withCode = shown.filter(r => r.code !== null);
    if (withCode.length === 0) {
      setToast(t('parentCodesPrintNone'));
      return;
    }
    busy.current = true;
    setPrinting(true);
    try {
      const html = slipsHtml(withCode, {
        lang,
        className,
        teacherName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
        formatDate,
        text: {
          title: t('parentSlipTitle'),
          studentLabel: t('parentSlipName'),
          codeLabel: t('classCode'),
          expiresLabel: t('parentSlipExpires'),
          howTo: t('parentSlipHowTo', PROD_ORIGIN.replace(/^https:\/\//, '')),
          privateNote: t('parentSlipPrivate'),
        },
      });
      await exportAsPDF(html, `${t('parentCodesTitle')} - ${className}`);
    } catch (e) {
      setToast(apiErrorMessage(e, 'parentCodesPrintFailed', t));
    } finally {
      busy.current = false;
      setPrinting(false);
    }
  };

  const send = async (r: ParentCodeRow) => {
    if (!r.code) return;
    const message = composeClaimCodeMessage(
      {
        studentName: r.name,
        code: r.code,
        expiresOn: r.expiresAt ? formatDate(r.expiresAt) : '',
        // Always the live site: the family opens it on their own phone.
        origin: PROD_ORIGIN,
        fieldLabel: t('classCode'),
      },
      lang === 'ar',
    );
    const outcome = await shareAsText(message, t('messagingClaimCodeTitle'));
    setToast(outcome === 'shared' ? t('messagingCodeShared') : t('copiedToClipboard'));
  };

  const copy = async (r: ParentCodeRow) => {
    if (!r.code) return;
    await copyToClipboard(r.code);
    setToast(t('messagingCodeCopied'));
  };

  const body = { color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align } as const;
  const muted = { ...body, color: colors.mutedForeground, fontSize: TYPE.caption, lineHeight: 20 } as const;

  const renderRow = (r: ParentCodeRow) => (
    <View key={r.studentId} style={[styles.card, surface]}>
      <View style={[styles.line, row]}>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(`/messaging/claim/${r.studentId}?studentName=${encodeURIComponent(r.name)}` as never)}
          style={{ flex: 1, minHeight: TOUCH, justifyContent: 'center' }}
        >
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>{r.name}</Text>
          <View style={[styles.line, row, { gap: SPACE.xs }]}>
            <Ionicons
              name={r.hasParent ? 'checkmark-circle' : 'ellipse-outline'}
              size={ICON.sm}
              color={r.hasParent ? colors.primary : colors.mutedForeground}
            />
            <Text style={muted}>{t(r.hasParent ? 'parentCodesHasParent' : 'parentCodesNoParent')}</Text>
          </View>
        </Pressable>
        {r.code ? (
          <View style={{ alignItems: 'center' }}>
            {/* The code in a left-to-right run of its own: six letters must read the same in an Arabic row. */}
            <Text selectable style={[styles.code, { color: colors.foreground, writingDirection: 'ltr' }]}>{r.code}</Text>
            {r.expiresAt ? <Text style={[muted, { textAlign: 'center' }]}>{t('parentCodesExpires', formatDate(r.expiresAt))}</Text> : null}
          </View>
        ) : (
          <Text style={muted}>{t('parentCodesNoCode')}</Text>
        )}
      </View>
      {r.code ? (
        <View style={[styles.line, row, { gap: SPACE.sm }]}>
          <PressableScale
            accessibilityRole="button"
            aria-label={t('parentCodesSendA11y', r.name)}
            onPress={() => void send(r)}
            style={[styles.action, row, { borderColor: colors.border }]}
          >
            <Ionicons name="paper-plane-outline" size={ICON.md} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{t('parentCodesSend')}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            aria-label={t('parentCodesCopyA11y', r.name)}
            onPress={() => void copy(r)}
            style={[styles.action, row, { borderColor: colors.border }]}
          >
            <Ionicons name="copy-outline" size={ICON.md} color={colors.primary} />
          </PressableScale>
        </View>
      ) : null}
    </View>
  );

  const renderBody = () => {
    if (!studentAccounts) {
      return (
        <View style={[styles.card, surface]}>
          <Text style={[body, { fontFamily: 'ReadexPro_600SemiBold' }]}>{t('messagingStudentAccountsOffTitle')}</Text>
          <Text style={muted}>{t('messagingStudentAccountsOffBody')}</Text>
        </View>
      );
    }
    if (loadError && !rows) return <LoadError message={loadError} onRetry={() => void load()} />;
    if (!rows) return <ActivityIndicator color={colors.primary} style={{ marginTop: SPACE.page }} />;
    if (rows.length === 0) return <Text style={[muted, { textAlign: 'center', marginTop: SPACE.page }]}>{t('parentCodesEmpty')}</Text>;
    return (
      <>
        <Text style={body}>{t('parentCodesIntro')}</Text>

        <View style={[styles.line, row, { gap: SPACE.sm, flexWrap: 'wrap' }]}>
          {missing > 0 ? (
            <Button label={t('parentCodesMint', missing)} onPress={() => void mint()} loading={minting} disabled={printing} />
          ) : null}
          <Button label={t('parentCodesPrint')} onPress={() => void print()} variant="secondary" loading={printing} disabled={minting} />
        </View>

        <View accessibilityRole="radiogroup" style={[styles.line, row, { gap: SPACE.sm }]}>
          {(['waiting', 'all'] as const).map(f => {
            const on = filter === f;
            return (
              <Pressable
                key={f}
                accessibilityRole="radio"
                aria-checked={on}
                onPress={() => setFilter(f)}
                style={[styles.chip, { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border }]}
              >
                <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
                  {t(f === 'waiting' ? 'parentCodesFilterWaiting' : 'parentCodesFilterAll')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {shown.length === 0 ? <Text style={muted}>{t('parentCodesAllLinked')}</Text> : shown.map(renderRow)}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text accessibilityRole="header" style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
          {t('parentCodesTitle')}
        </Text>
        {className ? <Text style={[muted, { fontSize: TYPE.body, marginTop: SPACE.xs }]}>{className}</Text> : null}
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.page }]}>{renderBody()}</ScrollView>
      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: SPACE.xs, marginBottom: SPACE.sm },
  content: { padding: SPACE.lg, gap: SPACE.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  card: { padding: SPACE.md, gap: SPACE.sm },
  line: { alignItems: 'center', gap: SPACE.md },
  code: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, letterSpacing: 3 },
  action: { alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, minHeight: TOUCH, minWidth: TOUCH, paddingHorizontal: SPACE.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, minHeight: TOUCH, justifyContent: 'center' },
});
