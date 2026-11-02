/**
 * Hands a `mailto:` link to the admin's own mail app («ردّ بالبريد» on
 * `app/admin/signups.tsx` and the feedback list in `app/admin/dashboard.tsx`).
 *
 * On web the link is assigned, not window.open'd: a mailto opened in a new tab
 * leaves an empty tab behind, and assigning it hands it to the mail app without
 * leaving the page. Nothing goes through the server.
 *
 * Returns false when there is no mail app to take it, so the caller can show the
 * address to copy instead. Kept apart from `adminReplyMail.ts`, which the mobile
 * test runner must be able to load without `react-native`.
 */
import { Linking, Platform } from 'react-native';

export async function openMailto(link: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = link;
    } else {
      await Linking.openURL(link);
    }
    return true;
  } catch {
    return false;
  }
}
