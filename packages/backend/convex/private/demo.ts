import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { isConfiguredDemoActor } from "../lib/requestSecurity";

export const isDemoOrganization = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      return false;
    }

    return isConfiguredDemoActor(identity);
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
    if (!isConfiguredDemoActor(identity)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Demo seeding is not enabled for this organization",
      });
    }

    await ctx.scheduler.runAfter(0, internal.system.demo.seedDemoOrganization, {
      organizationId: orgId,
    });

    return { status: "initiated" };
  },
});
