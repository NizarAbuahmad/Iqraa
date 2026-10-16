/**
 * The English corner's pictures: one curated emoji per word that has an honest
 * single picture. Shared by the hub's games (`artifacts/mobile/services/englishHub`)
 * and the grammar generator (`englishGrammar.ts`), so the teacher's grammar
 * sheet and the app agree on which items have a picture.
 */
/**
 * Concrete, common nouns only, each with one clean, unambiguous emoji — no
 * near-duplicates ("hill" next to "mountain"), no adjectives/adverbs/phrases
 * (nothing to draw for "carefully" or "arrive on time"), no institutions
 * ("school nurse", "headteacher" — compound and abstract). This is a curated
 * subset by design: about a third of the 458 hub words have no honest single
 * picture, and forcing one in would make the game itself untrustworthy.
 *
 * Values are unique — two different words never share an emoji — so two cards
 * in the same round are never visually identical for different reasons.
 *
 * A plural word shows more than one of the thing (🍎🍎 for "apples"): the
 * book teaches "apples", and a single apple beside it says "apple". A glyph
 * that already shows several (🧦, 👀, 🍇) stands as it is.
 *
 * 🧥 is a coat, so it stands for "coat", not "jacket" — a jacket is shorter,
 * and there is no jacket emoji, so "jacket" has no picture. 👕 is a T-shirt;
 * "shirt" gets the collared 👔. (Both from a Grade 1 teacher's review,
 * 2026-10-15, with the plurals above.)
 */
const WORD_EMOJI: Record<string, string> = {
  one: '1️⃣', two: '2️⃣', three: '3️⃣', four: '4️⃣', five: '5️⃣',
  six: '6️⃣', seven: '7️⃣', eight: '8️⃣', nine: '9️⃣', ten: '🔟',
  blue: '🔵', green: '🟢', orange: '🟠', red: '🔴', yellow: '🟡',
  brown: '🟤', black: '⚫', pink: '🩷', purple: '🟣', white: '⚪',
  boy: '👦', girl: '👧', mum: '👩', dad: '👨', grandad: '👴', granny: '👵',
  // ('bag' is dropped, not given its own emoji: 🎒 is precisely "backpack",
  // and a generic school bag has no other clean, distinct glyph.)
  cat: '🐱', frog: '🐸', giraffe: '🦒', lizard: '🦎', monkey: '🐒',
  snake: '🐍', spider: '🕷️', tiger: '🐯', zebra: '🦓', duck: '🦆',
  fish: '🐟', hamster: '🐹', mouse: '🐭', parrot: '🦜', rabbit: '🐰',
  tortoise: '🐢', hippo: '🦛', elephant: '🐘', crocodile: '🐊', penguin: '🐧',
  eagle: '🦅', kangaroo: '🦘', cow: '🐄', donkey: '🫏', horse: '🐴',
  goat: '🐐', sheep: '🐑', bird: '🐦', bee: '🐝', turkey: '🦃',
  dinosaur: '🦕', robot: '🤖', teddy: '🧸', doll: '🪆',
  book: '📖', crayon: '🖍️', pen: '🖊️', pencil: '✏️',
  ruler: '📏', scissors: '✂️', computer: '💻', chair: '🪑', door: '🚪',
  window: '🪟', teacher: '🧑‍🏫', wall: '🧱', ball: '⚽', car: '🚗', train: '🚂', plane: '✈️',
  kite: '🪁', bike: '🚲', scooter: '🛴', puzzle: '🧩', yoyo: '🪀',
  boots: '👢👢', dress: '👗', coat: '🧥', jeans: '👖', shirt: '👔', 'T-shirt': '👕',
  shoes: '👟👟', hat: '🎩', scarf: '🧣', socks: '🧦', glasses: '👓',
  backpack: '🎒', phone: '📱',
  arms: '💪💪', hands: '👐', legs: '🦵🦵', feet: '🦶🦶',
  apple: '🍎', apples: '🍎🍎', banana: '🍌', carrot: '🥕', carrots: '🥕🥕',
  grapes: '🍇', potato: '🥔', rice: '🍚', tomato: '🍅', bread: '🍞',
  cheese: '🧀', chicken: '🍗', eggs: '🥚🥚', milk: '🥛', water: '💧',
  juice: '🧃', lemons: '🍋🍋', cakes: '🍰🍰', sweets: '🍬🍬', coconut: '🥥',
  burger: '🍔', kiwi: '🥝', mango: '🥭', cereal: '🥣', noodles: '🍜',
  olives: '🫒', salad: '🥗', sandwiches: '🥪🥪', vegetables: '🥦🥕',
  coffee: '☕', tea: '🍵',
  sunny: '☀️', rainy: '🌧️', cloudy: '☁️', snowy: '❄️', windy: '💨',
  hot: '🥵', cold: '🥶',
  bathroom: '🛁', bedroom: '🛏️', kitchen: '🍳', house: '🏠',
  city: '🏙️', forest: '🌲', island: '🏝️', mountain: '⛰️', town: '🏘️',
  bridge: '🌉', zoo: '🦁', museum: '🏛️', hotel: '🏨', restaurant: '🍽️',
  market: '🏪', 'train station': '🚉', 'bus stop': '🚏', 'car park': '🅿️',
  doctor: '🩺', nurse: '🧑‍⚕️', firefighter: '🧑‍🚒', astronaut: '🧑‍🚀',
  pilot: '🧑‍✈️', 'police officer': '👮', builder: '👷', chef: '🧑‍🍳',
  artist: '🧑‍🎨', farmer: '🧑‍🌾', scientist: '🧑‍🔬', carpenter: '🔨',
  bus: '🚌', boat: '⛵', motorbike: '🏍️', underground: '🚇',
  eyes: '👀', mouth: '👄', nose: '👃', teeth: '🦷🦷',
  Egypt: '🇪🇬', Jordan: '🇯🇴', Qatar: '🇶🇦', Spain: '🇪🇸',
  'the United Kingdom': '🇬🇧', 'the United Arab Emirates': '🇦🇪',
  happy: '😊', sad: '😢',
  candle: '🕯️', present: '🎁', invitation: '💌', wedding: '💍',
  'big wheel': '🎡', rollercoaster: '🎢', costume: '🎭',
  sofa: '🛋️', television: '📺', mirror: '🪞', clock: '🕐',
  keys: '🔑🔑', handbag: '👜',
};

/**
 * The curated picture for a word, or null. Flashcards and Speaking show it
 * above the word, the way the book prints each word under its picture — an
 * emoji standing in for the book's art, so a word with none shows text alone.
 */
export function wordPicture(word: string): string | null {
  return WORD_EMOJI[word] ?? null;
}

/** Whether a word has a curated emoji at all — exported so the "renders nothing" floor is testable directly. */
export function isPicturable(word: string): boolean {
  return wordPicture(word) !== null;
}
