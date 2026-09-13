/**
 * Curated video and images for a lesson, shown rather than linked.
 *
 * The lesson shelf already lists every external resource and opens it. This is
 * the difference between "there is a film of this experiment" and watching it
 * without leaving the lesson — which is the whole of what "see the experiment"
 * asked for, and is deliverable without any of the licensing that interactive
 * simulations turned out to need.
 *
 * **Two delivery models, and the licence decides which.** A video is embedded
 * and never copied: YouTube's terms license the iframe player, not the file.
 * An image is served from our own R2 copy, which only exists for resources
 * whose licence granted redistribution — public-domain NASA, CC-BY Wikimedia.
 * `loadExternalAsset` answers `null` for anything we may not host, and such a
 * resource simply stays on the shelf as a link.
 *
 * **`simulation` is deliberately not rendered here.** PhET relicensed to
 * CC BY-NC in March 2026 and GeoGebra requires a commercial agreement, so
 * there is no simulation this product may legally embed; a renderer for one
 * would be a code path with no lawful input. If that changes it is the same
 * iframe as the video below.
 *
 * The credit renders under every item. That is a licence condition, not a
 * courtesy — see the three export paths that silently dropped it until the
 * attribution fix.
 */
import React, { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { externalResourcesForLesson, type ExternalResource } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { youtubeEmbedUrl } from '@/services/classMedia';
import { loadExternalAsset } from '@/services/externalMedia';
import { openExternal } from '@/services/externalLinks';

/**
 * One embedded video. Web gets the player; native opens it.
 *
 * `youtubeEmbedUrl` answers null for anything that is not a YouTube link, and
 * a curated video from anywhere else must still be reachable — returning null
 * here would delete it from the page with nothing to say why, which is the
 * failure this whole panel is meant to avoid. No embed just means the same
 * "open it" button native already gets.
 */
function VideoItem({ resource, align }: { resource: ExternalResource; align: 'left' | 'right' }) {
  const colors = useColors();
  const { t } = useLanguage();
  const embed = youtubeEmbedUrl(resource.sourceUrl);

  return (
    <View style={styles.item}>
      {Platform.OS === 'web' && embed ? (
        <View style={[styles.frame, { borderColor: colors.border }]}>
          {React.createElement('iframe', {
            src: embed,
            style: { width: '100%', height: '100%', border: 'none' },
            allowFullScreen: true,
            title: resource.titleEn,
          })}
        </View>
      ) : (
        <Pressable
          onPress={() => { void openExternal(resource.sourceUrl); }}
          style={[styles.openBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <Ionicons name="play-circle" size={20} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
            {t('openMedia')}
          </Text>
        </Pressable>
      )}
      <Credit text={resource.attribution} align={align} />
    </View>
  );
}

/**
 * One image, from our own copy.
 *
 * Loads on mount rather than being handed a URL, because the URL is signed and
 * short-lived — precomputing a page's worth at render time would hand out
 * links that expire while the teacher is still reading.
 */
function ImageItem({ resource, align }: { resource: ExternalResource; align: 'left' | 'right' }) {
  const colors = useColors();
  const [url, setUrl] = useState<string | null>(null);
  const [credit, setCredit] = useState(resource.attribution);

  useEffect(() => {
    let live = true;
    void loadExternalAsset(resource.id).then(asset => {
      if (!live || !asset) return;
      setUrl(asset.url);
      // Prefer the server's copy of the credit: it read the manifest this
      // request, and the bundled one is as old as the last app build.
      setCredit(asset.attribution);
    });
    return () => { live = false; };
  }, [resource.id]);

  // No stored copy, or not loaded yet. The shelf still links to it, so there
  // is nothing to apologise for here — an empty slot is better than a broken
  // image frame on a lesson page.
  if (!url) return null;

  return (
    <View style={styles.item}>
      <Image
        source={{ uri: url }}
        style={[styles.image, { borderColor: colors.border }]}
        resizeMode="contain"
        accessibilityLabel={resource.titleEn}
      />
      <Credit text={credit} align={align} />
    </View>
  );
}

function Credit({ text, align }: { text: string; align: 'left' | 'right' }) {
  const colors = useColors();
  if (!text) return null;
  return (
    <Text style={[styles.credit, { color: colors.mutedForeground, textAlign: align }]}>
      {text}
    </Text>
  );
}

export function LessonMediaPanel({ lessonId, accent }: { lessonId: string; accent: string }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  const items = externalResourcesForLesson(lessonId).filter(
    r => r.kind === 'video' || r.kind === 'image',
  );
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="play-circle-outline" size={16} color={accent} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
          {t('lessonMediaTitle')}
        </Text>
      </View>
      <View style={[styles.body, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {items.map(r => (
          <View key={r.id} style={{ gap: 6 }}>
            <Text
              style={[styles.itemTitle, { color: colors.foreground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}
            >
              {lang === 'ar' ? r.titleAr : r.titleEn}
            </Text>
            {r.kind === 'video'
              ? <VideoItem resource={r} align={align} />
              : <ImageItem resource={r} align={align} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, gap: 8 },
  header: { alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  title: { fontSize: 15 },
  body: { marginHorizontal: 20, borderWidth: 1, borderRadius: 14, padding: 14, gap: 18 },
  item: { gap: 6 },
  itemTitle: { fontSize: 14 },
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#000',
  },
  image: { width: '100%', height: 220, borderRadius: 12, borderWidth: 1 },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  credit: { fontSize: 11, lineHeight: 18 },
});
