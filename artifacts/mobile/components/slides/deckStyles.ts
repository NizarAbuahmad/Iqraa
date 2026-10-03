import { StyleSheet } from 'react-native';
import { palette } from '@/constants/colors';

/** Both slide screens' accent; the shared deck components draw with it. */
export const DECK_ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
export const DECK_ACCENT_FILL = palette.hero;

/** Styles the deck components share — previously duplicated per screen. */
export const deckStyles = StyleSheet.create({
  slideNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ctaBtn: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginBottom: 10 },
  secondaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderWidth: 1.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  modalCard: { padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 17, marginBottom: 12 },
  modalLabel: { fontSize: 12, marginBottom: 6, marginTop: 8 },
  modalInput: { borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalInputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  modalHint: { fontSize: 11, lineHeight: 17, marginTop: -4, marginBottom: 2 },
  suggestBtn: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 14, marginTop: 8, marginBottom: 4 },
});
