import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";

export const escalateConversation = createTool({
  description: "Escalate a conversation to human support team",
  args: z.object({
    reason: z.string().optional().describe("The reason for escalating the conversation"),
  }),
  handler: async (ctx, _args) => {
    if (!ctx.threadId) {
      return "Missing thread ID. Unable to escalate.";
    }

    try {
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
          await ctx.runMutation(internal.system.queue.enqueue, {
            organizationId: conversation.organizationId,
            conversationId: conversation._id,
            contactSessionId: conversation.contactSessionId,
            customerName: contactSession.name,
            customerEmail: contactSession.email,
            priority: "high",
          });
        }
      }

      return "Conversation has been successfully escalated to the human support team. Inform the user that an agent has been notified and will be connected shortly.";
    } catch (err) {
      console.error("[escalateConversation] Error escalating conversation:", err);
      return "I have flagged your request for human support, and an agent will join as soon as possible.";
    }
  },
});


