/**
 * The English corner's two link shelves under a grade's lessons: the Ministry's own
 * books for that grade, and free sites to listen and read.
 *
 * Both only open an address (`openExternal`: a new tab on web, the in-app browser on
 * native). Nothing is fetched, so a site being down costs the student one tap, not a
 * broken screen. The data is `@workspace/curriculum/englishLinks`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { englishBooksForGrade, freeSitesForGrade, type EnglishSkill } from '@workspace/curriculum/englishLinks';
import { openExternal } from '@/services/externalLinks';
import type { TranslationKey } from '@/services/i18n';
import { CornerGrid } from '@/components/corners/CornerGrid';
import { IconTile } from '@/components/ui/IconTile';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { ICON, type IconName } from '@/constants/icons';
import { SPACE, TYPE } from '@/constants/theme';

const SKILL_LABEL: Record<EnglishSkill, TranslationKey> = {
  listen: 'hubSkillListen',
  read: 'hubSkillRead',
  play: 'hubSkillPlay',
  grammar: 'hubSkillGrammar',
};

const SKILL_ICON: Record<EnglishSkill, IconName> = {
  listen: 'ear-outline',
  read: 'reader-outline',
  play: 'game-controller-outline',
  grammar: 'create-outline',
};

function Heading({ title, sub }: { title: string; sub: string }) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, textAlign: align }]}>{title}</Text>
      <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: align }]}>{sub}</Text>
    </View>
  );
}

function LinkCard({ icon, title, line, url }: { icon: IconName; title: string; line: string; url: string }) {
  const colors = useColors();
  const surface = useSurface();
  const { isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  return (
    <PressableScale
      onPress={() => { void openExternal(url); }}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${line}`}
      style={[styles.card, surface, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <IconTile icon={icon} color={colors.primary} size={44} />
      <View style={styles.cardText}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }} numberOfLines={2}>{title}</Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }} numberOfLines={3}>{line}</Text>
      </View>
      <Ionicons name="open-outline" size={ICON.sm} color={colors.mutedForeground} />
    </PressableScale>
  );
}

/** The grade's official student books (and activity books where the Ministry has one). */
export function BooksShelf({ grade }: { grade: number }) {
  const { t, lang } = useLanguage();
  const books = englishBooksForGrade(grade);
  if (books.length === 0) return null;
  return (
    <View>
      <Heading title={t('hubBooksTitle')} sub={t('hubBooksSub')} />
      <CornerGrid>
        {books.map(b => (
          <LinkCard
            key={`${b.bookId}-${b.kind}`}
            icon={b.kind === 'student' ? 'book-outline' : 'document-text-outline'}
            title={t(b.kind === 'student' ? 'hubBookStudent' : 'hubBookActivity', b.semester)}
            line={lang === 'ar' ? b.titleAr : b.title}
            url={b.url}
          />
        ))}
      </CornerGrid>
    </View>
  );
}

/** Free listening, reading, games and grammar sites that suit the grade. */
export function FreeSitesShelf({ grade }: { grade: number }) {
  const { t, lang } = useLanguage();
  const sites = freeSitesForGrade(grade);
  if (sites.length === 0) return null;
  return (
    <View>
      <Heading title={t('hubFreeTitle')} sub={t('hubFreeSub')} />
      <CornerGrid>
        {sites.map(s => {
          const skills = s.skills.map(k => t(SKILL_LABEL[k])).join(' · ');
          const note = lang === 'ar' ? s.noteAr : s.noteEn;
          return (
            <LinkCard
              key={s.id}
              icon={SKILL_ICON[s.skills[0]!]}
              title={lang === 'ar' ? s.titleAr : s.titleEn}
              line={`${skills} — ${note}`}
              url={s.url}
            />
          );
        })}
      </CornerGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.xl, gap: 2 },
  title: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg },
  sub: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption },
  card: { alignItems: 'center', gap: 12, padding: 14, flexGrow: 1 },
  cardText: { flex: 1, gap: 3 },
});
