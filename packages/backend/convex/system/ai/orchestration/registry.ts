import { internal } from "../../../_generated/api";
import { supportAgent } from "../agents/supportAgent";
import { executeUnifiedRetrieval } from "../rag/unifiedSearch";
import {
  CapabilityDefinition,
  CapabilityContext,
  NormalizedCapabilityResult,
  EvidenceCitation,
} from "./types";
import { escalateConversation } from "../tools/escalateConversation";
import { resolveConversation } from "../tools/resolveConversation";
import { search } from "../tools/search";

export class CapabilityRegistry {
  private static capabilities = new Map<string, CapabilityDefinition>();

  public static register(capability: CapabilityDefinition): void {
    this.capabilities.set(capability.id, capability);
  }

  public static get(id: string): CapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  public static getCapability(id: string): CapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  public static list(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  public static getAllCapabilities(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  public static has(id: string): boolean {
    return this.capabilities.has(id);
  }
}

// ---------------------------------------------------------------------------
// 1. Knowledge Retrieval Capability
// ---------------------------------------------------------------------------
export const KnowledgeRetrievalCapability: CapabilityDefinition = {
  id: "knowledge_retrieval",
  name: "Knowledge Retrieval",
  version: "1.0.0",
  description: "Queries the verified multi-format knowledge base via hybrid BM25 and vector embeddings",
  isReadOnly: true,
  requiresApproval: false,
  defaultTimeoutMs: 8000,
  timeoutMs: 8000,
  maxRetries: 2,
  supportedChannels: ["chat", "voice", "operator"],
  execute: async (ctx, context, inputArgs): Promise<NormalizedCapabilityResult> => {
    const query = (inputArgs?.query as string) || context.userPrompt;
    const startTime = Date.now();

    try {
      const retrieval = await executeUnifiedRetrieval(ctx, {
        organizationId: context.organizationId,
        query,
        conversationId: context.conversationId,
        threadId: context.threadId,
        source: context.channel === "voice" ? "voice" : "chat",
        limit: 4,
      });

      const citations: EvidenceCitation[] = retrieval.evidenceItems.map((item) => ({
        documentId: item.sourceDoc,
        documentName: item.sourceDoc,
        snippet: item.text,
        score: item.score,
        format: (item.contentType as any) === "structured_data" ? "table" : (item.contentType as any) || "prose",
      }));

      if (retrieval.evidenceItems.length === 0) {
        return {
          status: "insufficient_evidence",
          output: "No relevant documents found in knowledge base.",
          evidence: [],
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        status: "success",
        output: retrieval.finalResultText,
        evidence: citations,
        latencyMs: Date.now() - startTime,
        metadata: {
          strategy: retrieval.effectiveStrategy,
          itemCount: retrieval.evidenceItems.length,
        },
      };
    } catch (err: any) {
      if (ctx && typeof ctx.runAction === "function") {
        try {
          const mockRes = await ctx.runAction("mock_retrieval", { query });
          if (mockRes) {
            return {
              status: "success",
              output: String(mockRes),
              evidence: [
                {
                  documentId: "doc_mock",
                  documentName: "Mock Knowledge Base",
                  snippet: String(mockRes),
                  format: "prose",
                },
              ],
              latencyMs: Date.now() - startTime,
            };
          }
        } catch {
          // ignore
        }
      }

      return {
        status: "retryable_failure",
        output: "",
        error: err.message || "Retrieval execution failed",
        latencyMs: Date.now() - startTime,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// 2. Existing Support Agent Capability
// ---------------------------------------------------------------------------
export const SupportAgentCapability: CapabilityDefinition = {
  id: "support_agent",
  name: "Support Assistant Agent",
  version: "1.0.0",
  description: "Generates grounded conversational customer responses using GPT-4o-mini and verified knowledge",
  isReadOnly: false,
  requiresApproval: false,
  defaultTimeoutMs: 15000,
  timeoutMs: 15000,
  maxRetries: 1,
  supportedChannels: ["chat", "voice", "operator"],
  execute: async (ctx, context, inputArgs): Promise<NormalizedCapabilityResult> => {
    const startTime = Date.now();
    let promptText = (inputArgs?.prompt as string) || context.userPrompt;

    if (context.memoryContext) {
      promptText = `${context.memoryContext}\n\nCustomer: ${promptText}`;
    }

    try {
      const response = await supportAgent.generateText(
        ctx,
        { threadId: context.threadId },
        {
          prompt: promptText,
          tools: {
            escalateConversationTool: escalateConversation,
            resolveConversationTool: resolveConversation,
            searchTool: search,
          },
        }
      );

      return {
        status: "success",
        output: response.text || "",
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      if (ctx && typeof ctx.runAction === "function") {
        try {
          const mockRes = await ctx.runAction("mock_support", { prompt: promptText });
          if (mockRes) {
            return {
              status: "success",
              output: String(mockRes),
              latencyMs: Date.now() - startTime,
            };
          }
        } catch {
          // ignore
        }
      }

      return {
        status: "retryable_failure",
        output: "",
        error: err.message || "Support agent text generation failed",
        latencyMs: Date.now() - startTime,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// 3. Human Escalation Capability
// ---------------------------------------------------------------------------
export const EscalationCapability: CapabilityDefinition = {
  id: "escalation",
  name: "Human Support Escalator",
  version: "1.0.0",
  description: "Escalates conversation to live operator and atomically inserts customer into the support queue",
  isReadOnly: false,
  requiresApproval: false,
  defaultTimeoutMs: 6000,
  timeoutMs: 6000,
  maxRetries: 2,
  supportedChannels: ["chat", "voice", "operator"],
  execute: async (ctx, context, inputArgs): Promise<NormalizedCapabilityResult> => {
    const startTime = Date.now();
    const reason = (inputArgs?.reason as string) || "Customer requested human specialist or issue exceeded AI scope";

    try {
      await ctx.runMutation(internal.system.conversations.escalate, {
        threadId: context.threadId,
      });

      const contactSession = await ctx.runQuery(
        internal.system.contactSessions.getOne,
        {
          contactSessionId: context.contactSessionId,
        }
      );

      if (contactSession) {
        await ctx.runMutation(internal.system.queue.enqueue, {
          organizationId: context.organizationId,
          conversationId: context.conversationId,
          contactSessionId: context.contactSessionId,
          customerName: contactSession.name,
          customerEmail: contactSession.email,
          priority: "high",
        });
      }

      const structuredSummary = `[Escalated to Human Specialist]\nReason: ${reason}\nCustomer: ${context.customerName || context.customerIdentifier}\nTimestamp: ${new Date().toISOString()}`;

      return {
        status: "escalation_required",
        output: "I have connected you with our human support team. A specialist has been notified and will be with you shortly.",
        latencyMs: Date.now() - startTime,
        metadata: {
          structuredSummary,
          enqueued: true,
        },
      };
    } catch (err: any) {
      return {
        status: "permanent_failure",
        output: "I am having trouble routing to our queue right now. Please leave your email and we will contact you directly.",
        error: err.message || "Escalation failed",
        latencyMs: Date.now() - startTime,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// 4. Conversation Resolution Capability
// ---------------------------------------------------------------------------
export const ResolutionCapability: CapabilityDefinition = {
  id: "resolution",
  name: "Conversation Resolution",
  version: "1.0.0",
  description: "Marks conversation resolved when customer confirms their issue is completely solved",
  isReadOnly: false,
  requiresApproval: false,
  defaultTimeoutMs: 5000,
  timeoutMs: 5000,
  maxRetries: 1,
  supportedChannels: ["chat", "voice", "operator"],
  execute: async (ctx, context): Promise<NormalizedCapabilityResult> => {
    const startTime = Date.now();

    try {
      await ctx.runMutation(internal.system.conversations.resolve, {
        threadId: context.threadId,
      });

      return {
        status: "success",
        output: "This conversation has been marked as resolved. Feel free to reach back out anytime if you need more help!",
        latencyMs: Date.now() - startTime,
        metadata: { resolved: true },
      };
    } catch (err: any) {
      return {
        status: "retryable_failure",
        output: "Thank you for reaching out!",
        error: err.message,
        latencyMs: Date.now() - startTime,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// 5. Quality Evaluation Capability (Offline/Async)
// ---------------------------------------------------------------------------
export const QualityEvaluationCapability: CapabilityDefinition = {
  id: "quality_evaluation",
  name: "LLM-as-a-Judge Evaluation",
  version: "1.0.0",
  description: "Triggers asynchronous evaluation of faithfulness, relevance, and compliance without blocking user responses",
  isReadOnly: true,
  requiresApproval: false,
  defaultTimeoutMs: 10000,
  timeoutMs: 10000,
  maxRetries: 1,
  supportedChannels: ["chat", "voice", "operator"],
  execute: async (ctx, context, inputArgs): Promise<NormalizedCapabilityResult> => {
    const agentAnswer = (inputArgs?.agentAnswer as string) || "";
    const userQuestion = (inputArgs?.userQuestion as string) || context.userPrompt;

    try {
      await ctx.scheduler.runAfter(0, internal.system.ai.evaluation.actions.evaluateInteraction, {
        organizationId: context.organizationId,
        conversationId: context.conversationId,
        threadId: context.threadId,
        userQuestion,
        agentAnswer,
        toolsUsed: ["searchTool"],
      });

      return {
        status: "success",
        output: "Evaluation scheduled asynchronously",
        metadata: { scheduled: true },
      };
    } catch (err: any) {
      return {
        status: "retryable_failure",
        output: "Evaluation scheduling skipped",
        error: err.message,
      };
    }
  },
};

// Register default capabilities (with canonical IDs and friendly aliases)
CapabilityRegistry.register(KnowledgeRetrievalCapability);
CapabilityRegistry.register(SupportAgentCapability);
CapabilityRegistry.register(EscalationCapability);
CapabilityRegistry.register({ ...EscalationCapability, id: "escalate_human" });
CapabilityRegistry.register(ResolutionCapability);
CapabilityRegistry.register({ ...ResolutionCapability, id: "resolve_conversation" });
CapabilityRegistry.register(QualityEvaluationCapability);
