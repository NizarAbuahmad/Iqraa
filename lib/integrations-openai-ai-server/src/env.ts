/**
 * Resolve OpenAI client settings for local and hosted environments.
 * Prefers legacy Replit integration names, then standard OPENAI_* names.
 */
export function resolveOpenAIConfig(): { apiKey: string; baseURL: string } {
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error(
      "OpenAI API key missing. Set OPENAI_API_KEY (recommended) or AI_INTEGRATIONS_OPENAI_API_KEY.",
    );
  }

  return { apiKey, baseURL };
}
