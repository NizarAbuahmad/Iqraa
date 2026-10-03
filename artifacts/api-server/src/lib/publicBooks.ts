/**
 * The book list an unauthenticated caller may see.
 *
 * `GET /curriculum/books` is public — no session, no role — and it used to
 * ask the catalog for the *teacher* view. That listed the teacher-guide books
 * themselves (`audience: 'teacher'`, today hidden by the MVP book list
 * anyway) and handed out every `guidePdfUrl`,
 * the field `catalog.ts` documents as «Hidden from students». The app's own
 * screen already hides it from students (`subjects.tsx`); this endpoint did not.
 *
 * Defence in depth, said plainly: most guide links are the ministry's own
 * public NCCD URLs, and the catalog ships inside the app bundle. What this
 * closes is the one place a stranger could list them without the app — the
 * same answer a student gets, not a teacher's.
 */
import type { Book } from "@workspace/curriculum";

export type PublicBook = Omit<Book, "guidePdfUrl">;

export function publicBook(book: Book): PublicBook {
  const { guidePdfUrl: _guide, ...rest } = book;
  return rest;
}
