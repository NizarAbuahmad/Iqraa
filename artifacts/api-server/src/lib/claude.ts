/**
 * One Claude completion, in the shape `generateContent` already works with.
 *
 * Why this exists: a blind comparison on 2026-10-23 put Claude Sonnet 5.5 ahead
 * of the OpenAI model the generators ran on for lesson plans, worksheets, quizzes
 * and slide decks (it won 14 of 16 groups; the OpenAI model won none and had a
 * wrong answer key or fact in 7). See STATUS.md's log for the numbers.
 *
 * Deliberately small: it returns `{ text, usage }` with the usage renamed to the
 * `prompt_tokens` / `completion_tokens` pair `recordUsage` takes, so the spend
 * guard, the serve log and the pool need no change.
 *
 * The client is built on first use. Like the OpenAI client it must never throw
 * at import time without a key — a route file that imports it has to stay
 * importable in a test.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { StreamChunk } from "./chatStream.ts";

/**
 * The ceiling is never lower than this, whatever the caller passes.
 *
 * Adaptive thinking is billed as output and counts against `max_tokens`, the
 * same trap the OpenAI ceilings fell into. The evaluation that chose this model
 * ran every document at 16000; the shared 8000 would cut a deck or a long
 * worksheet off mid-answer and the shape check would throw it away.
 */
export const CLAUDE_MIN_MAX_TOKENS = 16000;

/** Effort the comparison measured (`medium`); the default is `high`, slower and dearer. */
const DEFAULT_EFFORT = "medium";
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];

/** A document takes 15–40 s; a call still running at two minutes is not coming back. */
const REQUEST_TIMEOUT_MS = 120_000;

export type ClaudeCompletion = {
  text: string;
  usage: { prompt_tokens: number; completion_tokens: number };
};

export class ClaudeNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set, so a Claude model cannot be called.");
    this.name = "ClaudeNotConfiguredError";
  }
}

/**
 * Thrown when Claude declines the request (`stop_reason: "refusal"`).
 *
 * A refusal is a 200 with no usable text; reading `content` as if it were an
 * answer would store an empty artifact. The category says why — educational
 * content can trip a safeguard now and then, and the log must name it.
 */
export class ClaudeRefusalError extends Error {
  readonly category: string | null;
  constructor(category: string | null) {
    super(`Claude declined to answer${category ? ` (${category})` : ""}.`);
    this.name = "ClaudeRefusalError";
    this.category = category;
  }
}

let cached: Anthropic | null = null;

function client(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeNotConfiguredError();
  cached = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return cached;
}

function effortFromEnv(): Effort {
  const raw = process.env.AI_CLAUDE_EFFORT;
  return (EFFORTS as readonly string[]).includes(raw ?? "") ? (raw as Effort) : DEFAULT_EFFORT;
}

/**
 * What a caller hands over: the system text and EITHER one user prompt (the
 * document generators) OR a whole message list (chat history, a photo to read).
 */
export type ClaudeCallArgs = {
  model: string;
  system: string;
  maxTokens: number;
} & (
  | { user: string; messages?: undefined }
  | { messages: Anthropic.MessageParam[]; user?: undefined }
);

function messagesOf(args: ClaudeCallArgs): Anthropic.MessageParam[] {
  return args.messages ?? [{ role: "user", content: args.user }];
}

export async function completeWithClaude(
  args: ClaudeCallArgs,
  /** Tests hand in a client pointed at a local server. */
  deps: { client?: Anthropic } = {},
): Promise<ClaudeCompletion> {
  const msg = await (deps.client ?? client()).messages.create({
    model: args.model,
    max_tokens: Math.max(args.maxTokens, CLAUDE_MIN_MAX_TOKENS),
    system: args.system,
    thinking: { type: "adaptive" },
    output_config: { effort: effortFromEnv() },
    messages: messagesOf(args),
  });

  if (msg.stop_reason === "refusal") {
    throw new ClaudeRefusalError(msg.stop_details?.category ?? null);
  }

  // Thinking blocks are the model's working, never part of the artifact.
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    usage: { prompt_tokens: msg.usage.input_tokens, completion_tokens: msg.usage.output_tokens },
  };
}

/**
 * A streamed reply, in the chunk shape `pumpChatStream` already reads
 * (`choices[0].delta.content`, then a final chunk carrying `usage`), so the chat
 * route needs no second pump for the other provider.
 *
 * The returned promise settles once the API has ACCEPTED the request, which is
 * when an account problem (a bad key, an empty balance) shows up as a thrown
 * error — before the caller has sent a single byte to its own client, so the
 * route can still switch provider. Anything that goes wrong after that surfaces
 * from the iterator, as it does for OpenAI's stream.
 *
 * Thinking blocks are the model's working and are never forwarded; only text
 * deltas are.
 */
export async function streamWithClaude(
  args: ClaudeCallArgs & { signal?: AbortSignal },
  deps: { client?: Anthropic } = {},
): Promise<AsyncIterable<StreamChunk>> {
  const stream = await (deps.client ?? client()).messages.create(
    {
      model: args.model,
      max_tokens: Math.max(args.maxTokens, CLAUDE_MIN_MAX_TOKENS),
      system: args.system,
      thinking: { type: "adaptive" },
      output_config: { effort: effortFromEnv() },
      messages: messagesOf(args),
      stream: true,
    },
    args.signal ? { signal: args.signal } : undefined,
  );

  return (async function* (): AsyncGenerator<StreamChunk> {
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const event of stream) {
      if (event.type === "message_start") {
        inputTokens = event.message.usage.input_tokens;
        outputTokens = event.message.usage.output_tokens;
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { choices: [{ delta: { content: event.delta.text } }] };
      } else if (event.type === "message_delta") {
        outputTokens = event.usage.output_tokens ?? outputTokens;
        if (event.delta.stop_reason === "refusal") {
          // A refusal is a normal-looking stream with no more text; reading it as
          // a finished answer would send the student a reply that just stops.
          const details = (event.delta as { stop_details?: { category?: string | null } }).stop_details;
          throw new ClaudeRefusalError(details?.category ?? null);
        }
      }
    }
    yield { choices: [], usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens } };
  })();
}
