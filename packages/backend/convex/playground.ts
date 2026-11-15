// @ts-ignore
import { definePlaygroundAPI } from "@convex-dev/agent-playground";
import { components } from "./_generated/api";

import { supportAgent } from "./system/ai/agents/supportAgent";

/**
 * Agent playground can list threads, fetch prompt context, and generate text.
 * Keep it disabled unless AGENT_PLAYGROUND_ENABLED=true and a playground API
 * key has been issued for a non-production deployment.
 */
const playgroundEnabled = process.env.AGENT_PLAYGROUND_ENABLED === "true";

export const {
  isApiKeyValid,
  listAgents,
  listUsers,
  listThreads,
  listMessages,
  createThread,
  generateText,
  fetchPromptContext,
} = definePlaygroundAPI(components.agent, {
  agents: playgroundEnabled ? [supportAgent] : [],
});
