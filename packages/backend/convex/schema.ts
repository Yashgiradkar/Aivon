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
    defaultSuggestions: v.object({
      suggestion1: v.optional(v.string()),
      suggestion2: v.optional(v.string()),
      suggestion3: v.optional(v.string()),
    }),
    vapiSettings: v.object({
      assistantId: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
    }),
  })
  .index("by_organization_id", ["organizationId"]),
  plugins: defineTable({
    organizationId: v.string(),
    service: v.union(v.literal("vapi")),
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
});
