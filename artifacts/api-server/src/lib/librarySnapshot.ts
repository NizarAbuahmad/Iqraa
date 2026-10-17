/**
 * What a Library item looked like when a teacher put it somewhere: a class's
 * shelf (POST /classes/:id/resources) or a homework (routes/homework.ts).
 *
 * A staff upload is never taken from the app: title, kind and link are copied
 * from its own `library_resources` row. A premade sheet or a book-QR code lives
 * in the app's bundle, so the snapshot the app sent (already validated by
 * `parseClassResourceInput`) is used as is.
 */
import { db, libraryResources } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ClassResourceInput } from "./classResource.js";
import { publicUrl } from "./r2.js";

export interface LibrarySnapshot {
  title: string;
  mediaKind: string;
  url: string | null;
  thumbnailUrl: string | null;
}

/** null when a staff upload's Library row does not exist. */
export async function libraryItemSnapshot(input: ClassResourceInput): Promise<LibrarySnapshot | null> {
  if (input.source !== "uploaded") {
    return { title: input.title, mediaKind: input.mediaKind, url: input.url, thumbnailUrl: input.thumbnailUrl };
  }
  const [item] = await db.select().from(libraryResources).where(eq(libraryResources.id, input.nativeId)).limit(1);
  if (!item) return null;
  return {
    title: item.titleAr,
    mediaKind: item.category,
    url: item.r2Key ? publicUrl(item.r2Key) : item.sourceUrl,
    thumbnailUrl: item.thumbnailUrl,
  };
}
