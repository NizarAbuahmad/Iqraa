/**
 * The help-center video shelf: short tutorial videos for the signed-in role, at the top
 * of the FAQ screen. It draws NOTHING when the reader has no video to see, which is all
 * of v1 until the first real entry is added to HELP_VIDEOS.
 *
 * The data and every rule about who sees what live in services/helpVideos.ts (pure,
 * tested); this file only draws and opens. Design:
 * docs/superpowers/specs/2026-10-27-help-center-video-shelf-design.md.
 *
 * - A tap opens the video through `openExternal`: an in-app browser on a phone (the
 *   back gesture returns), a new tab on web. There is no player to ship.
 * - Phone-width: one row that scrolls sideways. Wide: a wrapping grid of three.
 * - RTL: the row is reversed and starts scrolled to its far end. Two triggers do it, as
 *   the FAQ's chip row does: `onContentSizeChange`, and a 60 ms timer, because on web the
 *   first call can fire before the scroller has a width.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Entrance } from '@/components/ui/Entrance';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { trackEvent } from '@/services/analytics';
import { openExternal } from '@/services/externalLinks';
import {
  HELP_VIDEOS,
  formatVideoLength,
  helpVideoPlayUrl,
  helpVideoThumbnailUrl,
  helpVideosFor,
  narrationTagVisible,
  type HelpVideo,
} from '@/services/helpVideos';
import { tourRoleOf } from '@/services/tour';

/** Play button and length pill sit on the picture, so they are the same in both themes. */
const ON_SCRIM = '#FFFFFF';
const SCRIM = '#000000B3';

/** Window width from which the FAQ column (at most 760, 16 pt of padding each side) is wide enough for a grid. */
const WIDE_FROM = 640;
const PHONE_CARD_MAX = 260;
const PHONE_CARD_SHARE = 0.72;

function HelpVideoCard({ video, onOpen }: { video: HelpVideo; onOpen: () => void }) {
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL, lang } = useLanguage();
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumb = helpVideoThumbnailUrl(video);
  const title = t(video.titleKey);
  const length = formatVideoLength(video.seconds);
  const align = isRTL ? 'right' : 'left';
  // The Arabic comma reads right only in Arabic; an English screen gets an English comma.
  const separator = lang === 'en' ? ', ' : '، ';

  return (
    <PressableScale
      onPress={onOpen}
      accessibilityLabel={`${title}${separator}${length}. ${t('helpVideoOpensInBrowser')}`}
      style={[surface, styles.card]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.secondary }]}>
        {/* A thumbnail that fails to load (offline, a removed video) leaves the plain tile; the play button still says "video". */}
        {thumb && !thumbFailed ? (
          <Image
            source={{ uri: thumb }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityElementsHidden
            onError={() => setThumbFailed(true)}
          />
        ) : null}
        <View style={styles.play}>
          <Ionicons name="play" size={ICON.lg} color={ON_SCRIM} />
        </View>
        <View style={[styles.length, isRTL ? { left: SPACE.sm } : { right: SPACE.sm }]}>
          <Text style={styles.lengthText}>{length}</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, textAlign: align }]}>
          {title}
        </Text>
        {narrationTagVisible(video, lang) ? (
          <Text style={[styles.tag, { color: colors.mutedForeground, textAlign: align }]}>
            {t('helpVideoNarrationAr')}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** `query` is the FAQ search box: typing there narrows the shelf by title too. */
export function HelpVideoShelf({ query }: { query: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const role = tourRoleOf(user?.role);
  const videos = useMemo(() => helpVideosFor(HELP_VIDEOS, role, query, t), [role, query, t]);
  const wide = width >= WIDE_FROM;

  // Same pattern as the FAQ's chip row: onContentSizeChange alone is not enough on web, where it can
  // fire before the scroller has a width. Only the phone row scrolls; the wide grid has no scroll.
  useEffect(() => {
    if (!isRTL || wide) return;
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(id);
  }, [isRTL, wide]);

  if (!role || videos.length === 0) return null;

  const rowDir = isRTL ? 'row-reverse' : 'row';
  const cardWidth = Math.min(PHONE_CARD_MAX, Math.round(width * PHONE_CARD_SHARE));

  const open = (video: HelpVideo) => {
    trackEvent('help_video_opened', { id: video.id, role, surface: 'faq' });
    void openExternal(helpVideoPlayUrl(video));
  };

  const cards = videos.map((video, i) => (
    <Entrance key={video.id} index={i} style={wide ? styles.gridCell : { width: cardWidth }}>
      <HelpVideoCard video={video} onOpen={() => open(video)} />
    </Entrance>
  ));

  return (
    <View>
      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}
      >
        {t('helpVideosTitle')}
      </Text>
      {wide ? (
        <View style={[styles.grid, { flexDirection: rowDir }]}>{cards}</View>
      ) : (
        <ScrollView
          ref={scroller}
          horizontal
          style={styles.scroller}
          showsHorizontalScrollIndicator={false}
          // A reversed row still opens scrolled to its far end; bring the first card into view.
          onContentSizeChange={() => {
            if (isRTL) scroller.current?.scrollToEnd({ animated: false });
          }}
          contentContainerStyle={[styles.row, { flexDirection: rowDir }]}
        >
          {cards}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.label },
  // A scroller clips whatever leaves its bounds, and the card shadow (ELEVATION.card, 0 4px 14px) reaches
  // 18 pt below and 14 pt to each side. So the scroller reaches SPACE.lg into the FAQ's own padding and the
  // content is padded by the same amount: the shadow has room and the first card still meets the column edge.
  scroller: { marginHorizontal: -SPACE.lg },
  // flexGrow so a reversed (Arabic) row fills the scroller and hugs the start edge.
  row: { gap: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.xl, paddingHorizontal: SPACE.lg, flexGrow: 1 },
  grid: { flexWrap: 'wrap', gap: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.xl },
  // Fixed at a third of the row, so a lone fourth card keeps the width of the others rather than filling the row.
  gridCell: { flexBasis: '31%', flexGrow: 0, flexShrink: 0 },
  // No border and no overflow here: useSurface() draws the shadow or the border, and a clip would cut the shadow.
  card: { minHeight: 44 },
  thumb: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    backgroundColor: SCRIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  length: {
    position: 'absolute',
    bottom: SPACE.sm,
    backgroundColor: SCRIM,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
  },
  lengthText: { color: ON_SCRIM, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption },
  meta: { padding: SPACE.md, gap: SPACE.xs },
  title: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, lineHeight: 21 },
  tag: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption },
});
