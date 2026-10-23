/**
 * The icon and colour of each Library shelf, as pure data (the tsx screen
 * cannot be loaded by `node --test`; `services/__tests__/iconSystem.test.ts`
 * pins this file).
 *
 * Three shelves ARE teaching concepts and take icon and colour from `CONCEPTS`
 * (constants/icons.ts): worksheets, games and presentations (the slides
 * concept). The other six are kinds of file, not concepts, and have a colour of
 * their own. They used to borrow concept colours by accident (infographic was
 * the quiz's violet, image the homework's cyan, template a twin of the lesson
 * plan's indigo) and the audio shelf was `#B45309`, exactly `palette.live`, the
 * amber that means "now".
 *
 * The rules the test holds the six to: white text at 4.5:1; not in the amber
 * hue band; at least CIEDE2000 7 from every concept colour; and, because all
 * nine are on screen at once, at least 8 apart from each other on the light
 * card (7 after `readableOn` has lifted them for the dark one). That leaves
 * deep, saturated mid-tones: the concept palette already fills the bright ones.
 */
import { conceptOf, type ConceptId, type IconName } from './icons.ts';
import type { Shelf } from '../services/resourceCatalog.ts';

/** Shelves that are a teaching concept. */
export const SHELF_CONCEPT: Partial<Record<Shelf, ConceptId>> = {
  game: 'games',
  worksheet: 'worksheet',
  presentation: 'slides',
};

/** Shelves that are a kind of file. Outline glyphs, like `RESOURCE_KIND_ICON`. */
const OWN_LOOK: Partial<Record<Shelf, { icon: IconName; color: string }>> = {
  infographic: { icon: 'bar-chart-outline', color: '#9C0D71' },
  image: { icon: 'images-outline', color: '#20576F' },
  video: { icon: 'play-circle-outline', color: '#DC2626' },
  audio: { icon: 'headset-outline', color: '#115F40' },
  template: { icon: 'copy-outline', color: '#96412C' },
  document: { icon: 'folder-open-outline', color: '#475569' },
};

const SHELVES = ['infographic', 'image', 'video', 'audio', 'game', 'worksheet', 'template', 'presentation', 'document'] as const satisfies readonly Shelf[];

const lookOf = (shelf: Shelf): { icon: IconName; color: string } => {
  const concept = SHELF_CONCEPT[shelf];
  return concept ? conceptOf(concept) : OWN_LOOK[shelf]!;
};

export const SHELF_ICON = Object.fromEntries(SHELVES.map(s => [s, lookOf(s).icon])) as Record<Shelf, IconName>;

/** Icon colours. Drawn on a card, so a screen lifts them with `readableOn(…, colors.card, 3)`. */
export const SHELF_COLOR = Object.fromEntries(SHELVES.map(s => [s, lookOf(s).color])) as Record<Shelf, string>;
