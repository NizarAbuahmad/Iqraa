/**
 * One Math Corner tool, full screen.
 *
 * The id in the URL is shareable and untrusted: it resolves through
 * `resolveMathParam` or the screen says it could not find the tool. The share
 * button copies `mathShareUrl` (the production origin plus the tool path), so a
 * pasted link opens the web app on every platform.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { MATH_TOOLS, mathShareUrl, resolveMathParam } from '@/services/mathTools';
import { copyToClipboard } from '@/services/share';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { MathTool } from '@/components/math/MathTool';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

export default function MathToolScreen() {
  const { toolId } = useLocalSearchParams<{ toolId: string }>();
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);

  const id = resolveMathParam(toolId);
  if (!id) {
    return (
      <CornerFrame title={t('mathTitle')}>
        <Text style={[styles.missing, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('mathNotFound')}
        </Text>
      </CornerFrame>
    );
  }

  const meta = MATH_TOOLS[id];
  const copyLink = async () => {
    try {
      await copyToClipboard(mathShareUrl(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (insecure web origin, permissions). Nothing to
      // recover: the button simply does not confirm.
    }
  };

  return (
    <CornerFrame title={t(meta.titleKey)} subtitle={t(meta.hintKey)}>
      <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={copyLink}
          accessibilityRole="button"
          style={[styles.copy, { backgroundColor: colors.muted, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name={copied ? 'checkmark' : 'link-outline'} size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>
            {copied ? t('mathLinkCopied') : t('mathCopyLink')}
          </Text>
        </Pressable>
      </View>
      <MathTool toolId={id} />
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32 },
  actions: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  copy: { alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill },
});
