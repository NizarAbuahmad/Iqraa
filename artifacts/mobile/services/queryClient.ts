/**
 * The app's one react-query cache, in its own module so the auth layer can
 * empty it. Every screen that uses react-query shares this client, so when the
 * open account changes (switch, sign-out, a different person signing in on the
 * same phone) whatever it holds belongs to someone else and must go before the
 * next account's first render.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();
