/**
 * ⌘K — the whole app from one line.
 *
 * Desktop web only, and mounted beside the tab navigator rather than inside a
 * screen: it has to answer on every tab, and a copy per screen would drift the
 * way the tool list did before `toolCatalog` existed. What the commands *are*
 * lives in `services/commandPalette.ts` (and is tested there); this renders
 * them and runs the one that is picked.
 *
 * Keyboard handling sits on `document`, not on the TextInput: RN Web's
 * `onKeyPress` does not report the arrow keys, and Enter inside a
 * single-line input would submit before the list had a chance to say which row
 * was highlighted.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { buildCommands, filterCommands, type Command, type NavEntry } from '@/services/commandPalette';

const CARD_WIDTH = 620;

export function CommandPalette({
  nav,
  lessonTopic,
  lessonParams,
  enabled,
}: {
  nav: NavEntry[];
  lessonTopic: string | null;
  /** Grade/subject/topic every tool command is opened with — see buildCommands. */
  lessonParams?: Record<string, string>;
  /** Desktop web only — a phone has no ⌘K and no room for this card. */
  enabled: boolean;
}) {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<TextInput>(null);

  const commands = useMemo(
    () =>
      buildCommands({
        lang: lang as 'ar' | 'en',
        nav,
        lessonTopic,
        lessonParams,
        t: (k) => t(k as never),
      }),
    [lang, nav, lessonTopic, lessonParams, t],
  );
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  // `active` is an index into a list that shrinks as the query narrows: without
  // this, typing past the highlighted row left Enter pointing at nothing.
  const clamped = results.length === 0 ? 0 : Math.min(active, results.length - 1);

  const run = useCallback((cmd: Command) => {
    setOpen(false);
    setQuery('');
    setActive(0);
    if (cmd.action === 'change-lesson') {
      router.push({ pathname: '/iqra', params: { openLessonPicker: String(Date.now()) } });
      return;
    }
    if (cmd.action === 'start-class') {
      // The workspace home owns the deck build (it holds the lesson and the
      // busy/error state); the chat's own Start Class button is a separate
      // copy on a screen this palette does not need to route through.
      router.push({ pathname: '/', params: { startClass: String(Date.now()) } });
      return;
    }
    if (cmd.action === 'ask-iqra') {
      router.push('/iqra');
      return;
    }
    if (cmd.route) {
      router.push({ pathname: cmd.route as never, params: cmd.routeParams as never });
    }
  }, []);

  // One listener for the lifetime of the palette. `openRef`/`resultsRef` keep
  // it off the dependency list — re-registering on every keystroke dropped
  // keys that arrived between the remove and the add.
  const stateRef = useRef({ open, results, clamped });
  stateRef.current = { open, results, clamped };

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setActive(0);
        return;
      }
      if (!s.open) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(i => (s.results.length ? (i + 1) % s.results.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(i => (s.results.length ? (i - 1 + s.results.length) % s.results.length : 0));
        return;
      }
      if (e.key === 'Enter') {
        const cmd = s.results[s.clamped];
        if (cmd) { e.preventDefault(); e.stopPropagation(); run(cmd); }
      }
    };
    /*
      Capture phase, not bubble: the palette's own TextInput is focused, and
      RN Web consumes Enter on a single-line input before it reaches the
      document — which is why Enter picked nothing while ⌘K, a key the input
      ignores, worked from the start. Capturing runs this first, and only for
      the keys the palette claims.
    */
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [enabled, run]);

  if (!enabled) return null;

  const sectionLabel = (kind: Command['kind']) =>
    kind === 'lesson' ? t('cmdSectionLesson') : kind === 'tool' ? t('cmdSectionTool') : t('cmdSectionNavigate');
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;

  let lastKind: Command['kind'] | null = null;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        {/* Swallows the backdrop press so a click inside the card does not close it. */}
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <View style={[styles.inputRow, { borderBottomColor: colors.border, flexDirection: rowDir }]}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              autoFocus
              value={query}
              onChangeText={(v) => { setQuery(v); setActive(0); }}
              placeholder={t('cmdPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, textAlign: align }]}
              accessibilityLabel={t('cmdPlaceholder')}
            />
            <View style={[styles.kbd, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.kbdText, { color: colors.mutedForeground }]}>esc</Text>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground, textAlign: align }]}>
                {t('cmdEmpty')}
              </Text>
            ) : (
              results.map((cmd, i) => {
                const header = cmd.kind !== lastKind ? sectionLabel(cmd.kind) : null;
                lastKind = cmd.kind;
                const on = i === clamped;
                return (
                  <View key={cmd.id}>
                    {header ? (
                      <Text style={[styles.section, { color: colors.mutedForeground, textAlign: align }]}>
                        {header}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => run(cmd)}
                      onHoverIn={() => setActive(i)}
                      style={[
                        styles.row,
                        { flexDirection: rowDir, backgroundColor: on ? colors.primary + '14' : 'transparent' },
                      ]}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={cmd.icon as never}
                        size={18}
                        color={on ? colors.primary : colors.mutedForeground}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={[styles.rowLabel, { color: on ? colors.primary : colors.foreground, textAlign: align }]}
                        >
                          {cmd.label}
                        </Text>
                        {cmd.hint ? (
                          <Text
                            numberOfLines={1}
                            style={[styles.rowHint, { color: colors.mutedForeground, textAlign: align }]}
                          >
                            {cmd.hint}
                          </Text>
                        ) : null}
                      </View>
                      {on ? <Ionicons name="return-down-back" size={15} color={colors.primary} /> : null}
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border, flexDirection: rowDir }]}>
            <View style={[styles.kbd, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.kbdText, { color: colors.mutedForeground }]}>↑↓</Text>
            </View>
            <Text style={[styles.footText, { color: colors.mutedForeground }]}>{t('cmdHintMove')}</Text>
            <View style={[styles.kbd, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <Text style={[styles.kbdText, { color: colors.mutedForeground }]}>⏎</Text>
            </View>
            <Text style={[styles.footText, { color: colors.mutedForeground }]}>{t('cmdHintOpen')}</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,27,58,0.34)',
    alignItems: 'center',
    // Not centred: a palette that jumps to the middle of a 900px window pulls
    // the eye off the content it is about to act on.
    paddingTop: 140,
  },
  card: {
    width: CARD_WIDTH,
    maxWidth: '92%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#081B3A',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  inputRow: { alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Almarai_400Regular', outlineStyle: 'none' as never },
  section: { fontSize: 11, fontFamily: 'Cairo_600SemiBold', letterSpacing: 0.4, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  row: { alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 10 },
  rowLabel: { fontSize: 14, fontFamily: 'Cairo_600SemiBold' },
  rowHint: { fontSize: 12, fontFamily: 'Almarai_400Regular', marginTop: 1 },
  empty: { fontSize: 13, fontFamily: 'Almarai_400Regular', padding: 24 },
  footer: { alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  footText: { fontSize: 11, fontFamily: 'Almarai_400Regular', marginInlineEnd: 8 },
  kbd: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  kbdText: { fontSize: 11, fontFamily: 'Almarai_400Regular' },
});
