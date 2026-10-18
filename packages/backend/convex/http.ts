import { Webhook } from "svix";
import { createClerkClient } from "@clerk/backend";
import type { WebhookEvent } from "@clerk/backend";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || "",
});

const http = httpRouter();

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);

    if (!event) {
      return new Response("Error occurred", { status: 400 });
    }

    switch (event.type) {
      case "subscription.updated": {
        const subscription = event.data as {
          status: string;
          payer?: {
            organization_id: string;
          }
        };

        const organizationId = subscription.payer?.organization_id;

        if (!organizationId) {
          return new Response("Missing Organization ID", { status: 400 });
        }

        const newMaxAllowedMemberships = subscription.status === "active" ? 5 : 1;

        await clerkClient.organizations.updateOrganization(organizationId, {
          maxAllowedMemberships: newMaxAllowedMemberships,
        });

        await ctx.runMutation(internal.system.subscriptions.upsert, {
          organizationId,
          status: subscription.status,
        });

        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/vapi-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Optional secret verification
    const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (expectedSecret) {
      const headerSecret = request.headers.get("x-vapi-secret");
      if (headerSecret !== expectedSecret) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = await request.json() as Record<string, unknown>;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const message = (payload.message ?? payload) as Record<string, unknown>;
    const msgType = message?.type as string | undefined;

    // 1. Tool / Function call handling during voice session
    if (msgType === "tool-calls") {
      const toolCalls = (message.toolCalls ?? []) as Array<{
        id: string;
        function?: { name: string; arguments: string | Record<string, unknown> };
      }>;
      const callObj = (message.call ?? {}) as Record<string, unknown>;
      const varValues = (callObj.variableValues ?? {}) as Record<string, unknown>;
      const organizationId = varValues.organizationId as string | undefined;
      const conversationId = varValues.conversationId as string | undefined;

      const results = [];
      for (const call of toolCalls) {
        const fnName = call.function?.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = typeof call.function?.arguments === "string"
            ? JSON.parse(call.function.arguments)
            : (call.function?.arguments ?? {});
        } catch {
          fnArgs = {};
        }

        let result = "";
        if ((fnName === "search" || fnName === "searchKnowledgeBase") && organizationId) {
          result = await ctx.runAction(internal.system.vapiWebhook.executeVoiceSearch, {
            organizationId,
            query: (fnArgs.query as string) ?? "",
            conversationId,
          });
        } else if (fnName === "escalateConversation") {
          result = "The conversation has been escalated to human support specialists.";
        } else if (fnName === "resolveConversation") {
          result = "The conversation has been marked as resolved.";
        } else {
          result = "Tool execution completed.";
        }

        results.push({
          toolCallId: call.id,
          result,
        });
      }

      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. End of call report — persist conversation transcript
    if (msgType === "end-of-call-report") {
      const callObj = (message.call ?? {}) as Record<string, unknown>;
      const varValues = (callObj.variableValues ?? {}) as Record<string, unknown>;
      const conversationId = varValues.conversationId as string | undefined;
      const rawMessages = message.messages as Array<Record<string, unknown>> | undefined;

      if (conversationId && Array.isArray(rawMessages)) {
        const transcriptMessages = rawMessages.map((m) => ({
          role: m.role === "bot" || m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          text: ((m.message ?? m.content ?? "") as string).trim(),
        })).filter((m) => m.text.length > 0);

        try {
          await ctx.runMutation(internal.system.vapiWebhook.recordVoiceTranscript, {
            conversationId: conversationId as any,
            transcriptMessages,
            vapiCallId: callObj.id as string | undefined,
            durationSeconds: message.durationSeconds as number | undefined,
          });
        } catch (err) {
          console.error("[VapiWebhook] Error recording voice transcript:", err);
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "acknowledged" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id") || "",
    "svix-timestamp": req.headers.get("svix-timestamp") || "",
    "svix-signature": req.headers.get("svix-signature") || "",
  };

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error(`Error verifying webhook event`, error);
    return null;
  }
};

export default http;
