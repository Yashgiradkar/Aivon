import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { supportAgent } from "./ai/agents/supportAgent";
import { saveMessage } from "@convex-dev/agent";

// ---------------------------------------------------------------------------
// Idempotent Seeder for Demo Organization Data
// ---------------------------------------------------------------------------
export const seedDemoOrganization = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Ensure Active Subscription
    const existingSub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (!existingSub) {
      await ctx.db.insert("subscriptions", {
        organizationId: args.organizationId,
        status: "active",
      });
    } else if (existingSub.status !== "active") {
      await ctx.db.patch(existingSub._id, { status: "active" });
    }

    // 2. Ensure Widget Settings
    const existingSettings = await ctx.db
      .query("widgetSettings")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (!existingSettings) {
      await ctx.db.insert("widgetSettings", {
        organizationId: args.organizationId,
        greetMessage:
          "👋 Welcome to Aivon Demo! How can our AI and human support specialists assist you today?",
        defaultSuggestions: {
          suggestion1: "How does Aivon's AI support agent work?",
          suggestion2: "Can I talk to a live support specialist?",
          suggestion3: "What are your integration and pricing options?",
        },
        vapiSettings: {
          assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "",
          phoneNumber: "+1 (800) 555-AIVON",
        },
      });
    }

    // 3. Ensure Vapi Plugin
    const existingVapiPlugin = await ctx.db
      .query("plugins")
      .withIndex("by_organization_id_and_service", (q) =>
        q.eq("organizationId", args.organizationId).eq("service", "vapi")
      )
      .first();

    if (!existingVapiPlugin) {
      await ctx.db.insert("plugins", {
        organizationId: args.organizationId,
        service: "vapi",
        secretName: `tenant/${args.organizationId}/vapi`,
      });
    }

    // 4. Clean up any invalid or legacy mock conversations with non-Convex thread IDs
    const existingConversations = await ctx.db
      .query("conversations")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const hasInvalidThreads = existingConversations.some(
      (c) => c.threadId && c.threadId.startsWith("demo_thread_")
    );

    if (hasInvalidThreads) {
      for (const conv of existingConversations) {
        if (conv.threadId && conv.threadId.startsWith("demo_thread_")) {
          await ctx.db.delete(conv._id);
        }
      }
    } else if (existingConversations.length >= 3) {
      return { status: "already_seeded", count: existingConversations.length };
    }

    // 4. Seed Synthetic Contact Sessions & Real Agent Threads
    const syntheticCustomers = [
      {
        name: "Sarah Chen",
        email: "sarah.chen@techcorp.io",
        status: "unresolved" as const,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
        timezone: "America/San_Francisco",
        userMsg: "Hi! Can you tell me how Aivon's RAG knowledge base syncs with external documents?",
        aiMsg: "Hello Sarah! Aivon automatically indexes uploaded PDFs, text files, and images into tenant-isolated vector embeddings using text-embedding-3-small. Our GPT-4o-mini agent retrieves relevant snippets in real-time during conversations.",
      },
      {
        name: "Marcus Vance",
        email: "m.vance@vancemedia.com",
        status: "escalated" as const,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        platform: "Win32",
        timezone: "America/New_York",
        userMsg: "We need custom enterprise SLA and voice call forwarding to our European phone line.",
        aiMsg: "I've escalated this conversation to our tier-2 human specialist team. You are #1 in the queue and an operator will connect with you shortly.",
      },
      {
        name: "Elena Rostova",
        email: "elena.r@fintechscale.de",
        status: "resolved" as const,
        userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
        platform: "Linux x86_64",
        timezone: "Europe/Berlin",
        userMsg: "How do I embed the chat widget on our Next.js frontend?",
        aiMsg: "You can embed Aivon by adding our lightweight script tag or importing the iframe snippet from the Integrations tab in your dashboard.",
      },
    ];

    for (const cust of syntheticCustomers) {
      const sessionId = await ctx.db.insert("contactSessions", {
        organizationId: args.organizationId,
        name: cust.name,
        email: cust.email,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        metadata: {
          platform: cust.platform,
          timezone: cust.timezone,
          userAgent: cust.userAgent,
          languages: "en-US,en",
        },
      });

      // Create a genuine Agent thread
      const { threadId } = await supportAgent.createThread(ctx, {
        userId: args.organizationId,
      });

      // Save initial customer message
      await saveMessage(ctx, components.agent, {
        threadId,
        message: {
          role: "user",
          content: cust.userMsg,
        },
      });

      // Save assistant response message
      await saveMessage(ctx, components.agent, {
        threadId,
        message: {
          role: "assistant",
          content: cust.aiMsg,
        },
      });

      const convId = await ctx.db.insert("conversations", {
        organizationId: args.organizationId,
        contactSessionId: sessionId,
        threadId,
        status: cust.status,
      });

      // If escalated, add to supportQueue
      if (cust.status === "escalated") {
        await ctx.db.insert("supportQueue", {
          organizationId: args.organizationId,
          conversationId: convId,
          contactSessionId: sessionId,
          customerName: cust.name,
          customerEmail: cust.email,
          status: "waiting",
          priority: "high",
          position: 1,
          joinedAt: Date.now() - 4 * 60 * 1000,
          estimatedWaitSeconds: 120,
          lastSeenAt: Date.now(),
          aiSummary:
            "• Customer requested enterprise SLA and European phone routing.\n• AI answered initial questions but human tier-2 confirmation is required.\n• Customer is ready for specialist voice callback.",
          isCallback: false,
        });
      }
    }

    return { status: "seeded_successfully" };
  },
});
