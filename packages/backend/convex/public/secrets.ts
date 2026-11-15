import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getSecretValue, parseSecretString } from "../lib/secrets";
import { isSafeOrganizationId } from "../lib/requestSecurity";

export const getVapiSecrets = action({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = args.organizationId.trim();
    if (!isSafeOrganizationId(organizationId)) {
      return null;
    }

    const admission = await ctx.runMutation(
      internal.system.rateLimits.checkKeyedWindow,
      { key: `vapi_public_secrets:${organizationId}` },
    );
    if (!admission.allowed) {
      return null;
    }

    const plugin = await ctx.runQuery(
      internal.system.plugins.getByOrganizationIdAndService,
      {
        organizationId,
        service: "vapi",
      },
    );

    if (!plugin) {
      return null;
    }

    const secretName = plugin.secretName;
    if (
      !secretName ||
      secretName !== `tenant/${organizationId}/vapi` ||
      secretName.includes("..")
    ) {
      return null;
    }

    const secret = await getSecretValue(secretName);

    const secretData = parseSecretString<{
      privateApiKey: string;
      publicApiKey: string;
    }>(secret);

    if (!secretData) {
      return null;
    }

    if (!secretData.publicApiKey) {
      return null;
    }

    if (!secretData.privateApiKey) {
      return null;
    }

    return {
      publicApiKey: secretData.publicApiKey,
    };
  },
});
