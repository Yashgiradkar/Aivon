import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  MAX_GREET_MESSAGE_LENGTH,
  MAX_SUGGESTION_LENGTH,
  MAX_VAPI_IDENTIFIER_LENGTH,
} from "../lib/requestSecurity";

export const upsert = mutation({
  args: {
    greetMessage: v.string(),
    maxMessagesPerConversation: v.optional(v.number()),
    defaultSuggestions: v.object({
      suggestion1: v.optional(v.string()),
      suggestion2: v.optional(v.string()),
      suggestion3: v.optional(v.string()),
    }),
    vapiSettings: v.object({
      assistantId: v.optional(v.string()),
      phoneNumber: v.optional(v.string()),
    }),
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

    if (
      args.greetMessage.trim().length === 0 ||
      args.greetMessage.length > MAX_GREET_MESSAGE_LENGTH
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Greeting message is invalid",
      });
    }

    const suggestions = [
      args.defaultSuggestions.suggestion1,
      args.defaultSuggestions.suggestion2,
      args.defaultSuggestions.suggestion3,
    ];
    if (
      suggestions.some(
        (suggestion) =>
          typeof suggestion === "string" &&
          suggestion.length > MAX_SUGGESTION_LENGTH,
      )
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Suggestion text exceeds permitted length",
      });
    }

    if (
      args.maxMessagesPerConversation !== undefined &&
      (args.maxMessagesPerConversation < 1 ||
        args.maxMessagesPerConversation > 200)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Message limit must be between 1 and 200",
      });
    }

    const vapiIdentifiers = [
      args.vapiSettings.assistantId,
      args.vapiSettings.phoneNumber,
    ];
    if (
      vapiIdentifiers.some(
        (value) =>
          typeof value === "string" &&
          value.length > MAX_VAPI_IDENTIFIER_LENGTH,
      )
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Voice integration identifiers are invalid",
      });
    }

    const existingWidgetSettings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique();

    if (existingWidgetSettings) {
      await ctx.db.patch(existingWidgetSettings._id, {
        greetMessage: args.greetMessage,
        maxMessagesPerConversation: args.maxMessagesPerConversation,
        defaultSuggestions: args.defaultSuggestions,
        vapiSettings: args.vapiSettings,
        // NOTE: voiceSettings are managed separately via private/voiceSettings.ts
        // Do not overwrite here to avoid wiping ElevenLabs config on every customization save.
      });
    } else {
      await ctx.db.insert("widgetSettings", {
        organizationId: orgId,
        greetMessage: args.greetMessage,
        maxMessagesPerConversation: args.maxMessagesPerConversation,
        defaultSuggestions: args.defaultSuggestions,
        vapiSettings: args.vapiSettings,
      });
    }
  },
});


export const getOne = query({
  args: {},
  handler: async (ctx) => {
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

    const widgetSettings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique();

    return widgetSettings;
  },
});
