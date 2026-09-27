import assert from "node:assert/strict";
import { estimateTokens } from "../../packages/backend/convex/system/ai/context/tokenEstimator";
import { buildContextWindow } from "../../packages/backend/convex/system/ai/context/contextManager";
import { CircuitBreaker } from "../../packages/backend/convex/system/ai/routing/circuitBreaker";
import { rerankSearchResults } from "../../packages/backend/convex/system/ai/rag/reranker";

export async function runContextAndRoutingTests(): Promise<void> {
  console.log("Running Context & Routing Unit Tests...");

  // Test 1: Token estimation
  const count = estimateTokens("Hello world! This is a test sentence.");
  assert.ok(count > 0 && count < 25);

  // Test 2: Context window assembly with sliding window
  const context = buildContextWindow({
    systemPrompt: "You are a helpful assistant.",
    retrievedKnowledge: "Aivon offers real-time AI customer support.",
    recentMessages: [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! How can I help?" },
      { role: "user", content: "Tell me about pricing" },
    ],
    currentUserInput: "What are your tiers?",
    maxTotalTokens: 500,
  });

  assert.ok(context.formattedPrompt.includes("<untrusted_user_input>"));
  assert.ok(context.formattedPrompt.includes("<retrieved_knowledge_base>"));
  assert.ok(context.formattedPrompt.includes("<recent_messages>"));
  assert.ok(context.estimatedTokens > 0);

  // Test 3: Circuit Breaker state transitions
  const cb = new CircuitBreaker(2, 500);
  assert.equal(cb.getState(), "CLOSED");

  cb.recordFailure();
  assert.equal(cb.getState(), "CLOSED");
  cb.recordFailure();
  assert.equal(cb.getState(), "OPEN");

  // Fallback execution when circuit is OPEN
  const fallbackResult = await cb.execute(
    async () => "success",
    async () => "fallback_executed"
  );
  assert.equal(fallbackResult, "fallback_executed");

  // Test 4: Reranking with keyword heuristic
  const rerank = await rerankSearchResults(
    "pricing plans",
    [
      { title: "General FAQ", text: "We support multiple features." },
      { title: "Pricing Guide", text: "Our pricing plans start at $29/mo." },
    ],
    2
  );
  assert.equal(rerank.reranked, true);
  assert.equal(rerank.entries[0]?.title, "Pricing Guide");

  console.log("✅ All Context, Routing & RAG Unit Tests Passed Successfully!");
}

runContextAndRoutingTests().catch(console.error);
