/**
 * Parent message — compose a note to a student's guardian.
 *
 * The preview updates as the teacher types rather than sitting behind a
 * "Generate" button. Composition is deterministic (see `parentMessage.ts`), so
 * there is nothing to wait for, and seeing the letter change as you switch
 * tone or kind is what makes it obvious the tool is arranging *your* facts
 * rather than writing its own.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { useAuth } from '@/context/AuthContext';
import { Toast } from '@/components/ui/Toast';
import { copyToClipboard, shareAsText } from '@/services/share';
import { StudentPickerSheet } from '@/components/ui/StudentPickerSheet';
import { confirm } from '@/services/confirm';
import { SUBJECTS } from '@/services/curriculumData';
import { classSubjectIds } from '@/services/classSubjects';
import {
  RosterError, listParentContacts, listStudents, logParentContact, updateStudent,
  type ClassGroup, type ParentContact, type RosterStudent,
} from '@/services/roster';
import {
  MessagingError, getTeacherContacts, pickChatImage, sendMessage, startThread,
  type ContactStudent,
} from '@/services/messaging';
import { pickOnePdf } from '@/services/lessonMediaPick';
import {
  attachmentKind, attachmentProblem, composeParentMessage, guardiansForStudent, kindEmoji, kindLabel,
  MAX_LETTER_LENGTH, MESSAGE_KINDS, needsDetails, outgoingLetter, parentMessageReady, parseSavedSignature,
  rosterGender, seedDetailsFromNote, SIGNATURE_STORAGE_KEY, suggestMeeting, summarizeContacts,
  type Gender, type ManualEdit, type MessageKind, type Tone,
} from '@/services/parentMessage';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { palette } from '@/constants/colors';
import { dateLocale } from '@/services/dateLabels';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

// Defined at module scope so React sees stable component references across renders.
// Defining them inside ParentMessageScreen would create new function references on
// every state change, causing React to unmount/remount TextInput children and kill
// focus after each keystroke on web.
function Field({ label, children, colors, isRTL }: {
  label: string; children: React.ReactNode;
  colors: ReturnType<typeof useColors>; isRTL: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, {
        color: colors.foreground, fontFamily: 'ReadexPro_500Medium',
        textAlign: isRTL ? 'right' : 'left',
      }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Segmented<T extends string>({ options, value, onChange, colors, isRTL }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean;
}) {
  return (
    <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { onChange(o.value); Haptics.selectionAsync(); }}
            style={[styles.pill, {
              backgroundColor: active ? ACCENT : colors.card,
              borderColor: active ? ACCENT : colors.border,
              borderRadius: colors.radius,
            }]}
          >
            <Text style={[styles.pillText, {
              color: active ? palette.primaryForeground : colors.mutedForeground,
              fontFamily: active ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
            }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useColors>, isRTL: boolean, extra?: object) {
  return [styles.input, {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: colors.radius,
    color: colors.foreground,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: 'Almarai_400Regular',
  }, extra];
}

export default function ParentMessageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const isAr = lang === 'ar';
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  // Arriving from a class's parent-contact card: the student is already chosen,
  // and for a concern-only family the card asks for the missing praise letter.
  const params = useLocalSearchParams<{ studentId?: string; studentName?: string; kind?: string; subjectId?: string }>();
  const paramKind = MESSAGE_KINDS.find(k => k === params.kind);

  const [studentName, setStudentName] = useState(params.studentName ?? '');
  const [studentGender, setStudentGender] = useState<Gender>('male');
  const [kind, setKind] = useState<MessageKind>(paramKind ?? 'praise');
  const [details, setDetails] = useState('');
  const [tone, setTone] = useState<Tone>('formal');
  const [teacherName, setTeacherName] = useState(user?.name ?? '');
  const [teacherGender, setTeacherGender] = useState<Gender>('male');
  const [subject, setSubject] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [pickingStudent, setPickingStudent] = useState(false);
  /**
   * The roster row this note is about, when there is one. Null means the
   * teacher typed a name by hand — in-app delivery needs a student id to find
   * the guardian behind, so that path stays share-only.
   */
  const [pickedStudentId, setPickedStudentId] = useState<string | null>(params.studentId ?? null);
  /** What the roster already says about the picked student's gender; null = not recorded. */
  const [pickedGender, setPickedGender] = useState<Gender | null>(null);
  const [guardians, setGuardians] = useState<ContactStudent['contacts']>([]);
  const [sending, setSending] = useState(false);
  /** Past letters about the picked student, newest first. Null = none picked, or the fetch failed. */
  const [history, setHistory] = useState<ParentContact[] | null>(null);
  /** The teacher's own wording, once they edit the preview. Null = send the composed letter. */
  const [edit, setEdit] = useState<ManualEdit | null>(null);
  /** One photo or PDF as a `data:` URL. Travels only with the in-app send. */
  const [attachment, setAttachment] = useState<string | null>(null);
  /** The letter box grows with its text — a multiline TextInput on web doesn't on its own. */
  const [letterHeight, setLetterHeight] = useState(120);
  const pickedRef = useRef<string | null>(null);
  pickedRef.current = pickedStudentId;
  const showToast = (m: string) => { setToastMsg(m); setToastVisible(true); };

  /**
   * Fill in the name, and offer the note as a starting point for the details.
   *
   * The note is used because the teacher wrote it — this file's rule is that
   * every fact comes from the teacher, and a sentence they typed about this
   * child last week still qualifies. It goes into the editable details box, not
   * into the message, so nothing reaches a parent without being read again.
   *
   * Marks are deliberately NOT pulled in. They are computed, partly by AI, and
   * `attempt_results.isProvisional` marks the ones still awaiting the teacher's
   * review — a number that lands in a parent's WhatsApp cannot be one the
   * teacher has not confirmed.
   *
   * Gender comes from the roster when the teacher has recorded it there (see
   * `onStudentGender`), never from the name — guessing would misgender a real
   * child in Arabic, which inflects for it in almost every clause. The subject
   * comes from the class the student was picked from, unless already typed.
   */
  const adoptStudent = (student: RosterStudent, fromClass: ClassGroup) => {
    setStudentName(student.displayName);
    setPickedStudentId(student.id);
    setPickedGender(rosterGender(student.gender));
    const known = rosterGender(student.gender);
    if (known) setStudentGender(known);
    setDetails(prev => seedDetailsFromNote(prev, student.teacherNote));
    // A class taking several subjects does not say which one this letter is
    // about; seeding its primary subject would mislabel it.
    const ids = classSubjectIds(fromClass);
    const classSubject = ids.length === 1 ? SUBJECTS.find(s => s.id === ids[0]) : undefined;
    if (classSubject && !subject.trim()) setSubject(isAr ? classSubject.nameAr : classSubject.name);
  };

  const onPickStudent = (student: RosterStudent, fromClass: ClassGroup) => {
    setPickingStudent(false);
    adoptStudent(student, fromClass);
  };

  /**
   * Picking a gender for a roster student saves it on the roster, so the next
   * letter about this child doesn't ask again. Fire-and-forget: a failed save
   * costs one repeated question next time, not this letter.
   */
  const onStudentGender = (g: Gender) => {
    setStudentGender(g);
    const id = pickedStudentId;
    if (!id || pickedGender === g) return;
    setPickedGender(g);
    updateStudent(id, { gender: g }).catch(explainRosterWrite);
  };

  /**
   * The one roster failure worth interrupting the letter for. Every roster
   * write is refused until the teacher confirms their school holds parental
   * consent (`requireRosterConsent`); only `/classes` shows the statement.
   * Swallowing that 403 here meant history and gender silently never saved,
   * and nothing on screen said why. Everything else stays quiet: a failed
   * save must never undo or delay the letter.
   */
  const explainRosterWrite = (e: unknown) => {
    if (e instanceof RosterError && e.code === 'roster_consent_required') showToast(t('parentMsgConsentNeeded'));
  };

  /**
   * Arriving with only a `studentId` (the class screen's contact card): the
   * roster row has not been read, so its recorded gender has not either, and
   * the letter opened as «ابنكم» for a girl the teacher had marked «أنثى» —
   * the misgendering the stored gender exists to prevent. Read the row once
   * and seed what `onPickStudent` would have. A failed read leaves the picker
   * at its default, which is no worse than before.
   */
  useEffect(() => {
    const id = params.studentId;
    if (!id) return;
    let cancelled = false;
    listStudents()
      .then(rows => {
        if (cancelled) return;
        const row = rows.find(r => r.id === id);
        if (!row) return;
        const known = rosterGender(row.gender);
        setPickedGender(known);
        if (known) setStudentGender(known);
        setDetails(d => seedDetailsFromNote(d, row.teacherNote));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // Once, for the id the screen opened with — picking another student goes
    // through onPickStudent, which already carries the row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The class the card was on names the subject, unless one was already typed.
  useEffect(() => {
    const classSubject = SUBJECTS.find(s => s.id === params.subjectId);
    if (classSubject) setSubject(prev => (prev.trim() ? prev : isAr ? classSubject.nameAr : classSubject.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The last signature used on this device. Read once; a missing or broken
  // value leaves the account name and the default in place.
  useEffect(() => {
    AsyncStorage.getItem(SIGNATURE_STORAGE_KEY)
      .then(raw => {
        const saved = parseSavedSignature(raw);
        if (!saved) return;
        if (saved.teacherName) setTeacherName(saved.teacherName);
        setTeacherGender(saved.teacherGender);
      })
      .catch(() => {});
  }, []);

  /** Called whenever a letter leaves the app — that's when the signature was clearly the one they meant. */
  const rememberSignature = () => {
    AsyncStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify({ teacherName: teacherName.trim(), teacherGender }))
      .catch(() => {});
  };

  /**
   * The guardians this note could reach in-app. Filtered client-side off the
   * existing contacts endpoint rather than adding a route for it — same
   * reasoning as `app/messaging/claim/[studentId].tsx`: a teacher's own roster
   * is small enough that the filtering isn't worth a backend round of its own.
   *
   * A failure here degrades to "no guardians", which disables in-app send and
   * leaves sharing working. Erroring the whole screen over a contacts fetch
   * would take away the button that works today to protect one that may not.
   */
  useEffect(() => {
    if (!pickedStudentId) {
      setGuardians([]);
      setHistory(null);
      return;
    }
    let cancelled = false;
    // Drop the previous student's guardians at once. They used to stay in
    // place until the fetch below returned, and in that window the recipient
    // line and the in-app send still named the other child's parents.
    setGuardians([]);
    getTeacherContacts()
      .then(contacts => { if (!cancelled) setGuardians(guardiansForStudent(contacts, pickedStudentId)); })
      .catch(() => { if (!cancelled) setGuardians([]); });
    // Same degrade-quietly rule: no history (null) hides the strip, it never
    // blocks writing the letter.
    setHistory(null);
    listParentContacts(pickedStudentId)
      .then(rows => { if (!cancelled) setHistory(rows); })
      .catch(() => { if (!cancelled) setHistory(null); });
    return () => { cancelled = true; };
  }, [pickedStudentId]);

  /**
   * Remember that a letter about this student left the app. Only for roster
   * students — a typed name has no row to hang history on. Fire-and-forget: a
   * failed log must never undo or delay the send the teacher just made.
   */
  const recordContact = (channel: ParentContact['channel'], messageIds?: string[]) => {
    const studentId = pickedStudentId;
    if (!studentId) return;
    logParentContact(studentId, kind, channel, messageIds)
      // The teacher may have picked another student while this was in flight.
      .then(row => { if (pickedRef.current === studentId) setHistory(prev => (prev ? [row, ...prev] : prev)); })
      .catch(explainRosterWrite);
  };

  const summary = useMemo(() => (history ? summarizeContacts(history, new Date()) : null), [history]);

  const message = useMemo(
    () => composeParentMessage(
      { studentName, studentGender, kind, details, teacherName, teacherGender, subject, tone },
      isAr,
    ),
    [studentName, studentGender, kind, details, teacherName, teacherGender, subject, tone, isAr],
  );

  const letter = outgoingLetter(message, edit, studentName);
  // A concern letter is not ready without its details — the same rule the
  // «required» label states, applied to Send, Share and Copy. It holds for a
  // hand-edited letter too: fixing one typo must not wave an empty concern
  // through. And a stale edit is a letter about another child — nothing may
  // send it.
  const ready = parentMessageReady(kind, details, letter.text.trim()) && !letter.stale;
  // Names joined with the comma of the letter's language — an English letter
  // listed its recipients with «،».
  const nameSeparator = isAr ? '، ' : ', ';
  /** Show the editable preview once there is a letter to edit, or the teacher already wrote one. */
  const hasLetter = message.length > 0 || edit !== null;

  const onEditLetter = (v: string) => {
    // Typing back to exactly the composed text is the same as not editing:
    // let the fields drive the letter again.
    setEdit(v === message ? null : { text: v, studentName });
  };

  const onAttach = async (pick: () => Promise<string | null>) => {
    try {
      const dataUrl = await pick();
      if (!dataUrl) return;
      const problem = attachmentProblem(dataUrl);
      if (problem) {
        showToast(t(problem === 'too_large' ? 'parentMsgAttachTooLarge' : 'parentMsgAttachUnsupported'));
        return;
      }
      setAttachment(dataUrl);
      Haptics.selectionAsync();
    } catch {
      showToast(t('parentMsgAttachUnsupported'));
    }
  };

  const onCopy = async () => {
    if (!ready) return;
    await copyToClipboard(letter.text);
    recordContact('copy');
    rememberSignature();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t('copiedToClipboard'));
  };

  const onShare = async () => {
    if (!ready) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // shareAsText falls back to the clipboard where the OS share sheet is
    // unavailable (desktop web), and says which happened so the toast is honest.
    const how = await shareAsText(letter.text, t('parentMsgTitle'));
    recordContact(how === 'shared' ? 'share' : 'copy');
    rememberSignature();
    showToast(how === 'shared' ? t('parentMsgSent') : t('copiedToClipboard'));
  };

  const canSendInApp = ready && guardians.length > 0 && !sending;

  /**
   * Deliver inside the app, to each linked guardian. `startThread` is
   * get-or-create, so a teacher who writes twice reuses the same conversation
   * rather than stacking threads.
   *
   * `sending` guards the double-tap: there is no rate limit on `/messaging/*`
   * to catch a second press, so a duplicate note would simply be delivered.
   */
  const onSendInApp = async () => {
    if (!canSendInApp) return;
    const names = guardians.map(g => `${g.firstName} ${g.lastName}`.trim());
    // A letter to a parent can't be unsent, so say who it reaches before it goes.
    const ok = await confirm({
      title: t('parentMsgConfirmTitle'),
      message: t('parentMsgRecipients', names.join(nameSeparator)),
      confirmLabel: t('parentMsgConfirmSend'),
      cancelLabel: t('cancel'),
    });
    if (!ok) return;
    setSending(true);
    // Each guardian is a separate send, so a failure can land halfway. Track
    // who actually got it: those letters did go, and must be logged and said.
    const reached: string[] = [];
    // The messages the letter became — logged with it, so «مقروءة» can mean
    // the parent saw this letter rather than opened the thread for anything.
    const sentIds: string[] = [];
    try {
      for (const [i, g] of guardians.entries()) {
        const thread = await startThread(g.userId);
        const sent = await sendMessage(thread.id, letter.text, attachment ?? undefined);
        sentIds.push(sent.id);
        reached.push(names[i]);
      }
      recordContact('in_app', sentIds);
      rememberSignature();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('parentMsgSentInApp'));
    } catch (e) {
      if (reached.length > 0) {
        recordContact('in_app', sentIds);
        rememberSignature();
        showToast(t('parentMsgPartialSend', reached.join(nameSeparator), names.slice(reached.length).join(nameSeparator)));
        // Only the ones still waiting stay as recipients, so a retry can't
        // hand the same letter twice to a parent who already has it.
        setGuardians(guardians.slice(reached.length));
      } else {
        // The server's own wording here is already teacher-facing ("You are not
        // connected to this person"), so it beats a generic failure line.
        showToast(e instanceof MessagingError ? e.message : t('messagingSendError'));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <ToolHeader topPad={topPad} isRTL={isRTL} title={t('parentMsgTitle')} subtitle={t('parentMsgSubtitle')} leading="✉️" sourceBadge={false} />

        <View style={{ padding: 20 }}>
          <Field label={t('parentMsgStudentName')} colors={colors} isRTL={isRTL}>
            <TextInput
              value={studentName}
              // Editing the name by hand drops the picked student, and with it
              // the in-app send. Picking «أحمد» and typing over the name must
              // never leave the note pointed at Ahmad's parent — fail back to
              // sharing rather than deliver to a guardian nobody chose.
              onChangeText={(v) => { setStudentName(v); setPickedStudentId(null); }}
              placeholder={t('parentMsgStudentNamePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              style={inputStyle(colors, isRTL)}
            />
            {/* Typing the name still works — this only saves the typing, and
                spares the spelling mistake that reaches a parent. */}
            <Pressable
              onPress={() => setPickingStudent(true)}
              style={[styles.pickLink, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              hitSlop={6}
            >
              <Ionicons name="people-outline" size={15} color={ACCENT} />
              <Text style={[styles.pickLinkText, { color: ACCENT, fontFamily: 'ReadexPro_500Medium' }]}>
                {t('pickFromMyClasses')}
              </Text>
            </Pressable>
            {summary ? (
              <View style={[styles.history, { backgroundColor: ACCENT + '10', borderRadius: colors.radius }]}>
                <Text style={[styles.historyText, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {summary.last
                    ? `${t('parentMsgHistoryLast')} ${kindEmoji(summary.last.kind)} ${kindLabel(summary.last.kind, isAr)} · ${new Date(summary.last.createdAt).toLocaleDateString(dateLocale(isAr ? 'ar' : 'en'), { day: 'numeric', month: 'short' })}${
                      // Only in-app letters can be tracked; shared/copied ones carry read: null.
                      summary.last.read == null ? '' : ` · ${t(summary.last.read ? 'parentMsgHistoryRead' : 'parentMsgHistoryUnread')}`}`
                    : t('parentMsgHistoryNone')}
                </Text>
                {Object.keys(summary.recent).length > 0 ? (
                  <Text style={[styles.historyText, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                    {`${t('parentMsgHistoryRecent')} ${MESSAGE_KINDS
                      .filter(k => summary.recent[k])
                      .map(k => `${kindLabel(k, isAr)} ×${summary.recent[k]}`)
                      .join(isAr ? '، ' : ', ')}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Field>

          <Field label={t('parentMsgStudentGender')} colors={colors} isRTL={isRTL}>
            <Segmented
              value={studentGender}
              onChange={onStudentGender}
              colors={colors} isRTL={isRTL}
              options={[
                { value: 'male', label: t('parentMsgMale') },
                { value: 'female', label: t('parentMsgFemale') },
              ]}
            />
          </Field>

          <Field label={t('parentMsgKind')} colors={colors} isRTL={isRTL}>
            <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {MESSAGE_KINDS.map(k => {
                const active = k === kind;
                return (
                  <Pressable
                    key={k}
                    onPress={() => { setKind(k); Haptics.selectionAsync(); }}
                    style={[styles.pill, {
                      backgroundColor: active ? ACCENT : colors.card,
                      borderColor: active ? ACCENT : colors.border,
                      borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    }]}
                  >
                    <Text style={{ fontSize: 13 }}>{kindEmoji(k)}</Text>
                    <Text style={[styles.pillText, {
                      color: active ? palette.primaryForeground : colors.mutedForeground,
                      fontFamily: active ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
                      marginHorizontal: 5,
                    }]}>
                      {kindLabel(k, isAr)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* A suggestion, not a switch: the teacher may have reasons to
                send the third reminder anyway. Tapping picks «دعوة لاجتماع». */}
            {summary && suggestMeeting(summary, kind) ? (
              <Pressable
                onPress={() => { setKind('meeting'); Haptics.selectionAsync(); }}
                style={[styles.history, { backgroundColor: palette.warning + '1A', borderRadius: colors.radius }]}
              >
                <Text style={[styles.historyText, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {`${kindEmoji('meeting')} ${t('parentMsgHistorySuggestMeeting')}`}
                </Text>
              </Pressable>
            ) : null}
          </Field>

          {/* The tool states plainly that it will not invent the specifics —
              the teacher is the only source for what actually happened. */}
          <Field label={needsDetails(kind) ? t('parentMsgDetailsRequired') : t('parentMsgDetails')} colors={colors} isRTL={isRTL}>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t('parentMsgDetailsPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              style={inputStyle(colors, isRTL, { minHeight: 84, textAlignVertical: 'top' })}
            />
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
              {t('parentMsgFactsNote')}
            </Text>
          </Field>

          <Field label={t('parentMsgTone')} colors={colors} isRTL={isRTL}>
            <Segmented
              value={tone}
              onChange={setTone}
              colors={colors} isRTL={isRTL}
              options={[
                { value: 'formal', label: t('parentMsgFormal') },
                { value: 'warm', label: t('parentMsgWarm') },
              ]}
            />
          </Field>

          <Field label={t('parentMsgSignature')} colors={colors} isRTL={isRTL}>
            <TextInput
              value={teacherName}
              onChangeText={setTeacherName}
              placeholder={t('parentMsgTeacherName')}
              placeholderTextColor={colors.mutedForeground}
              style={inputStyle(colors, isRTL)}
            />
            <View style={{ height: 8 }} />
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={t('parentMsgSubject')}
              placeholderTextColor={colors.mutedForeground}
              style={inputStyle(colors, isRTL)}
            />
            <View style={{ height: 8 }} />
            <Segmented
              value={teacherGender}
              onChange={setTeacherGender}
              colors={colors} isRTL={isRTL}
              options={[
                { value: 'male', label: t('parentMsgTeacherMale') },
                { value: 'female', label: t('parentMsgTeacherFemale') },
              ]}
            />
          </Field>
        </View>

        {/* Preview */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.label, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('parentMsgPreview')}
          </Text>
          <View style={[styles.preview, {
            backgroundColor: colors.card, borderColor: letter.stale ? palette.warning : ready ? ACCENT + '40' : colors.border,
            borderRadius: colors.radius,
          }]}>
            {hasLetter ? (
              // Editable in place. Until the teacher types here the fields
              // drive the letter; after, their wording is what gets sent.
              <TextInput
                value={letter.text}
                onChangeText={onEditLetter}
                multiline
                maxLength={MAX_LETTER_LENGTH}
                accessibilityHint={t('parentMsgPreviewHint')}
                scrollEnabled={false}
                onContentSizeChange={e => setLetterHeight(Math.max(120, e.nativeEvent.contentSize.height))}
                style={{
                  color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 28,
                  textAlign: isRTL ? 'right' : 'left', textAlignVertical: 'top', height: letterHeight, padding: 0,
                  outlineStyle: 'none' as never,
                }}
              />
            ) : (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center', paddingVertical: 20 }}>
                {t('parentMsgNeedsName')}
              </Text>
            )}
          </View>

          {hasLetter ? (
            <View style={[styles.editRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.historyText, {
                flex: 1,
                color: letter.stale ? palette.warning : colors.mutedForeground,
                textAlign: isRTL ? 'right' : 'left',
              }]}>
                {letter.stale ? t('parentMsgEditedStale') : letter.edited ? t('parentMsgEdited') : t('parentMsgPreviewHint')}
              </Text>
              {letter.edited ? (
                <Pressable onPress={() => { setEdit(null); Haptics.selectionAsync(); }} hitSlop={6}>
                  <Text style={[styles.pickLinkText, { color: ACCENT, fontFamily: 'ReadexPro_500Medium' }]}>
                    {t('parentMsgRestore')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Attachment. Only the in-app send can carry a file — the OS share
              path here is text-only — so the note says so rather than letting
              a teacher believe WhatsApp got the photo too. */}
          {hasLetter ? (
            attachment ? (
              <View style={[styles.attachChip, {
                borderColor: colors.border, borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              }]}>
                {attachmentKind(attachment) === 'image'
                  ? <Image source={{ uri: attachment }} style={styles.attachThumb} resizeMode="cover" />
                  : <Ionicons name="document-text-outline" size={22} color={ACCENT} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
                    {t(attachmentKind(attachment) === 'image' ? 'parentMsgAttachedPhoto' : 'parentMsgAttachedPdf')}
                  </Text>
                  <Text style={[styles.historyText, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('parentMsgAttachInAppOnly')}
                  </Text>
                </View>
                <Pressable onPress={() => setAttachment(null)} hitSlop={8} accessibilityLabel={t('parentMsgRemoveAttachment')}>
                  <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ) : (
              <View style={[styles.attachRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="attach-outline" size={16} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>{t('parentMsgAttach')}</Text>
                {([['image-outline', 'parentMsgAttachPhoto', pickChatImage], ['document-outline', 'parentMsgAttachPdf', pickOnePdf]] as const).map(([icon, label, pick]) => (
                  <Pressable
                    key={label}
                    onPress={() => onAttach(pick)}
                    style={[styles.pill, {
                      backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row', gap: 5,
                    }]}
                  >
                    <Ionicons name={icon} size={15} color={ACCENT} />
                    <Text style={[styles.pillText, { color: colors.foreground, fontFamily: 'Almarai_400Regular' }]}>{t(label)}</Text>
                  </Pressable>
                ))}
              </View>
            )
          ) : null}

          {/* Two ways out, labelled for the difference. In-app delivery is the
              real send; sharing hands the text to the OS and is what teachers
              have today. Collapsing them into one «أرسل» would mean the same
              tap sometimes reaches a parent and sometimes only fills a
              clipboard, with nothing on screen to say which. */}
          {/* Above the button, not under it: the teacher reads this before the
              tap — either who the letter will reach, or why it can't. */}
          {ready ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 12, textAlign: isRTL ? 'right' : 'left' }}>
              {guardians.length > 0
                ? t('parentMsgRecipients', guardians.map(g => `${g.firstName} ${g.lastName}`).join(nameSeparator))
                : pickedStudentId ? t('parentMsgNoGuardian') : t('parentMsgPickForSend')}
            </Text>
          ) : null}
          <Pressable
            onPress={onSendInApp}
            disabled={!canSendInApp}
            style={({ pressed }) => [styles.primaryBtn, {
              backgroundColor: ACCENT_FILL, borderRadius: colors.radius,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              marginTop: 12,
              opacity: !canSendInApp ? 0.4 : pressed ? 0.88 : 1,
            }]}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="paper-plane-outline" size={18} color="#fff" />}
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 14 }}>{t('parentMsgSendInApp')}</Text>
          </Pressable>

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginTop: 10 }}>
            <Pressable
              onPress={onShare}
              disabled={!ready}
              style={[styles.secondaryBtn, {
                flex: 1,
                borderColor: colors.border, borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: ready ? 1 : 0.4,
              }]}
            >
              <Ionicons name="share-outline" size={16} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{t('parentMsgShare')}</Text>
            </Pressable>
            <Pressable
              onPress={onCopy}
              disabled={!ready}
              style={[styles.secondaryBtn, {
                borderColor: colors.border, borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: ready ? 1 : 0.4,
              }]}
            >
              <Ionicons name="copy-outline" size={16} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{t('copy')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <StudentPickerSheet
        visible={pickingStudent}
        onClose={() => setPickingStudent(false)}
        onPick={onPickStudent}
      />
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: 8 },
  pillRow: { flexWrap: 'wrap', gap: 8 },
  pickLink: { alignItems: 'center', gap: 6, marginTop: 8 },
  pickLinkText: { fontSize: 13 },
  history: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  historyText: { fontSize: 13, lineHeight: 21, fontFamily: 'Almarai_400Regular' },
  pill: { alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1.5 },
  pillText: { fontSize: 13 },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  preview: { borderWidth: 1.5, padding: 16, marginTop: 4 },
  editRow: { alignItems: 'flex-start', gap: 10, marginTop: 8 },
  attachRow: { alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  attachChip: { alignItems: 'center', gap: 10, marginTop: 12, padding: 10, borderWidth: 1 },
  attachThumb: { width: 44, height: 44, borderRadius: 6 },
  primaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 18, borderWidth: 1.5 },
});
