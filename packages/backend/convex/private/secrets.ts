import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { isConfiguredDemoActor } from "../lib/requestSecurity";

const secretValueValidator = v.object({
  publicApiKey: v.optional(v.string()),
  privateApiKey: v.optional(v.string()),
  apiKey: v.optional(v.string()),
});

export const upsert = mutation({
  args: {
    service: v.union(v.literal("vapi"), v.literal("elevenlabs")),
    value: secretValueValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
        
    if (identity === null) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;

    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    if (isConfiguredDemoActor(identity)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Modifying production API secrets is disabled in Demo Mode.",
      });
    }

    const secretEntries = Object.entries(args.value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    if (
      secretEntries.length === 0 ||
      secretEntries.some(
        ([, value]) => value.trim().length === 0 || value.length > 512,
      )
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Secret values are invalid",
      });
    }

    await ctx.scheduler.runAfter(0, internal.system.secrets.upsert, {
      service: args.service,
      organizationId: orgId,
      value: args.value,
    });
  },
});
