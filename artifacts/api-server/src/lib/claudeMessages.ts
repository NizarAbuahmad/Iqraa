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

type MediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const MEDIA_TYPES = new Set<string>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Claude's per-image limit. The scan routes accept up to about 6 MB, which OpenAI takes. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ImageBlock = Anthropic.ImageBlockParam;

/**
 * The type the bytes themselves say, or null when they are not a format Claude
 * reads. Claude rejects a `media_type` that disagrees with the bytes; OpenAI
 * never minded, and a phone or a browser can label a photo wrongly.
 */
function sniffMediaType(base64: string): MediaType | null {
  const head = Buffer.from(base64.slice(0, 24), "base64");
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (head.length >= 4 && head.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (head.length >= 12 && head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Decoded size from the base64 text, without decoding it. */
function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function toImageBlock(url: string): ImageBlock {
  const data = /^data:([^;,]+);base64,(.+)$/is.exec(url);
  if (data) {
    const declared = data[1]!.toLowerCase();
    const base64 = data[2]!;
    // The bytes win over the label; an unrecognised file keeps its label only if Claude reads that type.
    const mediaType = sniffMediaType(base64) ?? (MEDIA_TYPES.has(declared) ? (declared as MediaType) : null);
    if (!mediaType) throw new UnsupportedImageError(declared);
    const bytes = decodedBytes(base64);
    if (bytes > MAX_IMAGE_BYTES) {
      throw new UnsupportedImageError(`${(bytes / (1024 * 1024)).toFixed(1)} MB is over the 5 MB limit`);
    }
    return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
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

  // Claude answers 400 when the first message is not the user's. A slice of chat
  // history can start with the assistant (a greeting, an odd cut), and an empty
  // user turn removed above can leave one first.
  while (out.length > 0 && out[0]!.role === "assistant") out.shift();

  return { system: system.join("\n\n"), messages: out };
}
