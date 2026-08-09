/**
 * Shared layout constants.
 *
 * The app runs on phones and in the browser from the same code. Without a cap,
 * every chat row stretches across a 1920px desktop window, which makes lines
 * unreadable and the composer look broken. Content is centred inside this
 * width on wide viewports and fills the screen on phones.
 */
export const CHAT_MAX_WIDTH = 820;

/** Reading-comfort cap for a single chat bubble inside CHAT_MAX_WIDTH. */
export const CHAT_BUBBLE_MAX_WIDTH = 620;
