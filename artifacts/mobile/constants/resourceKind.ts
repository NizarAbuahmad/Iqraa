/**
 * How each kind of Library resource reads and looks — shared by the Library
 * screen and a class's Resources tab, so a video is the same icon and word in
 * both. Lived inline in `app/curriculum/resources.tsx`; a second screen needing
 * it is the point at which a copy would start to drift.
 */
import { CONCEPTS, type IconName } from './icons.ts';
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
  lab: 'resourceKindLab',
};

/** A kind that is a teaching concept (worksheet, game, presentation = slides) takes its icon from `CONCEPTS`. */
export const RESOURCE_KIND_ICON: Record<ResourceKind, IconName> = {
  infographic: 'bar-chart-outline',
  video: 'play-circle-outline',
  audio: 'musical-notes-outline',
  game: CONCEPTS.games.icon,
  worksheet: CONCEPTS.worksheet.icon,
  template: 'copy-outline',
  presentation: CONCEPTS.slides.icon,
  document: 'document-outline',
  image: 'image-outline',
  page: 'globe-outline',
  lab: 'flask-outline',
};
