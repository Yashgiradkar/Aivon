/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as constants from "../constants.js";
import type * as http from "../http.js";
import type * as lib_extractTextContent from "../lib/extractTextContent.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as playground from "../playground.js";
import type * as private_contactSessions from "../private/contactSessions.js";
import type * as private_conversations from "../private/conversations.js";
import type * as private_demo from "../private/demo.js";
import type * as private_files from "../private/files.js";
import type * as private_messages from "../private/messages.js";
import type * as private_plugins from "../private/plugins.js";
import type * as private_queue from "../private/queue.js";
import type * as private_secrets from "../private/secrets.js";
import type * as private_vapi from "../private/vapi.js";
import type * as private_widgetSettings from "../private/widgetSettings.js";
import type * as public_contactSessions from "../public/contactSessions.js";
import type * as public_conversations from "../public/conversations.js";
import type * as public_messages from "../public/messages.js";
import type * as public_organizations from "../public/organizations.js";
import type * as public_queue from "../public/queue.js";
import type * as public_secrets from "../public/secrets.js";
import type * as public_widgetSettings from "../public/widgetSettings.js";
import type * as system_ai_agents_supportAgent from "../system/ai/agents/supportAgent.js";
import type * as system_ai_cache_index from "../system/ai/cache/index.js";
import type * as system_ai_cache_retrievalCache from "../system/ai/cache/retrievalCache.js";
import type * as system_ai_constants from "../system/ai/constants.js";
import type * as system_ai_context_contextManager from "../system/ai/context/contextManager.js";
import type * as system_ai_context_index from "../system/ai/context/index.js";
import type * as system_ai_context_tokenEstimator from "../system/ai/context/tokenEstimator.js";
import type * as system_ai_observability_costCalculator from "../system/ai/observability/costCalculator.js";
import type * as system_ai_observability_index from "../system/ai/observability/index.js";
import type * as system_ai_observability_logger from "../system/ai/observability/logger.js";
import type * as system_ai_rag from "../system/ai/rag.js";
import type * as system_ai_rag_index from "../system/ai/rag/index.js";
import type * as system_ai_rag_queryNormalizer from "../system/ai/rag/queryNormalizer.js";
import type * as system_ai_rag_reranker from "../system/ai/rag/reranker.js";
import type * as system_ai_routing_circuitBreaker from "../system/ai/routing/circuitBreaker.js";
import type * as system_ai_routing_executor from "../system/ai/routing/executor.js";
import type * as system_ai_routing_index from "../system/ai/routing/index.js";
import type * as system_ai_routing_models from "../system/ai/routing/models.js";
import type * as system_ai_routing_retry from "../system/ai/routing/retry.js";
import type * as system_ai_security_guardrails from "../system/ai/security/guardrails.js";
import type * as system_ai_security_index from "../system/ai/security/index.js";
import type * as system_ai_security_rateLimiter from "../system/ai/security/rateLimiter.js";
import type * as system_ai_security_sanitizer from "../system/ai/security/sanitizer.js";
import type * as system_ai_tools_escalateConversation from "../system/ai/tools/escalateConversation.js";
import type * as system_ai_tools_resolveConversation from "../system/ai/tools/resolveConversation.js";
import type * as system_ai_tools_search from "../system/ai/tools/search.js";
import type * as system_contactSessions from "../system/contactSessions.js";
import type * as system_conversations from "../system/conversations.js";
import type * as system_demo from "../system/demo.js";
import type * as system_plugins from "../system/plugins.js";
import type * as system_queue from "../system/queue.js";
import type * as system_secrets from "../system/secrets.js";
import type * as system_subscriptions from "../system/subscriptions.js";
import type * as system_widgetSettings from "../system/widgetSettings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  constants: typeof constants;
  http: typeof http;
  "lib/extractTextContent": typeof lib_extractTextContent;
  "lib/secrets": typeof lib_secrets;
  playground: typeof playground;
  "private/contactSessions": typeof private_contactSessions;
  "private/conversations": typeof private_conversations;
  "private/demo": typeof private_demo;
  "private/files": typeof private_files;
  "private/messages": typeof private_messages;
  "private/plugins": typeof private_plugins;
  "private/queue": typeof private_queue;
  "private/secrets": typeof private_secrets;
  "private/vapi": typeof private_vapi;
  "private/widgetSettings": typeof private_widgetSettings;
  "public/contactSessions": typeof public_contactSessions;
  "public/conversations": typeof public_conversations;
  "public/messages": typeof public_messages;
  "public/organizations": typeof public_organizations;
  "public/queue": typeof public_queue;
  "public/secrets": typeof public_secrets;
  "public/widgetSettings": typeof public_widgetSettings;
  "system/ai/agents/supportAgent": typeof system_ai_agents_supportAgent;
  "system/ai/cache/index": typeof system_ai_cache_index;
  "system/ai/cache/retrievalCache": typeof system_ai_cache_retrievalCache;
  "system/ai/constants": typeof system_ai_constants;
  "system/ai/context/contextManager": typeof system_ai_context_contextManager;
  "system/ai/context/index": typeof system_ai_context_index;
  "system/ai/context/tokenEstimator": typeof system_ai_context_tokenEstimator;
  "system/ai/observability/costCalculator": typeof system_ai_observability_costCalculator;
  "system/ai/observability/index": typeof system_ai_observability_index;
  "system/ai/observability/logger": typeof system_ai_observability_logger;
  "system/ai/rag": typeof system_ai_rag;
  "system/ai/rag/index": typeof system_ai_rag_index;
  "system/ai/rag/queryNormalizer": typeof system_ai_rag_queryNormalizer;
  "system/ai/rag/reranker": typeof system_ai_rag_reranker;
  "system/ai/routing/circuitBreaker": typeof system_ai_routing_circuitBreaker;
  "system/ai/routing/executor": typeof system_ai_routing_executor;
  "system/ai/routing/index": typeof system_ai_routing_index;
  "system/ai/routing/models": typeof system_ai_routing_models;
  "system/ai/routing/retry": typeof system_ai_routing_retry;
  "system/ai/security/guardrails": typeof system_ai_security_guardrails;
  "system/ai/security/index": typeof system_ai_security_index;
  "system/ai/security/rateLimiter": typeof system_ai_security_rateLimiter;
  "system/ai/security/sanitizer": typeof system_ai_security_sanitizer;
  "system/ai/tools/escalateConversation": typeof system_ai_tools_escalateConversation;
  "system/ai/tools/resolveConversation": typeof system_ai_tools_resolveConversation;
  "system/ai/tools/search": typeof system_ai_tools_search;
  "system/contactSessions": typeof system_contactSessions;
  "system/conversations": typeof system_conversations;
  "system/demo": typeof system_demo;
  "system/plugins": typeof system_plugins;
  "system/queue": typeof system_queue;
  "system/secrets": typeof system_secrets;
  "system/subscriptions": typeof system_subscriptions;
  "system/widgetSettings": typeof system_widgetSettings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
};
