import { internal } from "../../../_generated/api";
import { Id } from "../../../_generated/dataModel";
import { logAIOperation } from "./logger";
import { maskPIIForLogging } from "../security/sanitizer";

export type AuditChannel = "chat" | "voice" | "operator" | "system";

export interface EvidenceLineageItem {
  evidenceId: string;
  documentId: string;
  documentName: string;
  pageNumber?: number;
  section?: string;
  chunkId?: string;
  contentType: "table" | "chart" | "prose" | "structured_data" | string;
  score: number;
  snippet: string;
  retrievalSource: "dense" | "bm25" | "hybrid_rrf" | string;
}

export interface VoiceTraceMetadata {
  provider?: "vapi" | "elevenlabs" | "web_speech" | string;
  voiceId?: string;
  modelId?: string;
  audioDurationSeconds?: number;
  transcriberProvider?: string;
  transcriberLanguage?: string;
}

export interface LineagePayload {
  organizationId: string;
  traceId: string;
  conversationId?: Id<"conversations">;
  threadId?: string;
  channel: "chat" | "voice" | "operator";
  userQuery: string;
  effectiveStrategy: string;
  retrievedEvidence: EvidenceLineageItem[];
  generatedResponse: string;
  speechFormattedResponse?: string;
  model: string;
  voiceMetadata?: VoiceTraceMetadata;
  latencyMs: number;
  tokensUsed: number;
  hasEvidence: boolean;
}

export interface AuditEventPayload {
  organizationId: string;
  traceId: string;
  conversationId?: Id<"conversations">;
  threadId?: string;
  contactSessionId?: Id<"contactSessions">;
  channel: AuditChannel;
  eventType: string;
  stage: string;
  status: "success" | "failed" | "warning" | "blocked";
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Centralized AI & Voice Observability Middleware
 *
 * Provides a unified, thread-safe, and asynchronous audit interceptor across
 * text chat, voice assistant (Vapi / ElevenLabs), operator enhancement, and RAG pipelines.
 */
export class AuditMiddleware {
  /**
   * Generates a correlated, high-entropy trace identifier.
   */
  public static generateTraceId(channel: AuditChannel = "chat"): string {
    const timestamp = Date.now();
    const entropy = Math.random().toString(36).substring(2, 9);
    return `tr_${channel}_${timestamp}_${entropy}`;
  }

  /**
   * Logs and persists an audit event asynchronously via Convex scheduler,
   * guaranteeing zero latency impact on synchronous customer responses.
   */
  public static recordEvent(ctx: any, event: AuditEventPayload): void {
    // 1. Immediate structured console emission for external log aggregators (Datadog/Sentry)
    logAIOperation({
      event: event.eventType as any,
      organizationId: event.organizationId,
      conversationId: event.conversationId ? String(event.conversationId) : undefined,
      threadId: event.threadId,
      traceId: event.traceId,
      model: event.model,
      latencyMs: event.latencyMs,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      costUsd: event.costUsd,
      error: event.error,
      details: {
        stage: event.stage,
        channel: event.channel,
        status: event.status,
        ...(event.metadata || {}),
      },
    });

    // 2. Asynchronous DB persistence (if ctx supports scheduler)
    try {
      if (ctx?.scheduler?.runAfter) {
        ctx.scheduler.runAfter(0, internal.system.audit.recordAuditEvent, {
          organizationId: event.organizationId,
          traceId: event.traceId,
          conversationId: event.conversationId,
          threadId: event.threadId,
          contactSessionId: event.contactSessionId,
          channel: event.channel,
          eventType: event.eventType,
          stage: event.stage,
          status: event.status,
          model: event.model,
          latencyMs: event.latencyMs,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          costUsd: event.costUsd,
          error: event.error,
          metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
        });
      } else if (ctx?.runMutation) {
        // Direct runMutation for background tasks
        ctx.runMutation(internal.system.audit.recordAuditEvent, {
          organizationId: event.organizationId,
          traceId: event.traceId,
          conversationId: event.conversationId,
          threadId: event.threadId,
          contactSessionId: event.contactSessionId,
          channel: event.channel,
          eventType: event.eventType,
          stage: event.stage,
          status: event.status,
          model: event.model,
          latencyMs: event.latencyMs,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          costUsd: event.costUsd,
          error: event.error,
          metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
        }).catch?.(() => {});
      }
    } catch (err) {
      console.warn("[AuditMiddleware] Non-blocking audit persistence fallback:", err);
    }
  }

  /**
   * Captures the full end-to-end RAG data lineage linking retrieved chunks to answers.
   */
  public static recordLineage(ctx: any, lineage: LineagePayload): void {
    const sanitizedQuery = maskPIIForLogging(lineage.userQuery);
    const sanitizedEvidence = lineage.retrievedEvidence.map((e) => ({
      ...e,
      snippet: maskPIIForLogging(e.snippet),
    }));

    try {
      if (ctx?.scheduler?.runAfter) {
        ctx.scheduler.runAfter(0, internal.system.audit.recordLineage, {
          organizationId: lineage.organizationId,
          traceId: lineage.traceId,
          conversationId: lineage.conversationId,
          threadId: lineage.threadId,
          channel: lineage.channel,
          userQuery: sanitizedQuery,
          effectiveStrategy: lineage.effectiveStrategy,
          retrievedEvidence: sanitizedEvidence,
          generatedResponse: lineage.generatedResponse,
          speechFormattedResponse: lineage.speechFormattedResponse,
          model: lineage.model,
          voiceMetadata: lineage.voiceMetadata,
          latencyMs: lineage.latencyMs,
          tokensUsed: lineage.tokensUsed,
          hasEvidence: lineage.hasEvidence,
        });
      } else if (ctx?.runMutation) {
        ctx.runMutation(internal.system.audit.recordLineage, {
          organizationId: lineage.organizationId,
          traceId: lineage.traceId,
          conversationId: lineage.conversationId,
          threadId: lineage.threadId,
          channel: lineage.channel,
          userQuery: sanitizedQuery,
          effectiveStrategy: lineage.effectiveStrategy,
          retrievedEvidence: sanitizedEvidence,
          generatedResponse: lineage.generatedResponse,
          speechFormattedResponse: lineage.speechFormattedResponse,
          model: lineage.model,
          voiceMetadata: lineage.voiceMetadata,
          latencyMs: lineage.latencyMs,
          tokensUsed: lineage.tokensUsed,
          hasEvidence: lineage.hasEvidence,
        }).catch?.(() => {});
      }
    } catch (err) {
      console.warn("[AuditMiddleware] Non-blocking lineage persistence fallback:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Conveniences for standard lifecycle stages
  // ---------------------------------------------------------------------------

  public static startTrace(
    ctx: any,
    params: {
      traceId: string;
      organizationId: string;
      conversationId?: Id<"conversations">;
      threadId?: string;
      contactSessionId?: Id<"contactSessions">;
      channel: AuditChannel;
      promptLength: number;
    },
  ): void {
    this.recordEvent(ctx, {
      organizationId: params.organizationId,
      traceId: params.traceId,
      conversationId: params.conversationId,
      threadId: params.threadId,
      contactSessionId: params.contactSessionId,
      channel: params.channel,
      eventType: "request.init",
      stage: "request.received",
      status: "success",
      metadata: {
        promptLength: params.promptLength,
      },
    });
  }

  public static recordAuthDecision(
    ctx: any,
    params: {
      traceId: string;
      organizationId: string;
      conversationId?: Id<"conversations">;
      channel: AuditChannel;
      allowed: boolean;
      authType: "clerk_jwt" | "contact_session" | "api_key" | "webhook_signature";
      reason?: string;
    },
  ): void {
    this.recordEvent(ctx, {
      organizationId: params.organizationId,
      traceId: params.traceId,
      conversationId: params.conversationId,
      channel: params.channel,
      eventType: "auth.decision",
      stage: "authorization.verified",
      status: params.allowed ? "success" : "blocked",
      metadata: {
        authType: params.authType,
        reason: params.reason,
      },
      error: params.allowed ? undefined : params.reason || "Unauthorized",
    });
  }

  public static recordModerationCheck(
    ctx: any,
    params: {
      traceId: string;
      organizationId: string;
      conversationId?: Id<"conversations">;
      channel: AuditChannel;
      flagged: boolean;
      riskLevel: string;
      categories: string[];
      rejectionReason?: string;
    },
  ): void {
    this.recordEvent(ctx, {
      organizationId: params.organizationId,
      traceId: params.traceId,
      conversationId: params.conversationId,
      channel: params.channel,
      eventType: "guardrail.violation",
      stage: "moderation.evaluated",
      status: params.flagged ? "blocked" : "success",
      metadata: {
        flagged: params.flagged,
        riskLevel: params.riskLevel,
        categories: params.categories,
      },
      error: params.rejectionReason,
    });
  }

  public static recordTTSSynthesis(
    ctx: any,
    params: {
      traceId: string;
      organizationId: string;
      conversationId?: Id<"conversations">;
      provider: "elevenlabs" | "vapi" | "web_speech";
      voiceId?: string;
      modelId?: string;
      speechTextLength: number;
      durationSeconds?: number;
      latencyMs?: number;
    },
  ): void {
    this.recordEvent(ctx, {
      organizationId: params.organizationId,
      traceId: params.traceId,
      conversationId: params.conversationId,
      channel: "voice",
      eventType: "tts.synthesis",
      stage: "voice.synthesis_completed",
      status: "success",
      latencyMs: params.latencyMs,
      metadata: {
        provider: params.provider,
        voiceId: params.voiceId,
        modelId: params.modelId,
        speechTextLength: params.speechTextLength,
        durationSeconds: params.durationSeconds,
      },
    });
  }

  public static recordError(
    ctx: any,
    params: {
      traceId: string;
      organizationId: string;
      conversationId?: Id<"conversations">;
      channel: AuditChannel;
      stage: string;
      error: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    this.recordEvent(ctx, {
      organizationId: params.organizationId,
      traceId: params.traceId,
      conversationId: params.conversationId,
      channel: params.channel,
      eventType: "error",
      stage: params.stage,
      status: "failed",
      error: params.error,
      metadata: params.metadata,
    });
  }
}

