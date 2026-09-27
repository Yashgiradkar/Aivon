import { openai } from "@ai-sdk/openai";

/**
 * Centralized Model Registry & Configuration
 *
 * Avoids hardcoding model strings across the application.
 */

export const AI_MODELS: Record<string, ReturnType<typeof openai.chat> | ReturnType<typeof openai.embedding>> = {
  primary: openai.chat("gpt-4o-mini"),
  fallback: openai.chat("gpt-4o-mini"),
  highQuality: openai.chat("gpt-4o"),
  embedding: openai.embedding("text-embedding-3-small"),
  summarizer: openai.chat("gpt-4o-mini"),
};

export type ModelRole = "primary" | "fallback" | "highQuality" | "embedding" | "summarizer";


export const TOKEN_BUDGETS = {
  customerResponse: 600,
  searchInterpreter: 400,
  escalationSummary: 300,
  operatorEnhancement: 400,
  classification: 150,
} as const;
