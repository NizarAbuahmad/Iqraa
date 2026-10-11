import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { usePrintStyle } from '@/hooks/usePrintStyle';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { openExternal } from '@/services/externalLinks';
import { trackEvent } from '@/services/analytics';
import { resolveLessonPrepContext } from '@/services/lessonPrep';
import { saveItem } from '@/services/workspace';
import { copyToClipboard, exportAsPDF, exportBuiltWord, shareAsText } from '@/services/share';
import { exportFilename } from '@/services/exportFilename';
import type { QuizCopy } from '@/services/quizExport';
import { worksheetExports } from '@/services/worksheetExport';
import { readableOn } from '@/services/readableColor';
import { virtualLabFor, virtualLabSavePayload, virtualLabWorksheet } from '@/services/virtualLab';

type Props = {
  lessonId: string;
  /** The subject colour the rest of the lesson page is themed with. */
  accent: string;
};

/**
 * The PhET simulation for a lab lesson, and the sheet that goes with it.
 *
 * **Link only.** The simulation opens on PhET's own site — PhET's licence is
 * non-commercial, so nothing is embedded or copied into the app, and the card
 * says so (`shelfLinkOnly`) with the credit the licence requires beside it.
 * Both are for everyone, students included.
 *
 * **The sheet and the key are teacher-only.** The predict–observe–explain
 * sheet exports as the student's or the teacher's copy, and the teacher's copy
 * carries the answers, so none of it is rendered for a student — not disabled,
 * absent. The rows are filed as ordinary worksheets, so موادي, class filing
 * and export need no new path.
 *
 * Renders nothing on a lesson with no released lab, which is nearly all of
 * them: `virtualLabFor` is the gate, and in dev it also lets drafts through.
 */
export function VirtualLabCard({ lessonId, accent }: Props) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const isTeacher = isTeacherRole(user?.role);

  const lab = useMemo(() => virtualLabFor(lessonId, { dev: __DEV__ }), [lessonId]);
  const ctx = useMemo(() => resolveLessonPrepContext(lessonId, 'ar'), [lessonId]);
  const ws = useMemo(
    () => (lab && ctx ? virtualLabWorksheet(lab.sheet, lab.resource, ctx.topic) : null),
    [lab, ctx],
  );

  const [showExport, setShowExport] = useState(false);
  // A teacher prints the student's copy far more often than the key, so that
  // is what the menu opens on.
  const [copy, setCopy] = useState<QuizCopy>('student');
  const [printStyle, setPrintStyle] = usePrintStyle();
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingWord, setLoadingWord] = useState(false);
  // A ref, not only state: two taps inside one frame both read the old state
  // and saved two rows.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  if (!lab) return null;
  const { resource } = lab;
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackEvent('virtual_lab_opened', { lessonId, surface: 'lesson' });
    void openExternal(resource.sourceUrl);
  };

  // Everything below needs the worksheet, which needs the lesson's own title
  // from the curriculum. If that did not resolve there is no sheet to offer.
  const canExport = isTeacher && ws !== null && ctx !== null;
  const docs = () => worksheetExports(ws!, ws!.title, { subject: ctx!.subjectLabel, grade: ctx!.gradeName }, true, copy, [], printStyle);

  const handlePDF = async () => {
    setLoadingPDF(true);
    try { await exportAsPDF(docs().html, exportFilename(ws!.title)); }
    catch { showToast(t('error')); } finally { setLoadingPDF(false); }
  };
  const handleWord = async () => {
    setLoadingWord(true);
    try { await exportBuiltWord(docs().word, exportFilename(ws!.title)); }
    catch { showToast(t('error')); } finally { setLoadingWord(false); }
  };
  const handleShare = async () => { await shareAsText(docs().text, ws!.title); };
  const handleCopy = async () => { await copyToClipboard(docs().text); showToast(t('copiedToClipboard')); };
  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await saveItem(virtualLabSavePayload(ws!, lessonId, ctx!));
      showToast(t('savedSuccess'));
    } catch { showToast(t('error')); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const exportLabels = {
    title: t('exportTitle'),
    shareLabel: t('exportShare'), shareSub: t('exportShareSub'),
    copyLabel: t('exportCopy'), copySub: t('exportCopySub'),
    pdfLabel: t('exportPDF'), pdfSub: t('exportPDFSub'),
    wordLabel: t('exportWord'), wordSub: t('exportWordSub'),
    cancel: t('cancel'),
  };

  // `accent` is the lesson page's text-on-card colour, lightened in dark mode to
  // read on the card — as a fill under white text it can fall below AA, so the
  // solid pill gets its own fill, the same split lesson-detail makes with
  // `colorFill`.
  const fill = readableOn(accent, '#FFFFFF');
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { flexDirection: rowDir }]}>
        <Text style={styles.emoji}>🔬</Text>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {t('virtualLabTitle')}
        </Text>
      </View>

      <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.simName, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {lang === 'ar' ? resource.titleAr : resource.titleEn}
        </Text>
        {/* The credit is the licence's condition for showing the link at all,
            so it is the actual string, not a summary. */}
        <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {resource.attribution}
        </Text>
        <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('shelfLinkOnly')}
        </Text>

        <View style={[styles.actions, { flexDirection: rowDir }]}>
          <Pressable
            onPress={open}
            accessibilityRole="link"
            accessibilityLabel={`${t('virtualLabOpen')} — ${resource.attribution}`}
            style={[styles.pill, { backgroundColor: fill, borderColor: fill, flexDirection: rowDir }]}
          >
            <Ionicons name="open-outline" size={14} color="#fff" />
            <Text style={[styles.pillText, { color: '#fff', fontFamily: 'ReadexPro_500Medium' }]}>
              {t('virtualLabOpen')}
            </Text>
          </Pressable>

          {canExport ? (
            <>
              <Pressable
                onPress={() => setShowExport(true)}
                accessibilityRole="button"
                style={[styles.pill, { backgroundColor: accent + '15', borderColor: accent + '30', flexDirection: rowDir }]}
              >
                <Ionicons name="document-text-outline" size={14} color={accent} />
                <Text style={[styles.pillText, { color: accent, fontFamily: 'ReadexPro_500Medium' }]}>
                  {t('virtualLabSheet')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                aria-disabled={saving}
                aria-busy={saving}
                style={[styles.pill, { backgroundColor: accent + '15', borderColor: accent + '30', flexDirection: rowDir, opacity: saving ? 0.6 : 1 }]}
              >
                <Ionicons name="bookmark-outline" size={14} color={accent} />
                <Text style={[styles.pillText, { color: accent, fontFamily: 'ReadexPro_500Medium' }]}>
                  {t('virtualLabSave')}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {canExport ? (
        <>
          <ExportMenu
            visible={showExport}
            onClose={() => setShowExport(false)}
            onShare={handleShare}
            onCopy={handleCopy}
            onPDF={handlePDF}
            onWord={handleWord}
            copyChoice={{ value: copy, onChange: setCopy }}
            printStyle={{ value: printStyle, onChange: setPrintStyle }}
            isRTL={isRTL}
            loadingPDF={loadingPDF}
            loadingWord={loadingWord}
            labels={exportLabels}
          />
          <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  sectionHeader: { alignItems: 'center', gap: 6, marginBottom: 10 },
  emoji: { fontSize: 15 },
  sectionTitle: { fontSize: 15 },
  sectionBody: { padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  simName: { fontSize: 15, lineHeight: 21 },
  note: { fontSize: 13, lineHeight: 20 },
  actions: { flexWrap: 'wrap', gap: 8, marginTop: 4 },
  pill: { alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 13 },
});
