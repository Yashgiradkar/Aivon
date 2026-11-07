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

function sanitizeLogDetails(obj: unknown): unknown {
  if (typeof obj === "string") {
    return maskPIIForLogging(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeLogDetails);
  }
  if (obj && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      sanitized[k] = sanitizeLogDetails(v);
    }
    return sanitized;
  }
  return obj;
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
    details: payload.details ? (sanitizeLogDetails(payload.details) as Record<string, unknown>) : undefined,
  };

  // Structured single-line JSON log
  console.log(JSON.stringify(structured));
}
