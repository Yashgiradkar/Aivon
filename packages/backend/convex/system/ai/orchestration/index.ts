import { internal } from "../../../_generated/api";
import { Id } from "../../../_generated/dataModel";
import { ModerationPipeline, validateAgentOutput } from "../security";
import { estimateTokens } from "../context";
import { MemoryManagerLogic } from "../memory/memoryManager";
import { ConversationRouter } from "./router";
import { OrchestrationPlanner } from "./planner";
import { OrchestrationExecutor } from "./executor";
import { OrchestrationTelemetry } from "./observability";
import { AuditMiddleware } from "../observability/auditMiddleware";
import {
  SemanticAnswerKVCache,
  SemanticCacheLogic,
} from "../cache";
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
  if (
    moderation.flagged &&
    (moderation.riskLevel === "critical" || moderation.riskLevel === "high")
  ) {
    return {
      executionId: `blocked_${traceId}`,
      status: "completed",
      responseMessage:
        "I cannot process that request because it conflicts with our safety policies. Please rephrase your question about your account or our services.",
      routingCategory: "greeting",
      evidenceCitations: [],
      totalLatencyMs: Date.now() - startTime,
      totalTokensUsed: 0,
      escalatedToHuman: false,
      resolved: false,
      plan: OrchestrationPlanner.createPlan("greeting", ""),
    };
  }
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

  // 4b. Two-Tier Semantic Answer KV Cache Check (L1 In-Memory + L2 Convex DB)
  const isKnowledgeCandidate =
    routingCategory === "knowledge_query" ||
    routingCategory === "policy_exact_lookup";

  const cacheEligibility = isKnowledgeCandidate
    ? SemanticCacheLogic.evaluateEligibility(cleanPrompt, {
        hasPersonalData: !!memoryContext,
      })
    : { eligible: false };

  if (cacheEligibility.eligible) {
    let cachedAnswer = SemanticAnswerKVCache.get(
      request.organizationId,
      cleanPrompt
    );

    if (!cachedAnswer && ctx && typeof ctx.runQuery === "function") {
      try {
        const dbEntry = await ctx.runQuery(
          internal.system.cache.lookupSemanticCache,
          {
            organizationId: request.organizationId,
            queryText: cleanPrompt,
          }
        );
        if (dbEntry) {
          cachedAnswer = {
            cacheId: dbEntry.cacheId,
            response: dbEntry.response,
            evidenceReferences: dbEntry.evidenceReferences,
            canonicalQuery: dbEntry.canonicalQuery,
            model: dbEntry.model,
          };
          SemanticAnswerKVCache.set(
            request.organizationId,
            cleanPrompt,
            cachedAnswer
          );
        }
      } catch {
        // Fallback cleanly on database lookup error
      }
    }

    if (cachedAnswer) {
      const cachedLatency = Date.now() - startTime;
      const citations = (cachedAnswer.evidenceReferences || []).map((ref, idx) => ({
        evidenceId: `CACHED-${idx + 1}`,
        documentId: ref,
        documentName: ref,
        snippet: cachedAnswer!.response,
        format: "prose" as const,
      }));

      if (cachedAnswer.cacheId && ctx && typeof ctx.runMutation === "function") {
        ctx.runMutation(internal.system.cache.recordCacheHit, {
          cacheId: cachedAnswer.cacheId as any,
        }).catch(() => {});
      }

      OrchestrationTelemetry.logExecutionCompleted({
        traceId,
        organizationId: request.organizationId,
        conversationId: request.conversationId,
        threadId: request.threadId,
        result: {
          status: "success",
          output: cachedAnswer.response,
          latencyMs: cachedLatency,
        },
        totalLatencyMs: cachedLatency,
        tokensUsed: 0,
        routingCategory,
      });

      return {
        executionId: `cached_${traceId}`,
        status: "completed",
        responseMessage: cachedAnswer.response,
        routingCategory,
        evidenceCitations: citations,
        totalLatencyMs: cachedLatency,
        totalTokensUsed: 0,
        escalatedToHuman: false,
        resolved: false,
        plan,
      };
    }
  }

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

  // 11. Write-Through to Semantic Answer KV Cache (L1 Memory + L2 DB)
  if (
    cacheEligibility.eligible &&
    orchestrationStatus === "completed" &&
    responseText &&
    finalResult.status === "success" &&
    finalResult.evidence &&
    finalResult.evidence.length > 0
  ) {
    const evidenceRefs = finalResult.evidence.map(
      (e) => e.documentName || e.documentId
    );
    SemanticAnswerKVCache.set(request.organizationId, cleanPrompt, {
      response: responseText,
      evidenceReferences: evidenceRefs,
      canonicalQuery: cleanPrompt,
      model: "gpt-4o-mini",
    });

    if (ctx && typeof ctx.runMutation === "function") {
      ctx.runMutation(internal.system.cache.recordSemanticCacheEntry, {
        organizationId: request.organizationId,
        canonicalQuery: cleanPrompt,
        response: responseText,
        evidenceReferences: evidenceRefs,
        model: "gpt-4o-mini",
      }).catch(() => {});
    }
  }

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

  if (finalResult.evidence && finalResult.evidence.length > 0) {
    AuditMiddleware.recordLineage(ctx, {
      organizationId: request.organizationId,
      traceId,
      conversationId: request.conversationId,
      threadId: request.threadId,
      channel: channel === "voice" ? "voice" : channel === "operator" ? "operator" : "chat",
      userQuery: cleanPrompt,
      effectiveStrategy: (finalResult.metadata?.strategy as string) || "hybrid_rrf",
      retrievedEvidence: finalResult.evidence.map((ev, i) => ({
        evidenceId: ev.evidenceId || `EVD-${i + 1}`,
        documentId: ev.documentId || ev.documentName,
        documentName: ev.documentName,
        pageNumber: ev.pageNumber,
        section: ev.section,
        chunkId: ev.chunkId,
        contentType: ev.format || "prose",
        score: ev.score ?? 0.85,
        snippet: ev.snippet,
        retrievalSource: ev.retrievalSource || "hybrid_rrf",
      })),
      generatedResponse: responseText,
      model: "gpt-4o-mini",
      latencyMs: totalLatencyMs,
      tokensUsed: totalTokensUsed,
      hasEvidence: true,
    });
  }

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
