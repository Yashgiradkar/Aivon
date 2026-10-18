import { v } from "convex/values";
import { query } from "../_generated/server";

// ---------------------------------------------------------------------------
// getVoiceConfig — unauthenticated public query for widget clients
// Returns non-sensitive voice configuration fields used by use-vapi.ts hook.
// ---------------------------------------------------------------------------

export const getVoiceConfig = query({
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
