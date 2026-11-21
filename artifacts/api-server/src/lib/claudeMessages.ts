/**
 * OpenAI-shaped chat messages in, a Claude request out.
 *
 * Chat, the exam generator and the photo-marking routes build their prompts in
 * OpenAI's chat shape: a `system` message in the list, images as `image_url`
 * parts. Claude's API keeps the system text in its own field and takes images
 * as `source` blocks. When OpenAI refuses the account, `aiComplete.ts` sends
 * the same prompt to Claude through this conversion.
 *
 * Pure, and free of both SDKs, so `node --test` can load it. A wrong conversion
 * would not throw — it would send a different prompt — which is why every branch
 * has a test.
 */
import type Anthropic from "@anthropic-ai/sdk";

export type AiPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string | AiPart[];
};

/** An image the other provider cannot read (a HEIC photo, an SVG, a bare file path). */
export class UnsupportedImageError extends Error {
  constructor(detail: string) {
    super(`Claude cannot read this image: ${detail}`);
    this.name = "UnsupportedImageError";
  }
}

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type ImageBlock = Anthropic.ImageBlockParam;

function toImageBlock(url: string): ImageBlock {
  const data = /^data:([^;,]+);base64,(.+)$/is.exec(url);
  if (data) {
    const mediaType = data[1]!.toLowerCase();
    if (!MEDIA_TYPES.has(mediaType)) throw new UnsupportedImageError(mediaType);
    return {
      type: "image",
      source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: data[2]! },
    };
  }
  if (/^data:/i.test(url)) throw new UnsupportedImageError("a data URL that is not base64");
  if (/^https:\/\//i.test(url)) return { type: "image", source: { type: "url", url } };
  throw new UnsupportedImageError("not a data URL or an https URL");
}

export function toClaudeRequest(messages: AiMessage[]): { system: string; messages: Anthropic.MessageParam[] } {
  const system: string[] = [];
  const out: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      const text = typeof m.content === "string"
        ? m.content
        : m.content.map((p) => (p.type === "text" ? p.text : "")).join("");
      if (text) system.push(text);
      continue;
    }

    if (typeof m.content === "string") {
      // Claude rejects an empty text block; OpenAI let one through.
      if (m.content) out.push({ role: m.role, content: m.content });
      continue;
    }

    const blocks: Array<Anthropic.TextBlockParam | ImageBlock> = [];
    for (const part of m.content) {
      if (part.type === "text") {
        if (part.text) blocks.push({ type: "text", text: part.text });
      } else {
        blocks.push(toImageBlock(part.image_url.url));
      }
    }
    if (blocks.length > 0) out.push({ role: m.role, content: blocks });
  }

  return { system: system.join("\n\n"), messages: out };
}
