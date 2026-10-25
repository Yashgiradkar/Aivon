import { internal } from "../../../_generated/api";
import { Id } from "../../../_generated/dataModel";
import { ModerationPipeline, validateAgentOutput } from "../security";
import { estimateTokens } from "../context";
import { MemoryManagerLogic } from "../memory/memoryManager";
import { ConversationRouter } from "./router";
import { OrchestrationPlanner } from "./planner";
import { OrchestrationExecutor } from "./executor";
import { OrchestrationTelemetry } from "./observability";
import {
  CapabilityContext,
  OrchestrationRequest,
  OrchestrationResponse,
  OrchestrationStatus,
} from "./types";

export * from "./types";
export * from "./registry";
export * from "./router";
export * from "./planner";
export * from "./executor";
export * from "./policies";
export * from "./observability";

/**
 * Authoritative Multi-Agent Conversation Orchestrator
 *
 * Coordinates specialized capabilities (Support Agent, Retrieval, Escalation, Resolution, Quality)
 * with deterministic intent routing, execution plans, output safety, and execution persistence.
 */
export async function orchestrateConversationTurn(
  ctx: any,
  request: OrchestrationRequest
): Promise<OrchestrationResponse> {
  const startTime = Date.now();
  const traceId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = request.channel || "chat";
  const idempotencyKey =
    request.idempotencyKey ||
    `orch_${request.conversationId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  OrchestrationTelemetry.logExecutionStart({
    traceId,
    organizationId: request.organizationId,
    conversationId: request.conversationId,
    threadId: request.threadId,
    channel,
    promptLength: request.prompt.length,
  });

  // 1. Idempotency Check
  const existingExecution = await ctx.runQuery(
    internal.system.orchestrations.getByIdempotencyKey,
    {
      idempotencyKey,
      organizationId: request.organizationId,
    }
  );

  if (
    existingExecution &&
    (existingExecution.status === "completed" || existingExecution.status === "escalated") &&
    existingExecution.finalResponse
  ) {
    return {
      executionId: String(existingExecution._id),
      status: existingExecution.status,
      responseMessage: existingExecution.finalResponse,
      routingCategory: existingExecution.routingCategory as any,
      evidenceCitations: [],
      totalLatencyMs: existingExecution.latencyMs || 0,
      totalTokensUsed: existingExecution.totalTokensUsed || 0,
      escalatedToHuman: existingExecution.status === "escalated",
      resolved: false,
      plan: JSON.parse(existingExecution.executionPlan),
    };
  }

  // 2. Input Moderation
  const moderation = ModerationPipeline.moderateInput(request.prompt);
  const cleanPrompt = moderation.sanitizedText;

  // 3. Customer Long-Term Memory Retrieval
  let memoryContext: string | undefined;
  try {
    const contactSession = await ctx.runQuery(
      internal.system.contactSessions.getOne,
      { contactSessionId: request.contactSessionId }
    );
    const customerIdentifier = contactSession?.email || String(request.contactSessionId);

    const activeMemories = await ctx.runQuery(
      internal.system.memory.getActiveCustomerMemories,
      {
        organizationId: request.organizationId,
        customerIdentifier,
      }
    );

    if (activeMemories && activeMemories.length > 0) {
      const memoryBlock = MemoryManagerLogic.formatMemoryPromptBlock(activeMemories, 300);
      if (memoryBlock) {
        memoryContext = memoryBlock;
      }
    }
  } catch {
    // Graceful fallback if memory query fails
  }

  // 4. Intent Classification & Plan Construction
  const routingCategory = ConversationRouter.classifyIntent(cleanPrompt);
  const plan = OrchestrationPlanner.createPlan(routingCategory, cleanPrompt);

  OrchestrationTelemetry.logPlanCreated({
    traceId,
    organizationId: request.organizationId,
    conversationId: request.conversationId,
    routingCategory,
    plan,
  });

  // 5. Record Execution Start
  const executionRecord = await ctx.runMutation(
    internal.system.orchestrations.recordExecutionStart,
    {
      organizationId: request.organizationId,
      conversationId: request.conversationId,
      threadId: request.threadId,
      triggerMessage: cleanPrompt,
      idempotencyKey,
      channel,
      routingCategory,
      executionPlan: JSON.stringify(plan),
    }
  );

  const executionId: Id<"orchestrationExecutions"> = executionRecord._id;

  // 6. Capability Context Setup
  const capabilityContext: CapabilityContext = {
    organizationId: request.organizationId,
    conversationId: request.conversationId,
    threadId: request.threadId,
    contactSessionId: request.contactSessionId,
    channel,
    customerIdentifier: String(request.contactSessionId),
    userPrompt: cleanPrompt,
    memoryContext,
  };

  // 7. Execute Plan
  const { finalResult, stepResults, totalLatencyMs } =
    await OrchestrationExecutor.executePlan(ctx, plan, capabilityContext);

  // 8. Output Moderation & Leak Prevention
  let responseText = finalResult.output;
  if (responseText) {
    const outputMod = ModerationPipeline.moderateOutput(responseText);
    const validated = validateAgentOutput(outputMod.sanitizedText);
    responseText = validated.sanitizedResponse || responseText;
  } else if (finalResult.status === "escalation_required") {
    responseText = "I have connected you with our human support team. A specialist will assist you shortly.";
  } else {
    responseText = "I am ready to help. Please let me know what you need assistance with.";
  }

  const estimatedInputTokens = estimateTokens(cleanPrompt);
  const estimatedOutputTokens = estimateTokens(responseText);
  const totalTokensUsed = estimatedInputTokens + estimatedOutputTokens;

  // 9. Determine Final Orchestration Status
  let orchestrationStatus: OrchestrationStatus = "completed";
  if (finalResult.status === "escalation_required" || routingCategory === "escalation_request") {
    orchestrationStatus = "escalated";
  } else if (finalResult.status === "permanent_failure" || finalResult.status === "timeout") {
    orchestrationStatus = "failed";
  }

  // 10. Persist Completion State
  await ctx.runMutation(internal.system.orchestrations.recordExecutionComplete, {
    executionId,
    status: orchestrationStatus,
    stepResults: JSON.stringify(stepResults),
    finalResponse: responseText,
    error: finalResult.error,
    latencyMs: totalLatencyMs,
    totalTokensUsed,
  });

  OrchestrationTelemetry.logExecutionCompleted({
    traceId,
    organizationId: request.organizationId,
    conversationId: request.conversationId,
    threadId: request.threadId,
    result: finalResult,
    totalLatencyMs,
    tokensUsed: totalTokensUsed,
    routingCategory,
  });

  return {
    executionId: String(executionId),
    status: orchestrationStatus,
    responseMessage: responseText,
    routingCategory,
    evidenceCitations: finalResult.evidence || [],
    totalLatencyMs,
    totalTokensUsed,
    escalatedToHuman: orchestrationStatus === "escalated",
    resolved: routingCategory === "resolution_request",
    plan,
  };
}
