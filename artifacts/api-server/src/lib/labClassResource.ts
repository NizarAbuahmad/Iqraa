/**
 * Science Lab items on a class's shelf (routes/roster.ts,
 * POST /classes/:id/resources with `kind: "lab"`).
 *
 * A lab item lives in code (`@workspace/curriculum/lab`), so the server can
 * check it. That is why the request carries only an id: the id must be a real
 * item, and the title stored is the catalogue's, never the app's. A row is a
 * pointer plus that snapshot, the same shape a Library row has; the table
 * needs no change because `class_resources.kind` is plain text.
 *
 * Spec: docs/superpowers/specs/2026-10-07-lab-class-workflow-design.md
 */
import { getLabItem } from "@workspace/curriculum/lab";

export const LAB_KIND = "lab" as const;
const MAX_ITEM_ID = 200;

export function parseLabClassResourceInput(body: unknown): { itemId: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "A JSON body is required" };
  const b = body as Record<string, unknown>;
  if (b["kind"] !== LAB_KIND) return { error: "kind must be lab" };
  const itemId = typeof b["itemId"] === "string" ? b["itemId"].trim() : "";
  if (!itemId || itemId.length > MAX_ITEM_ID) return { error: "itemId is required" };
  if (!getLabItem(itemId)) return { error: "itemId is not a lab item" };
  return { itemId };
}

export function labClassResourceSnapshot(
  itemId: string,
): { title: string; mediaKind: "lab"; url: null; thumbnailUrl: null } | null {
  const item = getLabItem(itemId);
  if (!item) return null;
  return { title: item.titleAr, mediaKind: "lab", url: null, thumbnailUrl: null };
}
