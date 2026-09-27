/**
 * Lightweight Fast Token Estimator
 *
 * Provides conservative token calculations without adding heavy tokenizer dependencies.
 */

export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  // Conservative estimate: ~3.5 to 4 characters per token for English text
  return Math.ceil(text.length / 3.6);
}

export function estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
  let total = 0;
  for (const m of messages) {
    // 4 tokens baseline per message framing + content
    total += 4 + estimateTokens(m.role) + estimateTokens(m.content);
  }
  return total;
}
