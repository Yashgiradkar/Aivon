import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { MemoryManagerLogic, MemoryType, MemoryStatus } from "./ai/memory/memoryManager";

const MEMORY_RETENTION_DAYS: Record<MemoryType, number> = {
  semantic: 365, // Preferences valid for 1 year
  episodic: 90,  // Past interaction summaries valid for 90 days
  entity: 180,   // Devices / account references valid for 180 days
};

export const upsertMemory = internalMutation({
  args: {
    organizationId: v.string(),
    customerIdentifier: v.string(),
    contactSessionId: v.optional(v.id("contactSessions")),
    conversationId: v.optional(v.id("conversations")),
    memoryType: v.union(v.literal("semantic"), v.literal("episodic"), v.literal("entity")),
    key: v.string(),
    content: v.string(),
    confidence: v.number(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Validate safety
    const validation = MemoryManagerLogic.validateCandidate({
      memoryType: args.memoryType,
      key: args.key,
      content: args.content,
      confidence: args.confidence,
    });

    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const now = Date.now();
    const contentHash = MemoryManagerLogic.hashContent(args.key, args.content);
    const retentionDays = MEMORY_RETENTION_DAYS[args.memoryType] || 90;
    const expiresAt = now + retentionDays * 24 * 60 * 60 * 1000;

    // 2. Check existing memory for this customer and key
    const existing = await ctx.db
      .query("customerMemories")
      .withIndex("by_org_and_customer", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("customerIdentifier", args.customerIdentifier)
          .eq("status", "active")
      )
      .filter((q) => q.eq(q.field("key"), args.key))
      .first();

    if (existing) {
      if (existing.contentHash === contentHash) {
        // Content identical: touch updatedAt and refresh expiresAt
        await ctx.db.patch(existing._id, {
          updatedAt: now,
          expiresAt,
        });
        return { success: true, memoryId: existing._id, action: "refreshed" };
      }

      // Content changed: supersede old memory
      await ctx.db.patch(existing._id, {
        status: "superseded",
        updatedAt: now,
      });
    }

    // Insert new memory
    const memoryId = await ctx.db.insert("customerMemories", {
      organizationId: args.organizationId,
      customerIdentifier: args.customerIdentifier,
      contactSessionId: args.contactSessionId,
      memoryType: args.memoryType,
      key: args.key,
      content: args.content,
      confidence: args.confidence,
      provenance: {
        conversationId: args.conversationId,
        source: args.source,
        extractedAt: now,
      },
      status: "active",
      expiresAt,
      contentHash,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, memoryId, action: "inserted" };
  },
});

export const getActiveCustomerMemories = internalQuery({
  args: {
    organizationId: v.string(),
    customerIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const memories = await ctx.db
      .query("customerMemories")
      .withIndex("by_org_and_customer", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("customerIdentifier", args.customerIdentifier)
          .eq("status", "active")
      )
      .collect();

    // Filter out expired memories
    const valid = memories.filter((m) => !m.expiresAt || m.expiresAt > now);

    return valid.map((m) => ({
      _id: m._id,
      memoryType: m.memoryType,
      key: m.key,
      content: m.content,
      confidence: m.confidence,
      createdAt: m.createdAt,
    }));
  },
});
