import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  subscriptions: defineTable({
    organizationId: v.string(),
    status: v.string(),
  })
    .index("by_organization_id", ["organizationId"]),
  widgetSettings: defineTable({
    organizationId: v.string(),
    greetMessage: v.string(),
    maxMessagesPerConversation: v.optional(v.number()),
    defaultSuggestions: v.object({
      suggestion1: v.optional(v.string()),
      suggestion2: v.optional(v.string()),
      suggestion3: v.optional(v.string()),
    }),
    vapiSettings: v.object({
      assistantId: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
    }),
    // ElevenLabs / multilingual voice configuration (applied as Vapi overrides at call start)
    voiceSettings: v.optional(v.object({
      // TTS
      elevenLabsVoiceId: v.optional(v.string()),          // e.g. "rachel" or custom voice ID
      elevenLabsModel: v.optional(v.string()),             // e.g. "eleven_turbo_v2_5"
      elevenLabsStability: v.optional(v.number()),         // 0–1
      elevenLabsSimilarityBoost: v.optional(v.number()),   // 0–1
      elevenLabsSpeed: v.optional(v.number()),             // 0.7–1.2
      elevenLabsOptimizeStreamingLatency: v.optional(v.number()), // 0–4, default 3
      // STT
      transcriberProvider: v.optional(v.string()),         // "11labs" | "deepgram" (default)
      transcriberLanguage: v.optional(v.string()),         // ISO 639-1: "en", "hi", "mr"
      // Interruption / turn-taking
      interruptionNumWords: v.optional(v.number()),        // words before stop (default 0)
      interruptionVoiceSeconds: v.optional(v.number()),    // VAD seconds (default 0.2)
      interruptionBackoffSeconds: v.optional(v.number()),  // re-speak delay (default 1)
      startSpeakingWaitSeconds: v.optional(v.number()),    // pre-speech pause (default 0.4)
      // Voice Design metadata (stored separately from voiceId — not re-generated per call)
      voiceDesignDescription: v.optional(v.string()),      // natural-language design prompt
      voiceDesignType: v.optional(v.string()),             // "library" | "generated"
      voiceConfigVersion: v.optional(v.number()),          // monotone increment on config change
    })),
  })
  .index("by_organization_id", ["organizationId"]),
  plugins: defineTable({
    organizationId: v.string(),
    service: v.union(v.literal("vapi"), v.literal("elevenlabs")),
    secretName: v.string(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_organization_id_and_service", ["organizationId", "service"]),
  conversations: defineTable({
    threadId: v.string(),
    organizationId: v.string(),
    contactSessionId: v.id("contactSessions"),
    status: v.union(
      v.literal("unresolved"),
      v.literal("escalated"),
      v.literal("resolved")
    ),
    // Denormalized last-message preview — eliminates N+1 listMessages calls on list views
    lastMessageText: v.optional(v.string()),
    lastMessageRole: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_contact_session_id", ["contactSessionId"])
    .index("by_thread_id", ["threadId"])
    .index("by_status_and_organization_id", ["status", "organizationId"]),
  contactSessions: defineTable({
    name: v.string(),
    email: v.string(),
    organizationId: v.string(),
    expiresAt: v.number(),
    metadata: v.optional(v.object({
      userAgent: v.optional(v.string()),
      language: v.optional(v.string()),
      languages: v.optional(v.string()),
      platform: v.optional(v.string()),
      vendor: v.optional(v.string()),
      screenResolution: v.optional(v.string()),
      viewportSize: v.optional(v.string()),
      timezone: v.optional(v.string()),
      timezoneOffset: v.optional(v.number()),
      cookieEnabled: v.optional(v.boolean()),
      referrer: v.optional(v.string()),
      currentUrl: v.optional(v.string()),
    }))
  })
  .index("by_organization_id", ["organizationId"])
  .index("by_expires_at", ["expiresAt"]),
  supportQueue: defineTable({
    organizationId: v.string(),
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
    customerName: v.string(),
    customerEmail: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("offered"),
      v.literal("accepted"),
      v.literal("connecting"),
      v.literal("connected"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("failed")
    ),
    priority: v.union(
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),
    position: v.number(),
    joinedAt: v.number(),
    offeredAt: v.optional(v.number()),
    connectedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    assignedAgentId: v.optional(v.string()),
    assignedAgentName: v.optional(v.string()),
    estimatedWaitSeconds: v.number(),
    lastSeenAt: v.number(),
    aiSummary: v.optional(v.string()),
    isCallback: v.boolean(),
    scheduledFor: v.optional(v.number()),
    callbackPhoneNumber: v.optional(v.string()),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_organization_id_and_status", ["organizationId", "status"])
    .index("by_contact_session_id", ["contactSessionId"])
    .index("by_conversation_id", ["conversationId"])
    .index("by_assigned_agent", ["assignedAgentId", "status"]),
  supportAgentAvailability: defineTable({
    organizationId: v.string(),
    agentId: v.string(), // Clerk user ID
    agentName: v.string(),
    agentEmail: v.string(),
    status: v.union(
      v.literal("available"),
      v.literal("busy"),
      v.literal("on_call"),
      v.literal("offline")
    ),
    currentConversationId: v.optional(v.id("conversations")),
    currentQueueEntryId: v.optional(v.id("supportQueue")),
    skills: v.array(v.string()),
    lastActiveAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_organization_id_and_status", ["organizationId", "status"])
    .index("by_agent_id", ["agentId"]),
  supportCalls: defineTable({
    organizationId: v.string(),
    queueEntryId: v.id("supportQueue"),
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
    agentId: v.optional(v.string()),
    vapiCallId: v.optional(v.string()),
    status: v.union(
      v.literal("initiating"),
      v.literal("ringing"),
      v.literal("in_progress"),
      v.literal("ended"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    connectedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    transcriptSummary: v.optional(v.string()),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_queue_entry_id", ["queueEntryId"])
    .index("by_conversation_id", ["conversationId"]),
  users: defineTable({
    name: v.string(),
  }),
  evaluations: defineTable({
    organizationId: v.string(),
    conversationId: v.id("conversations"),
    threadId: v.string(),
    traceId: v.optional(v.string()),
    userQuestion: v.string(),
    agentAnswer: v.string(),
    retrievedEvidence: v.optional(v.string()),
    evidenceIds: v.optional(v.array(v.string())),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    judgeModel: v.string(),
    rubricVersion: v.string(),
    scores: v.optional(v.object({
      faithfulness: v.object({ score: v.number(), rationale: v.string() }),
      answerRelevance: v.object({ score: v.number(), rationale: v.string() }),
      contextRelevance: v.object({ score: v.number(), rationale: v.string() }),
      completeness: v.object({ score: v.number(), rationale: v.string() }),
      citationValidity: v.object({ pass: v.boolean(), rationale: v.string() }),
      policyCompliance: v.object({ pass: v.boolean(), rationale: v.string() }),
      toolUseCorrectness: v.optional(v.object({ score: v.number(), rationale: v.string() })),
      overallScore: v.number(),
      needsHumanReview: v.boolean(),
    })),
    humanReviewStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("flagged"))),
    humanReviewNotes: v.optional(v.string()),
    humanReviewedBy: v.optional(v.string()),
    humanReviewedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_conversation_id", ["conversationId"])
    .index("by_organization_id_and_status", ["organizationId", "status"]),

  customerMemories: defineTable({
    organizationId: v.string(),
    customerIdentifier: v.string(), // Normalized customer email or identifier
    contactSessionId: v.optional(v.id("contactSessions")),
    memoryType: v.union(v.literal("semantic"), v.literal("episodic"), v.literal("entity")),
    key: v.string(), // e.g. "preference.communication_channel", "entity.device_model"
    content: v.string(),
    confidence: v.number(), // 0.0 to 1.0
    provenance: v.object({
      conversationId: v.optional(v.id("conversations")),
      source: v.string(),
      extractedAt: v.number(),
    }),
    status: v.union(
      v.literal("active"),
      v.literal("superseded"),
      v.literal("expired"),
      v.literal("deleted")
    ),
    expiresAt: v.optional(v.number()),
    contentHash: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_org_and_customer", ["organizationId", "customerIdentifier", "status"])
    .index("by_org_and_type", ["organizationId", "memoryType"])
    .index("by_expires_at", ["expiresAt"]),

  semanticAnswerCache: defineTable({
    organizationId: v.string(),
    canonicalQuery: v.string(),
    queryHash: v.string(),
    response: v.string(),
    evidenceIds: v.array(v.string()),
    sourceDocuments: v.array(v.string()),
    model: v.string(),
    knowledgeVersion: v.string(),
    hitCount: v.number(),
    lastAccessedAt: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_org_and_query_hash", ["organizationId", "queryHash"])
    .index("by_org_and_expires", ["organizationId", "expiresAt"]),

  backgroundJobs: defineTable({
    organizationId: v.string(),
    jobType: v.union(
      v.literal("document_ingestion"),
      v.literal("evaluation_batch"),
      v.literal("memory_extraction"),
      v.literal("cache_maintenance")
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    payload: v.string(), // Serialized JSON input payload or storage reference
    idempotencyKey: v.string(),
    attempts: v.number(),
    maxAttempts: v.number(),
    progress: v.optional(v.number()), // 0 - 100
    error: v.optional(v.string()),
    result: v.optional(v.string()),
    scheduledFor: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"])
    .index("by_org_and_status", ["organizationId", "status"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_status_and_scheduled", ["status", "scheduledFor"]),

  tenantRateLimits: defineTable({
    organizationId: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    tokensUsedThisMonth: v.number(),
    monthlyTokenQuota: v.number(),
    monthlyPeriodStart: v.number(),
    requestsThisMinute: v.number(),
    minuteWindowStart: v.number(),
    concurrentOperationsActive: v.number(),
    maxConcurrentOperations: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_organization_id", ["organizationId"]),
});

