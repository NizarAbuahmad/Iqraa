import OpenAI from "openai";
import { resolveOpenAIConfig } from "./env";

const { apiKey, baseURL } = resolveOpenAIConfig();

export const openai = new OpenAI({
  apiKey,
  baseURL,
});
