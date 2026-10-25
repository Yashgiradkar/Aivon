import { v } from "convex/values";
import { query } from "../_generated/server";
import { isSafeOrganizationId } from "../lib/requestSecurity";

export const getByOrganizationId = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = args.organizationId.trim();
    if (!isSafeOrganizationId(organizationId)) {
      return null;
    }

    const widgetSettings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", organizationId),
      )
      .unique();

    if (!widgetSettings) {
      return null;
    }

    return {
      greetMessage: widgetSettings.greetMessage,
      maxMessagesPerConversation: widgetSettings.maxMessagesPerConversation,
      defaultSuggestions: widgetSettings.defaultSuggestions,
      vapiSettings: {
        assistantId: widgetSettings.vapiSettings.assistantId,
        phoneNumber: widgetSettings.vapiSettings.phoneNumber,
      },
    };
  },
});
