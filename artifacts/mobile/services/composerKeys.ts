/**
 * Keyboard rules for the chat composer.
 *
 * The composer is a `multiline` TextInput, and react-native-web fires
 * `onSubmitEditing` for a multiline input only when `blurOnSubmit` is set —
 * which would also blur the field after every send. So on web the decision is
 * made in `onKeyPress` instead, and it lives here, out of the screen, so the
 * three cases that matter can be pinned by `node --test`.
 */

export type ComposerKey = {
  key: string | undefined;
  shiftKey: boolean;
  /** An IME is mid-composition; Enter then commits the candidate, not the message. */
  isComposing: boolean;
};

export function shouldSendOnEnter(e: ComposerKey): boolean {
  return e.key === 'Enter' && !e.shiftKey && !e.isComposing;
}
