import { maskPIIForLogging } from "../security/sanitizer";
import { estimateCostUsd } from "./costCalculator";

export type ObservabilityEvent =
  | "llm.request"
  | "llm.response"
  | "llm.error"
  | "rag.search"
  | "tool.call"
  | "tool.error"
  | "guardrail.violation"
  | "queue.enqueue";

export interface LogPayload {
  event: ObservabilityEvent;
  organizationId?: string;
  conversationId?: string;
  threadId?: string;
  traceId?: string;
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Structured Observability Logger
 * Redacts secrets & PII, calculates cost metrics, and outputs clean JSON for log drains.
 */
export function logAIOperation(payload: LogPayload): void {
  const now = new Date().toISOString();
  const traceId = payload.traceId || `tr_${Math.random().toString(36).substring(2, 9)}`;

  let costUsd = payload.costUsd;
  if (costUsd === undefined && payload.model && payload.inputTokens !== undefined) {
    costUsd = estimateCostUsd(payload.model, payload.inputTokens, payload.outputTokens || 0);
  }

  const structured = {
    timestamp: now,
    traceId,
    event: payload.event,
    organizationId: payload.organizationId || "unknown",
    conversationId: payload.conversationId || "unknown",
    threadId: payload.threadId || "unknown",
    model: payload.model,
    latencyMs: payload.latencyMs,
    inputTokens: payload.inputTokens,
    outputTokens: payload.outputTokens,
    costUsd,
    error: payload.error ? maskPIIForLogging(payload.error) : undefined,
    details: payload.details,
  };

  // Structured single-line JSON log
  console.log(JSON.stringify(structured));
}
