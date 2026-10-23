// artifacts/mobile/services/statusBarRequests.ts
/**
 * Light status-bar icons are requested, not set. Each focused screen with a dark
 * top under the status bar holds one request; the icons are light while any is
 * held. Setting the style directly on focus and back on blur depends on event
 * order, and the order is wrong for a push: a newly mounted screen's focus
 * effect runs before the navigator blurs the screen it covers, so that screen's
 * "back to default" lands last. A count does not care who goes first.
 * Pure (no react-native import) so `node --test` can load it.
 */
export type BarStyle = 'light-content' | 'default';

export function createBarStyleRequests(set: (style: BarStyle) => void) {
  let held = 0;
  return {
    /** Hold a request; the returned function releases it, once. */
    request(): () => void {
      held++;
      set('light-content');
      let released = false;
      return () => {
        if (released) return;
        released = true;
        held--;
        set(held > 0 ? 'light-content' : 'default');
      };
    },
  };
}
