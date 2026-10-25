import { logAIOperation } from "../observability/logger";
import { ExecutionPlan, NormalizedCapabilityResult, RoutingCategory } from "./types";

export class OrchestrationTelemetry {
  public static logExecutionStart(params: {
    traceId: string;
    organizationId: string;
    conversationId: string;
    threadId: string;
    channel: string;
    promptLength: number;
  }): void {
    logAIOperation({
      event: "llm.request",
      traceId: params.traceId,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      threadId: params.threadId,
      details: {
        stage: "orchestration.started",
        channel: params.channel,
        promptLength: params.promptLength,
      },
    });
  }

  public static logPlanCreated(params: {
    traceId: string;
    organizationId: string;
    conversationId: string;
    routingCategory: RoutingCategory;
    plan: ExecutionPlan;
  }): void {
    logAIOperation({
      event: "llm.request",
      traceId: params.traceId,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      details: {
        stage: "orchestration.plan_created",
        category: params.routingCategory,
        taskCount: params.plan.tasks.length,
        complexity: params.plan.estimatedComplexity,
      },
    });
  }

  public static logStepOutcome(params: {
    traceId: string;
    stepId: string;
    capability: string;
    status: string;
    latencyMs?: number;
    error?: string;
  }): void {
    logAIOperation({
      event: params.status === "permanent_failure" ? "llm.error" : "llm.response",
      traceId: params.traceId,
      latencyMs: params.latencyMs,
      details: {
        stage: "orchestration.step_completed",
        stepId: params.stepId,
        capability: params.capability,
        status: params.status,
      },
      error: params.error,
    });
  }

  public static logExecutionCompleted(params: {
    traceId: string;
    organizationId: string;
    conversationId: string;
    threadId: string;
    result: NormalizedCapabilityResult;
    totalLatencyMs: number;
    tokensUsed: number;
    routingCategory: RoutingCategory;
  }): void {
    logAIOperation({
      event: params.result.status === "permanent_failure" ? "llm.error" : "llm.response",
      traceId: params.traceId,
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      threadId: params.threadId,
      latencyMs: params.totalLatencyMs,
      outputTokens: params.tokensUsed,
      details: {
        stage: "orchestration.completed",
        status: params.result.status,
        category: params.routingCategory,
        hasEvidence: !!(params.result.evidence && params.result.evidence.length > 0),
      },
      error: params.result.error,
    });
  }
}
