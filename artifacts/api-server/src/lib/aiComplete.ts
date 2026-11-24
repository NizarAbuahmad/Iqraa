/**
 * One model call, whichever provider answers it.
 *
 * Routes used to call `openai.chat.completions.create` themselves. An expired
 * key or an empty balance on that account then failed every one of them, with
 * nothing to fall back on (STATUS.md, 2026-11-21). Every route now goes through
 * `completeAi` (a finished reply) or `openChatStream` (a streamed one):
 *
 *   - the model id names the provider (`claude-*` is Claude, anything else is
 *     OpenAI), so a deployment that points a workload at Claude keeps working;
 *   - if that provider refuses the ACCOUNT — a bad or revoked key, an empty
 *     balance, a model the account cannot use — and the other provider is
 *     configured, the same request is sent there once (`providerFallback.ts`);
 *   - the result says which model actually answered, because the caller records
 *     spend against it: a fallback reply billed at the first model's price would
 *     put the ledger wrong in the direction that matters.
 *
 * Only an account error switches provider. A busy server, a rate limit, a
 * refusal or a malformed reply does not: the other provider would not fix those.
 *
 * The OpenAI client is imported on first use: it throws at import time without
 * a key, and a route file that imports this one has to stay loadable in a test.
 */
import { completeWithClaude, streamWithClaude, type ClaudeCallArgs, type ClaudeCompletion } from "./claude.ts";
import { toClaudeRequest, type AiMessage } from "./claudeMessages.ts";
import { isClaudeModel } from "./aiBudget.ts";
import { withProviderFallback } from "./providerFallback.ts";
import type { StreamChunk } from "./chatStream.ts";

export type { AiMessage, AiPart } from "./claudeMessages.ts";

/** The slice of the OpenAI client this module uses. */
export type OpenAiLike = {
  chat: {
    completions: {
      create: (params: any, options?: any) => Promise<any>;
    };
  };
};

/** Tests hand in stand-ins for the two SDKs. */
export type AiDeps = {
  openai?: OpenAiLike;
  claudeComplete?: (args: ClaudeCallArgs) => Promise<ClaudeCompletion>;
  claudeStream?: (args: ClaudeCallArgs & { signal?: AbortSignal }) => Promise<AsyncIterable<StreamChunk>>;
};

export type AiUsage = { prompt_tokens?: number; completion_tokens?: number } | undefined | null;

export type AiCompletion = {
  /** The reply, or null when the provider sent none (a caller's «?? '{}'» still means what it did). */
  text: string | null;
  usage: AiUsage;
  /** The model that answered — not always the one asked for. Record spend against this. */
  model: string;
};

async function openaiClient(deps: AiDeps): Promise<OpenAiLike> {
  if (deps.openai) return deps.openai;
  const { openai } = await import("@workspace/integrations-openai-ai-server");
  return openai as unknown as OpenAiLike;
}

export async function completeAi(
  args: {
    model: string;
    messages: AiMessage[];
    maxTokens: number;
    /** For a caller that cannot wait out a slow answer. OpenAI only; Claude has its own ceiling. */
    timeoutMs?: number;
    maxRetries?: number;
  },
  deps: AiDeps = {},
): Promise<AiCompletion> {
  const attempt = async (model: string): Promise<AiCompletion> => {
    if (isClaudeModel(model)) {
      const request = toClaudeRequest(args.messages);
      const run = deps.claudeComplete ?? completeWithClaude;
      const out = await run({ model, system: request.system, messages: request.messages, maxTokens: args.maxTokens });
      return { text: out.text, usage: out.usage, model };
    }
    const client = await openaiClient(deps);
    const res = await client.chat.completions.create(
      { model, max_completion_tokens: args.maxTokens, messages: args.messages },
      args.timeoutMs !== undefined || args.maxRetries !== undefined
        ? { ...(args.timeoutMs !== undefined ? { timeout: args.timeoutMs } : {}), ...(args.maxRetries !== undefined ? { maxRetries: args.maxRetries } : {}) }
        : undefined,
    );
    return { text: res.choices?.[0]?.message?.content ?? null, usage: res.usage, model };
  };
  return withProviderFallback(args.model, attempt);
}

/**
 * Open a streamed reply. Settles once the provider has accepted the request —
 * which is when an account problem shows up — so the caller can still switch
 * provider before it has sent anything to its own client. A failure after that
 * comes out of the stream, as it always did.
 */
export async function openChatStream(
  args: { model: string; messages: AiMessage[]; maxTokens: number; signal?: AbortSignal },
  deps: AiDeps = {},
): Promise<{ stream: AsyncIterable<StreamChunk>; model: string }> {
  const attempt = async (model: string): Promise<{ stream: AsyncIterable<StreamChunk>; model: string }> => {
    if (isClaudeModel(model)) {
      const request = toClaudeRequest(args.messages);
      const open = deps.claudeStream ?? streamWithClaude;
      const stream = await open({
        model,
        system: request.system,
        messages: request.messages,
        maxTokens: args.maxTokens,
        ...(args.signal ? { signal: args.signal } : {}),
      });
      return { stream, model };
    }
    const client = await openaiClient(deps);
    const stream = await client.chat.completions.create(
      {
        model,
        max_completion_tokens: args.maxTokens,
        messages: args.messages,
        stream: true,
        stream_options: { include_usage: true },
      },
      args.signal ? { signal: args.signal } : undefined,
    );
    return { stream: stream as AsyncIterable<StreamChunk>, model };
  };
  return withProviderFallback(args.model, attempt);
}
