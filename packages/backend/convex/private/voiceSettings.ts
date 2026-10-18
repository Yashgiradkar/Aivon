import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { getSecretValue, parseSecretString } from "../lib/secrets";
import { VapiClient } from "@vapi-ai/server-sdk";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const SUPPORTED_ELEVENLABS_MODELS = [
  "eleven_turbo_v2_5",   // multilingual, lowest latency
  "eleven_flash_v2_5",   // ultra-low latency, multilingual
  "eleven_multilingual_v2", // highest quality multilingual
  "eleven_turbo_v2",     // English optimized
  "eleven_flash_v2",     // English ultra-fast
] as const;

const SUPPORTED_TRANSCRIBER_PROVIDERS = ["11labs", "deepgram"] as const;

// Languages supported by ElevenLabs Scribe v1 that are relevant to Aivon's target market
const SUPPORTED_LANGUAGES = ["en", "hi", "mr"] as const;

// ---------------------------------------------------------------------------
// upsertVoiceSettings — saves org voice config atomically
// ---------------------------------------------------------------------------

export const upsertVoiceSettings = mutation({
  args: {
    elevenLabsVoiceId: v.optional(v.string()),
    elevenLabsModel: v.optional(v.string()),
    elevenLabsStability: v.optional(v.number()),
    elevenLabsSimilarityBoost: v.optional(v.number()),
    elevenLabsSpeed: v.optional(v.number()),
    elevenLabsOptimizeStreamingLatency: v.optional(v.number()),
    transcriberProvider: v.optional(v.string()),
    transcriberLanguage: v.optional(v.string()),
    interruptionNumWords: v.optional(v.number()),
    interruptionVoiceSeconds: v.optional(v.number()),
    interruptionBackoffSeconds: v.optional(v.number()),
    startSpeakingWaitSeconds: v.optional(v.number()),
    voiceDesignDescription: v.optional(v.string()),
    voiceDesignType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Identity not found" });
    }
    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Organization not found" });
    }

    // Server-side validation — reject unsupported field values to prevent misconfiguration
    if (args.elevenLabsModel && !SUPPORTED_ELEVENLABS_MODELS.includes(args.elevenLabsModel as typeof SUPPORTED_ELEVENLABS_MODELS[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Unsupported ElevenLabs model. Supported: ${SUPPORTED_ELEVENLABS_MODELS.join(", ")}`,
      });
    }
    if (args.transcriberProvider && !SUPPORTED_TRANSCRIBER_PROVIDERS.includes(args.transcriberProvider as typeof SUPPORTED_TRANSCRIBER_PROVIDERS[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Unsupported transcriber provider. Supported: ${SUPPORTED_TRANSCRIBER_PROVIDERS.join(", ")}`,
      });
    }
    if (args.transcriberLanguage && !SUPPORTED_LANGUAGES.includes(args.transcriberLanguage as typeof SUPPORTED_LANGUAGES[number])) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Unsupported language. Currently supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
      });
    }
    // Validate numeric ranges
    if (args.elevenLabsStability !== undefined && (args.elevenLabsStability < 0 || args.elevenLabsStability > 1)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "stability must be between 0 and 1" });
    }
    if (args.elevenLabsSimilarityBoost !== undefined && (args.elevenLabsSimilarityBoost < 0 || args.elevenLabsSimilarityBoost > 1)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "similarityBoost must be between 0 and 1" });
    }
    if (args.elevenLabsSpeed !== undefined && (args.elevenLabsSpeed < 0.7 || args.elevenLabsSpeed > 1.2)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "speed must be between 0.7 and 1.2" });
    }
    if (args.elevenLabsOptimizeStreamingLatency !== undefined &&
       (args.elevenLabsOptimizeStreamingLatency < 0 || args.elevenLabsOptimizeStreamingLatency > 4)) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "optimizeStreamingLatency must be 0–4" });
    }
    if (args.interruptionVoiceSeconds !== undefined && args.interruptionVoiceSeconds < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "interruptionVoiceSeconds must be >= 0" });
    }
    if (args.startSpeakingWaitSeconds !== undefined && args.startSpeakingWaitSeconds < 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "startSpeakingWaitSeconds must be >= 0" });
    }

    const existingSettings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique();

    if (!existingSettings) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Widget settings not found. Create widget settings first via the Customization page.",
      });
    }

    const currentVersion = existingSettings.voiceSettings?.voiceConfigVersion ?? 0;
    const voiceSettings = {
      elevenLabsVoiceId: args.elevenLabsVoiceId ?? existingSettings.voiceSettings?.elevenLabsVoiceId,
      elevenLabsModel: args.elevenLabsModel ?? existingSettings.voiceSettings?.elevenLabsModel,
      elevenLabsStability: args.elevenLabsStability ?? existingSettings.voiceSettings?.elevenLabsStability,
      elevenLabsSimilarityBoost: args.elevenLabsSimilarityBoost ?? existingSettings.voiceSettings?.elevenLabsSimilarityBoost,
      elevenLabsSpeed: args.elevenLabsSpeed ?? existingSettings.voiceSettings?.elevenLabsSpeed,
      elevenLabsOptimizeStreamingLatency: args.elevenLabsOptimizeStreamingLatency ?? existingSettings.voiceSettings?.elevenLabsOptimizeStreamingLatency,
      transcriberProvider: args.transcriberProvider ?? existingSettings.voiceSettings?.transcriberProvider,
      transcriberLanguage: args.transcriberLanguage ?? existingSettings.voiceSettings?.transcriberLanguage,
      interruptionNumWords: args.interruptionNumWords ?? existingSettings.voiceSettings?.interruptionNumWords,
      interruptionVoiceSeconds: args.interruptionVoiceSeconds ?? existingSettings.voiceSettings?.interruptionVoiceSeconds,
      interruptionBackoffSeconds: args.interruptionBackoffSeconds ?? existingSettings.voiceSettings?.interruptionBackoffSeconds,
      startSpeakingWaitSeconds: args.startSpeakingWaitSeconds ?? existingSettings.voiceSettings?.startSpeakingWaitSeconds,
      voiceDesignDescription: args.voiceDesignDescription ?? existingSettings.voiceSettings?.voiceDesignDescription,
      voiceDesignType: args.voiceDesignType ?? existingSettings.voiceSettings?.voiceDesignType,
      // Increment version on every write to allow clients to detect config changes
      voiceConfigVersion: currentVersion + 1,
    };

    await ctx.db.patch(existingSettings._id, { voiceSettings });
  },
});

// ---------------------------------------------------------------------------
// getVoiceSettings — fetch org voice config for the dashboard
// ---------------------------------------------------------------------------

export const getVoiceSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Identity not found" });
    }
    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Organization not found" });
    }

    const settings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .unique();

    return settings?.voiceSettings ?? null;
  },
});

// ---------------------------------------------------------------------------
// listVoiceLibrary — fetch available ElevenLabs voices through Vapi's credential
// ---------------------------------------------------------------------------

export const listVoiceLibrary = action({
  args: {},
  handler: async (ctx): Promise<Array<{ voiceId: string; name: string; category: string; previewUrl?: string; labels?: Record<string, string> }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Identity not found" });
    }
    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Organization not found" });
    }

    // Demo mode — return a curated set of well-known ElevenLabs voices
    const isDemo = identity.email?.toLowerCase().includes("demo") || orgId.toLowerCase().includes("demo");
    if (isDemo) {
      return DEMO_VOICE_LIBRARY;
    }

    // Try ElevenLabs via Vapi credential if available
    const vapiPlugin = await ctx.runQuery(internal.system.plugins.getByOrganizationIdAndService, {
      organizationId: orgId,
      service: "vapi",
    });

    if (!vapiPlugin) {
      // Return curated popular voices when Vapi is not connected
      return DEMO_VOICE_LIBRARY;
    }

    const secretValue = await getSecretValue(vapiPlugin.secretName);
    const secretData = parseSecretString<{ privateApiKey: string; publicApiKey: string }>(secretValue);

    if (!secretData?.privateApiKey) {
      return DEMO_VOICE_LIBRARY;
    }

    try {
      // Vapi voice listing endpoint — fetches voices available to the account
      const res = await fetch("https://api.vapi.ai/voice", {
        headers: {
          Authorization: `Bearer ${secretData.privateApiKey.trim()}`,
        },
      });

      if (!res.ok) {
        return DEMO_VOICE_LIBRARY;
      }

      const voices = (await res.json()) as Array<Record<string, unknown>>;
      return (voices ?? []).map((v: Record<string, unknown>) => ({
        voiceId: ((v.voiceId as string) || (v.id as string) || ""),
        name: (v.name as string) || "Unknown Voice",
        category: (v.category as string) || "library",
        previewUrl: v.previewUrl as string | undefined,
        labels: v.labels as Record<string, string> | undefined,
      })).filter((v: { voiceId: string }) => Boolean(v.voiceId));
    } catch (err) {
      console.error("[VoiceSettings] Failed to list voice library:", err);
      // Graceful degradation: return curated voices instead of throwing
      return DEMO_VOICE_LIBRARY;
    }
  },
});

// ---------------------------------------------------------------------------
// getVoiceConfig — public endpoint: returns full voice overrides for use-vapi.ts
// Called from the widget (unauthenticated) — only returns non-secret config fields
// ---------------------------------------------------------------------------

export const getPublicVoiceConfig = query({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", args.organizationId))
      .unique();

    if (!settings?.voiceSettings) return null;

    const vs = settings.voiceSettings;
    return {
      elevenLabsVoiceId: vs.elevenLabsVoiceId,
      elevenLabsModel: vs.elevenLabsModel ?? "eleven_turbo_v2_5",
      elevenLabsStability: vs.elevenLabsStability ?? 0.5,
      elevenLabsSimilarityBoost: vs.elevenLabsSimilarityBoost ?? 0.8,
      elevenLabsSpeed: vs.elevenLabsSpeed ?? 1.0,
      elevenLabsOptimizeStreamingLatency: vs.elevenLabsOptimizeStreamingLatency ?? 3,
      transcriberProvider: vs.transcriberProvider ?? "deepgram",
      transcriberLanguage: vs.transcriberLanguage ?? "en",
      interruptionNumWords: vs.interruptionNumWords ?? 0,
      interruptionVoiceSeconds: vs.interruptionVoiceSeconds ?? 0.2,
      interruptionBackoffSeconds: vs.interruptionBackoffSeconds ?? 1,
      startSpeakingWaitSeconds: vs.startSpeakingWaitSeconds ?? 0.4,
      voiceConfigVersion: vs.voiceConfigVersion ?? 1,
    };
  },
});

// ---------------------------------------------------------------------------
// Curated voice library for demo mode / fallback
// ---------------------------------------------------------------------------

interface VoiceLibraryItem {
  voiceId: string;
  name: string;
  category: string;
  previewUrl?: string;
  labels?: Record<string, string>;
}

const DEMO_VOICE_LIBRARY: VoiceLibraryItem[] = [
  { voiceId: "rachel", name: "Rachel", category: "premade", labels: { gender: "female", accent: "american", use_case: "conversational" } },
  { voiceId: "drew", name: "Drew", category: "premade", labels: { gender: "male", accent: "american", use_case: "conversational" } },
  { voiceId: "paul", name: "Paul", category: "premade", labels: { gender: "male", accent: "american", use_case: "conversational" } },
  { voiceId: "matilda", name: "Matilda", category: "premade", labels: { gender: "female", accent: "american", use_case: "conversational" } },
  { voiceId: "adam", name: "Adam", category: "premade", labels: { gender: "male", accent: "american", use_case: "conversational" } },
  { voiceId: "sarah", name: "Sarah", category: "premade", labels: { gender: "female", accent: "american", use_case: "conversational" } },
  { voiceId: "aria", name: "Aria", category: "premade", labels: { gender: "female", accent: "american", use_case: "social_media" } },
  { voiceId: "roger", name: "Roger", category: "premade", labels: { gender: "male", accent: "american", use_case: "social_media" } },
  { voiceId: "george", name: "George", category: "premade", labels: { gender: "male", accent: "british", use_case: "narration" } },
  { voiceId: "charlotte", name: "Charlotte", category: "premade", labels: { gender: "female", accent: "british", use_case: "conversational" } },
];
