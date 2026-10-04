/**
 * How each kind of Library resource reads and looks — shared by the Library
 * screen and a class's Resources tab, so a video is the same icon and word in
 * both. Lived inline in `app/curriculum/resources.tsx`; a second screen needing
 * it is the point at which a copy would start to drift.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { ResourceKind } from '@/services/resourceCatalog';
import type { TranslationKey } from '@/services/i18n';

export const RESOURCE_KIND_LABEL: Record<ResourceKind, TranslationKey> = {
  infographic: 'libraryCatInfographic',
  video: 'libraryCatVideo',
  audio: 'libraryCatAudio',
  game: 'libraryCatGame',
  worksheet: 'libraryCatWorksheet',
  template: 'libraryCatTemplate',
  presentation: 'libraryCatPresentation',
  document: 'libraryCatDocument',
  image: 'qrKindImage',
  page: 'qrKindPage',
};

export const RESOURCE_KIND_ICON: Record<ResourceKind, keyof typeof Ionicons.glyphMap> = {
  infographic: 'bar-chart-outline',
  video: 'play-circle-outline',
  audio: 'musical-notes-outline',
  game: 'game-controller-outline',
  worksheet: 'document-text-outline',
  template: 'copy-outline',
  presentation: 'easel-outline',
  document: 'document-outline',
  image: 'image-outline',
  page: 'globe-outline',
};
