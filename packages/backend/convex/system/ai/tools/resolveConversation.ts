import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";
import { ModerationPipeline } from "../security";

export const resolveConversation = createTool({
  description:
    "Resolve and mark a conversation as complete. WARNING: Only call this tool AFTER asking the customer a closing confirmation question AND receiving their explicit, unambiguous confirmation that they have no more questions and want to finish (e.g., 'I am all set, thanks'). NEVER call this on polite acknowledgments like 'Okay' or 'Thanks'.",
  args: z.object({
    customerConfirmation: z
      .string()
      .optional()
      .describe(
        "The customer's explicit statement confirming they have no further questions and want to close the conversation (e.g., 'No further questions, thank you').",
      ),
  }),
  handler: async (ctx, args) => {
    const authorization = ModerationPipeline.authorizeToolCall({
      toolName: "resolveConversation",
      arguments: { customerConfirmation: args?.customerConfirmation },
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


