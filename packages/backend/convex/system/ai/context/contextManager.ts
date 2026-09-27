import { estimateTokens, estimateMessageTokens } from "./tokenEstimator";
import { wrapUntrustedUserInput, wrapRetrievedKnowledge } from "../security/sanitizer";

export interface ContextAssemblyOptions {
  systemPrompt: string;
  retrievedKnowledge?: string;
  persistentSummary?: string;
  recentMessages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  currentUserInput: string;
  maxTotalTokens?: number;
}

export interface AssembledContext {
  formattedPrompt: string;
  estimatedTokens: number;
  includedMessageCount: number;
  truncated: boolean;
}

/**
 * Context Window Manager with Sliding Window and Context Overflow Protection.
 * Assembles system instructions, RAG context, conversation summary, and recent messages.
 */
export function buildContextWindow(options: ContextAssemblyOptions): AssembledContext {
  const maxBudget = options.maxTotalTokens ?? 4000;
  const systemTokens = estimateTokens(options.systemPrompt);
  const userTokens = estimateTokens(options.currentUserInput);

  let remainingBudget = maxBudget - (systemTokens + userTokens + 100); // 100 token buffer

  // 1. Add retrieved knowledge if available
  let knowledgeBlock = "";
  if (options.retrievedKnowledge) {
    const knowledgeTokens = estimateTokens(options.retrievedKnowledge);
    if (knowledgeTokens <= remainingBudget * 0.4) {
      knowledgeBlock = wrapRetrievedKnowledge(options.retrievedKnowledge);
      remainingBudget -= knowledgeTokens;
    } else {
      // Truncate knowledge to 40% of remaining budget
      const sliceLength = Math.floor(remainingBudget * 0.4 * 3.6);
      knowledgeBlock = wrapRetrievedKnowledge(options.retrievedKnowledge.slice(0, sliceLength) + "\n[Truncated...]");
      remainingBudget -= Math.floor(remainingBudget * 0.4);
    }
  }

  // 2. Add persistent summary if available
  let summaryBlock = "";
  if (options.persistentSummary) {
    summaryBlock = `\n<prior_conversation_summary>\n${options.persistentSummary}\n</prior_conversation_summary>\n`;
    remainingBudget -= estimateTokens(summaryBlock);
  }

  // 3. Sliding window over recent messages (from newest to oldest)
  const selectedMessages: Array<{ role: string; content: string }> = [];
  let includedCount = 0;
  let isTruncated = false;

  const reversed = [...options.recentMessages].reverse();
  for (const msg of reversed) {
    const msgTokens = estimateTokens(msg.content) + 4;
    if (remainingBudget >= msgTokens) {
      selectedMessages.unshift(msg);
      remainingBudget -= msgTokens;
      includedCount++;
    } else {
      isTruncated = true;
      break;
    }
  }

  // 4. Assemble final structured context
  const parts: string[] = [];
  if (knowledgeBlock) parts.push(knowledgeBlock);
  if (summaryBlock) parts.push(summaryBlock);

  if (selectedMessages.length > 0) {
    const historyText = selectedMessages
      .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${m.content}`)
      .join("\n");
    parts.push(`<recent_messages>\n${historyText}\n</recent_messages>`);
  }

  parts.push(wrapUntrustedUserInput(options.currentUserInput));

  const formattedPrompt = parts.join("\n\n");
  const totalTokens = systemTokens + estimateTokens(formattedPrompt);

  return {
    formattedPrompt,
    estimatedTokens: totalTokens,
    includedMessageCount: includedCount,
    truncated: isTruncated,
  };
}
