/**
 * What the waiting screen (`app/guardian-waiting.tsx`) says and offers, as a pure function so the rules are
 * tested. No imports on purpose: `node --test` loads this file.
 *
 * `status` is `user.guardianStatus` while the server holds the account. `maskedEmail` is the address the server
 * last sent a link to. For a `needed` account it is only present when that link has expired, so a `needed`
 * status with an address means "your link ran out", and the screen says so.
 */
export type HeldStatus = 'needed' | 'waiting' | 'declined' | undefined;

export interface GuardianWaitingView {
  titleKey: 'guardianNeededTitle' | 'guardianWaitingTitle' | 'guardianDeclinedTitle';
  descKey: 'guardianNeededDesc' | 'guardianWaitingDesc' | 'guardianDeclinedDesc' | 'guardianExpiredDesc';
  /** The masked address, for the two descriptions that print it. */
  descArg?: string;
  /** Show the parent-email form. */
  askForEmail: boolean;
  /** Show "use a different email" instead of the form. */
  offerChange: boolean;
}

export function guardianWaitingView(input: {
  status: HeldStatus;
  editing: boolean;
  maskedEmail?: string | null;
}): GuardianWaitingView {
  const { status, editing } = input;
  const masked = input.maskedEmail ?? '';

  if (editing) {
    return { titleKey: 'guardianNeededTitle', descKey: 'guardianNeededDesc', askForEmail: true, offerChange: false };
  }
  if (status === 'declined') {
    return { titleKey: 'guardianDeclinedTitle', descKey: 'guardianDeclinedDesc', askForEmail: true, offerChange: false };
  }
  if (status === 'waiting') {
    return { titleKey: 'guardianWaitingTitle', descKey: 'guardianWaitingDesc', descArg: masked, askForEmail: false, offerChange: true };
  }
  if (masked) {
    return { titleKey: 'guardianNeededTitle', descKey: 'guardianExpiredDesc', descArg: masked, askForEmail: true, offerChange: false };
  }
  return { titleKey: 'guardianNeededTitle', descKey: 'guardianNeededDesc', askForEmail: true, offerChange: false };
}
