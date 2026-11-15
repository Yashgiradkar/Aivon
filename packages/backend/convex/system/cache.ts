import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { SemanticCacheLogic } from "./ai/cache/semanticCache";

export const lookupSemanticCache = internalQuery({
  args: {
    organizationId: v.string(),
    queryText: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalized = SemanticCacheLogic.normalizeQuery(args.queryText);
    const queryHash = SemanticCacheLogic.hashQuery(normalized);

    // Query active unexpired cache records for this organization and query hash
    const match = await ctx.db
      .query("semanticAnswerCache")
      .withIndex("by_org_and_query_hash", (q) =>
        q.eq("organizationId", args.organizationId).eq("queryHash", queryHash)
      )
      .first();

    if (!match || match.expiresAt <= now) {
      return null;
    }

    return {
      cacheId: match._id,
      response: match.response,
      evidenceReferences: match.evidenceIds,
      canonicalQuery: match.canonicalQuery,
      model: match.model,
    };
  },
});

export const recordSemanticCacheEntry = internalMutation({
  args: {
    organizationId: v.string(),
    canonicalQuery: v.string(),
    response: v.string(),
    evidenceReferences: v.array(v.string()),
    model: v.string(),
    knowledgeVersion: v.optional(v.string()),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ttl = args.ttlMs ?? SemanticCacheLogic.DEFAULT_TTL_MS;
    const normalized = SemanticCacheLogic.normalizeQuery(args.canonicalQuery);
    const queryHash = SemanticCacheLogic.hashQuery(normalized);

    const existing = await ctx.db
      .query("semanticAnswerCache")
      .withIndex("by_org_and_query_hash", (q) =>
        q.eq("organizationId", args.organizationId).eq("queryHash", queryHash)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        response: args.response,
        evidenceIds: args.evidenceReferences,
        model: args.model,
        knowledgeVersion: args.knowledgeVersion ?? "1",
        lastAccessedAt: now,
        expiresAt: now + ttl,
      });
      return existing._id;
    }

    return await ctx.db.insert("semanticAnswerCache", {
      organizationId: args.organizationId,
      canonicalQuery: args.canonicalQuery,
      queryHash,
      response: args.response,
      evidenceIds: args.evidenceReferences,
      sourceDocuments: [],
      model: args.model,
      knowledgeVersion: args.knowledgeVersion ?? "1",
      hitCount: 0,
      lastAccessedAt: now,
      expiresAt: now + ttl,
      createdAt: now,
    });
  },
});

export const recordCacheHit = internalMutation({
  args: {
    cacheId: v.id("semanticAnswerCache"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.cacheId);
    if (entry) {
      await ctx.db.patch(args.cacheId, {
        hitCount: entry.hitCount + 1,
        lastAccessedAt: Date.now(),
      });
    }
  },
});

export const invalidateOrgCache = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("semanticAnswerCache")
      .withIndex("by_org_and_expires", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    return { deletedCount: records.length };
  },
});
