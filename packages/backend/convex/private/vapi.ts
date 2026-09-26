import { VapiClient, Vapi } from "@vapi-ai/server-sdk";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getSecretValue, parseSecretString } from "../lib/secrets";
import { ConvexError } from "convex/values";

export const getAssistants = action({
  args: {},
  handler: async (ctx): Promise<Vapi.Assistant[]> => {
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

    const isDemo =
      identity.email?.toLowerCase().includes("demo") ||
      orgId.toLowerCase().includes("demo");

    if (isDemo) {
      return [
        {
          id: "demo-vapi-asst-1",
          orgId: orgId,
          name: "Aivon AI Voice Specialist (Demo)",
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [],
          },
          firstMessage:
            "👋 Hi! Thanks for calling Aivon AI Customer Support Demo. How can I assist you today?",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Vapi.Assistant,
      ];
    }

    const plugin = await ctx.runQuery(
      internal.system.plugins.getByOrganizationIdAndService,
      {
        organizationId: orgId,
        service: "vapi",
      },
    );

    if (!plugin) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Plugin not found",
      });
    }

    const secretName = plugin.secretName;
    const secretValue = await getSecretValue(secretName);
    const secretData = parseSecretString<{
      privateApiKey: string;
      publicApiKey: string;
    }>(secretValue);

    if (!secretData) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Credentials not found",
      });
    }

    if (!secretData.privateApiKey || !secretData.publicApiKey) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Credentials incomplete. Please reconnect your Vapi account.",
      });
    }

    try {
      const vapiClient = new VapiClient({
        token: secretData.privateApiKey.trim(),
      });

      const assistants = await vapiClient.assistants.list();
      return assistants;
    } catch (err) {
      console.error("[Vapi Backend] Error listing assistants:", err);
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          err instanceof Error
            ? err.message
            : "Failed to fetch assistants from Vapi. Please verify your Vapi Private API Key.",
      });
    }
  },
});

export const getPhoneNumbers = action({
  args: {},
  handler: async (ctx): Promise<Vapi.PhoneNumbersListResponseItem[]> => {
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

    const isDemo =
      identity.email?.toLowerCase().includes("demo") ||
      orgId.toLowerCase().includes("demo");

    if (isDemo) {
      return [
        {
          id: "demo-phone-1",
          orgId: orgId,
          number: "+1 (800) 555-AIVON",
          name: "Aivon Demo Inbound Support Line",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Vapi.PhoneNumbersListResponseItem,
      ];
    }

    const plugin = await ctx.runQuery(
      internal.system.plugins.getByOrganizationIdAndService,
      {
        organizationId: orgId,
        service: "vapi",
      },
    );

    if (!plugin) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Plugin not found",
      });
    }

    const secretName = plugin.secretName;
    const secretValue = await getSecretValue(secretName);
    const secretData = parseSecretString<{
      privateApiKey: string;
      publicApiKey: string;
    }>(secretValue);

    if (!secretData) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Credentials not found",
      });
    }

    if (!secretData.privateApiKey || !secretData.publicApiKey) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Credentials incomplete. Please reconnect your Vapi account.",
      });
    }

    try {
      const vapiClient = new VapiClient({
        token: secretData.privateApiKey.trim(),
      });

      const phoneNumbers = await vapiClient.phoneNumbers.list();
      return phoneNumbers;
    } catch (err) {
      console.error("[Vapi Backend] Error listing phone numbers:", err);
      throw new ConvexError({
        code: "BAD_REQUEST",
        message:
          err instanceof Error
            ? err.message
            : "Failed to fetch phone numbers from Vapi. Please verify your Vapi Private API Key.",
      });
    }
  },
});
