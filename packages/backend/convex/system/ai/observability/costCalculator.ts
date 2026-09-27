/**
 * AI Cost Calculator
 *
 * Estimates USD cost for token usage across different OpenAI models.
 */

const MODEL_RATES_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
  "text-embedding-3-small": { input: 0.02, output: 0.00 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number = 0
): number {
  const rates = MODEL_RATES_PER_1M[model] ?? MODEL_RATES_PER_1M["gpt-4o-mini"]!;
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return Number((inputCost + outputCost).toFixed(6));
}
