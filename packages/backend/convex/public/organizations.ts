import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { isSafeOrganizationId } from "../lib/requestSecurity";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || "",
});

export const validate = action({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = args.organizationId.trim();
    if (!isSafeOrganizationId(organizationId)) {
      return { valid: false, reason: "Organization not valid" };
    }

    const admission = await ctx.runMutation(
      internal.system.rateLimits.checkKeyedWindow,
      { key: `org_validate:${organizationId}` },
    );
    if (!admission.allowed) {
      return { valid: false, reason: "Organization not valid" };
    }

    try {
      const organization = await clerkClient.organizations.getOrganization({
        organizationId,
      });
      return { valid: Boolean(organization) };
    } catch {
      return { valid: false, reason: "Organization not valid" };
    }
  },
});
