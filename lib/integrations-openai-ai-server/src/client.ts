import OpenAI from "openai";
import { resolveOpenAIConfig } from "./env";

const { apiKey, baseURL } = resolveOpenAIConfig();

// The SDK default is 10 minutes × 3 attempts, far past Cloud Run's 300 s, and a
// stalled call held in singleFlight blocks every teacher asking for that lesson.
// 120 s × 2 attempts stays inside the request timeout.
export const openai = new OpenAI({
  apiKey,
  baseURL,
  timeout: 120_000,
  maxRetries: 1,
});
