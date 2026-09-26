import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";
import { supportAgent } from "../agents/supportAgent";

export const escalateConversation = createTool({
  description: "Escalate a conversation",
  args: z.object({}),
  handler: async (ctx) => {
    if (!ctx.threadId) {
      return "Missing thread ID";
    }

    const conversation = await ctx.runQuery(
      internal.system.conversations.getByThreadId,
      {
        threadId: ctx.threadId,
      }
    );

    await ctx.runMutation(internal.system.conversations.escalate, {
      threadId: ctx.threadId,
    });

    if (conversation) {
      const contactSession = await ctx.runQuery(
        internal.system.contactSessions.getOne,
        {
          contactSessionId: conversation.contactSessionId,
        }
      );

      if (contactSession) {
        // Enqueue customer into supportQueue
        const queueEntryId = await ctx.runMutation(
          internal.system.queue.matchAndAssign,
          {
            organizationId: conversation.organizationId,
          }
        );
      }
    }

    await supportAgent.saveMessage(ctx, {
      threadId: ctx.threadId,
      message: {
        role: "assistant",
        content:
          "I've escalated this conversation to our human support team. You can continue chatting with me while an agent is being connected.",
      },
    });

    return "Conversation escalated to human support team.";
  },
});
