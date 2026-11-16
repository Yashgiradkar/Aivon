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

const playgroundApi: any = (definePlaygroundAPI as any)(components.agent, {
  agents: playgroundEnabled ? [supportAgent] : [],
});

export const isApiKeyValid: any = playgroundApi.isApiKeyValid;
export const listAgents: any = playgroundApi.listAgents;
export const listUsers: any = playgroundApi.listUsers;
export const listThreads: any = playgroundApi.listThreads;
export const listMessages: any = playgroundApi.listMessages;
export const createThread: any = playgroundApi.createThread;
export const generateText: any = playgroundApi.generateText;
export const fetchPromptContext: any = playgroundApi.fetchPromptContext;
