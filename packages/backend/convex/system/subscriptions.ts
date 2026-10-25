import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  isAllowedSubscriptionStatus,
  isSafeOrganizationId,
} from "../lib/requestSecurity";

export const upsert = internalMutation({
  args: {
    organizationId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !isSafeOrganizationId(args.organizationId) ||
      !isAllowedSubscriptionStatus(args.status)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Subscription update is invalid",
      });
    }

    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) => 
        q.eq("organizationId", args.organizationId),
      )
      .unique();

    if (existingSubscription) {
      await ctx.db.patch(existingSubscription._id, {
        status: args.status,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        status: args.status,
      });
    }
  },
});

export const getByOrganizationId = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) => 
        q.eq("organizationId", args.organizationId),
      )
      .unique();
  },
});
