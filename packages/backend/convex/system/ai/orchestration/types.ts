import { Id } from "../../../_generated/dataModel";

export type OrchestrationChannel = "chat" | "voice" | "operator";

export type OrchestrationStatus =
  | "queued"
  | "running"
  | "completed"
  | "escalated"
  | "waiting_for_approval"
  | "failed"
  | "cancelled";

export type RoutingCategory =
  | "greeting"
  | "knowledge_query"
  | "policy_exact_lookup"
  | "escalation_request"
  | "resolution_request"
  | "complex_multi_step";

export type TaskOutcomeStatus =
  | "success"
  | "insufficient_evidence"
  | "retryable_failure"
  | "permanent_failure"
  | "auth_failure"
  | "timeout"
  | "escalation_required";

export interface EvidenceCitation {
  documentId: string;
  documentName: string;
  snippet: string;
  score?: number;
  format?: "table" | "chart" | "prose" | "code";
}

export interface NormalizedCapabilityResult {
  status: TaskOutcomeStatus;
  output: string;
  evidence?: EvidenceCitation[];
  tokensUsed?: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  requiresHumanApproval?: boolean;
  approvalReason?: string;
  error?: string;
}

export interface CapabilityContext {
  organizationId: string;
  conversationId: Id<"conversations">;
  threadId: string;
  contactSessionId: Id<"contactSessions">;
  channel: OrchestrationChannel;
  customerIdentifier: string;
  customerName?: string;
  userPrompt: string;
  memoryContext?: string;
  priorTaskOutputs?: Record<string, NormalizedCapabilityResult>;
}

export interface CapabilityDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  isReadOnly: boolean;
  requiresApproval: boolean;
  defaultTimeoutMs: number;
  timeoutMs?: number;
  maxRetries: number;
  supportedChannels?: OrchestrationChannel[];
  execute: (ctx: any, capabilityContext: CapabilityContext, inputArgs?: Record<string, unknown>) => Promise<NormalizedCapabilityResult>;
}

export interface TaskPlan {
  taskId: string;
  id?: string;
  capabilityId: string;
  capability?: string;
  description?: string;
  dependsOn?: string[];
  dependencies?: string[];
  isParallel?: boolean;
  priority?: number;
  inputArgs?: Record<string, unknown>;
  inputPayload?: Record<string, unknown>;
  abortOnFailure?: boolean;
  status?: string;
  delegationDepth?: number;
}

export interface ExecutionPlan {
  planId: string;
  routingCategory: RoutingCategory;
  tasks: TaskPlan[];
  estimatedComplexity?: "low" | "medium" | "high";
  requiresApproval?: boolean;
  maxSteps?: number;
  budgetTimeoutMs?: number;
  createdTimestamp?: number;
}

export interface OrchestrationRequest {
  organizationId: string;
  conversationId: Id<"conversations">;
  threadId: string;
  contactSessionId: Id<"contactSessions">;
  prompt: string;
  channel?: OrchestrationChannel;
  idempotencyKey?: string;
  maxBudgetMs?: number;
}

export interface OrchestrationResponse {
  executionId: string;
  status: OrchestrationStatus;
  responseMessage: string;
  routingCategory: RoutingCategory;
  evidenceCitations: EvidenceCitation[];
  totalLatencyMs: number;
  totalTokensUsed: number;
  escalatedToHuman: boolean;
  resolved: boolean;
  plan: ExecutionPlan;
}
