import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";
import { ModerationPipeline } from "../security";

export const resolveConversation = createTool({
  description: "Resolve and mark a conversation as complete",
  args: z.object({}),
  handler: async (ctx) => {
    const authorization = ModerationPipeline.authorizeToolCall({
      toolName: "resolveConversation",
      arguments: {},
    });
    if (!authorization.allowed) {
      return authorization.reason ?? "Resolution is not permitted";
    }

    if (!ctx.threadId) {
      return "Missing thread ID. Unable to resolve.";
    }

    try {
      await ctx.runMutation(internal.system.conversations.resolve, {
        threadId: ctx.threadId,
      });

      return "Conversation has been successfully marked as resolved.";
    } catch (err) {
      console.error("[resolveConversation] Error resolving conversation:", err);
      return "Conversation resolution noted.";
    }
  },
});


