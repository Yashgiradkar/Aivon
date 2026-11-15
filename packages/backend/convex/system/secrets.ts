import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { upsertSecret } from "../lib/secrets";
import { isSafeOrganizationId } from "../lib/requestSecurity";

export const upsert = internalAction({
  args: {
    organizationId: v.string(),
    service: v.union(v.literal("vapi"), v.literal("elevenlabs")),
    value: v.object({
      publicApiKey: v.optional(v.string()),
      privateApiKey: v.optional(v.string()),
      apiKey: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    if (!isSafeOrganizationId(args.organizationId)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Organization is invalid",
      });
    }

    const secretName = `tenant/${args.organizationId}/${args.service}`;

    await upsertSecret(secretName, args.value);

    await ctx.runMutation(internal.system.plugins.upsert, {
      service: args.service,
      secretName,
      organizationId: args.organizationId,
    });

    return { status: "success" };
  },
});
