/**
 * Shared layout constants.
 *
 * The app runs on phones and in the browser from the same code. Without a cap,
 * every chat row stretches across a 1920px desktop window, which makes lines
 * unreadable and the composer look broken. Content is centred inside this
 * width on wide viewports and fills the screen on phones.
 */
export const CHAT_MAX_WIDTH = 820;

/** Viewport width above which web gets desktop chrome (sidebar, grids) instead of phone layout. */
export const DESKTOP_BREAKPOINT = 900;

/** Wider content cap for grid/list screens (vs. CHAT_MAX_WIDTH's narrower reading width). */
export const CONTENT_MAX_WIDTH = 1120;
