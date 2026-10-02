/**
 * React Query keys for the roster screens.
 *
 * Shared rather than declared per screen because the class detail screen
 * changes what the class *list* shows (its student count) and has to
 * invalidate the list's entry — two private copies of `['classes']` is how
 * one of them drifts and the invalidation silently stops matching. Lives in
 * services/ so it stays free of React Native imports.
 */
export const CLASSES_QUERY_KEY = ['classes'] as const;

/** Route-scoped: each class id gets its own cache entry. */
export const classQueryKey = (id: string) => ['class', id] as const;
