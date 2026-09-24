/**
 * Smart Whiteboard — type a prompt, display it big on the projector.
 *
 * Deliberately not a drawing canvas: a teacher poses a question or an idea in
 * text and the class reads it off the screen. No AI call, nothing saved —
 * the whole tool is a text box and a full-screen display of it, reusing the
 * same projector chrome (deck palette, fullscreen toggle) as Slides Maker and
 * Class Challenge so it looks like it belongs next to them.
 */
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { Button } from '@/components/ui/Button';
import { DECK_BG, DECK_TEXT } from '@/services/deckTheme';
import { canFullscreen, toggleFullscreen } from '@/services/presentationUtils';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;

export default function WhiteboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  const [text, setText] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  if (presenting) {
    return (
      <View style={[styles.stage, { backgroundColor: DECK_BG }]}>
        <Text
          style={[styles.stageText, { color: DECK_TEXT, textAlign: 'center', writingDirection: isRTL ? 'rtl' : 'ltr' }]}
        >
          {text}
        </Text>

        <View style={[styles.stageControls, { top: insets.top + 16, [isRTL ? 'left' : 'right']: 16 } as any]}>
          {canFullscreen && (
            <Pressable onPress={toggleFullscreen} style={styles.stageBtn} hitSlop={12}>
              <Ionicons name={isFullscreen ? 'contract-outline' : 'expand-outline'} size={20} color={DECK_TEXT} />
            </Pressable>
          )}
          <Pressable onPress={() => setPresenting(false)} style={styles.stageBtn} hitSlop={12}>
            <Ionicons name="create-outline" size={20} color={DECK_TEXT} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', flex: 1 }}>
        <ToolHeader topPad={topPad} isRTL={isRTL} title={t('toolWhiteboardTitle')} subtitle={t('toolWhiteboardDesc')} leading={{ icon: 'easel-outline' }} sourceBadge={false} />

        <View style={{ padding: 20, gap: 12, flex: 1 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('whiteboardPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            multiline
            autoFocus
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.card,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
                fontFamily: 'Almarai_400Regular',
              },
            ]}
          />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }}>
            {t('whiteboardHint')}
          </Text>

          <Button
            label={t('whiteboardDisplayButton')}
            onPress={() => setPresenting(true)}
            disabled={!text.trim()}
            fullWidth
            size="lg"
            style={{ marginTop: 'auto' }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    lineHeight: 28,
    textAlignVertical: 'top',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  stageText: { fontFamily: 'Cairo_700Bold', fontSize: 44, lineHeight: 58 },
  stageControls: { position: 'absolute', flexDirection: 'row', gap: 8 },
  stageBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});
