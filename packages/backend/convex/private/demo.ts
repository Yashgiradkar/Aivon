import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

export const isDemoOrganization = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      return false;
    }

    const orgId = identity.orgId as string;
    const email = identity.email?.toLowerCase() ?? "";

    // Recognize demo organization by demo user email or org ID patterns
    return (
      email.includes("demo") ||
      orgId.toLowerCase().includes("demo") ||
      identity.nickname?.toLowerCase().includes("demo") ||
      false
    );
  },
});

export const initDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;

    await ctx.scheduler.runAfter(0, internal.system.demo.seedDemoOrganization, {
      organizationId: orgId,
    });

    return { status: "initiated" };
  },
});
