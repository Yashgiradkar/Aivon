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
import type * as lib_requestSecurity from "../lib/requestSecurity.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as lib_uploadSecurity from "../lib/uploadSecurity.js";
import type * as playground from "../playground.js";
import type * as private_audit from "../private/audit.js";
import type * as private_contactSessions from "../private/contactSessions.js";
import type * as private_conversations from "../private/conversations.js";
import type * as private_demo from "../private/demo.js";
import type * as private_evaluations from "../private/evaluations.js";
import type * as private_files from "../private/files.js";
import type * as private_jobs from "../private/jobs.js";
import type * as private_messages from "../private/messages.js";
import type * as private_plugins from "../private/plugins.js";
import type * as private_queue from "../private/queue.js";
import type * as private_secrets from "../private/secrets.js";
import type * as private_vapi from "../private/vapi.js";
import type * as private_voiceSettings from "../private/voiceSettings.js";
import type * as private_widgetSettings from "../private/widgetSettings.js";
import type * as public_audit from "../public/audit.js";
import type * as public_contactSessions from "../public/contactSessions.js";
import type * as public_conversations from "../public/conversations.js";
import type * as public_messages from "../public/messages.js";
import type * as public_organizations from "../public/organizations.js";
import type * as public_queue from "../public/queue.js";
import type * as public_secrets from "../public/secrets.js";
import type * as public_travel from "../public/travel.js";
import type * as public_voiceSettings from "../public/voiceSettings.js";
import type * as public_widgetSettings from "../public/widgetSettings.js";
import type * as system_ai_agents_supportAgent from "../system/ai/agents/supportAgent.js";
import type * as system_ai_cache_index from "../system/ai/cache/index.js";
import type * as system_ai_cache_kvCache from "../system/ai/cache/kvCache.js";
import type * as system_ai_cache_retrievalCache from "../system/ai/cache/retrievalCache.js";
import type * as system_ai_cache_semanticCache from "../system/ai/cache/semanticCache.js";
import type * as system_ai_constants from "../system/ai/constants.js";
import type * as system_ai_context_contextManager from "../system/ai/context/contextManager.js";
import type * as system_ai_context_index from "../system/ai/context/index.js";
import type * as system_ai_context_tokenEstimator from "../system/ai/context/tokenEstimator.js";
import type * as system_ai_evaluation_actions from "../system/ai/evaluation/actions.js";
import type * as system_ai_evaluation_index from "../system/ai/evaluation/index.js";
import type * as system_ai_evaluation_judge from "../system/ai/evaluation/judge.js";
import type * as system_ai_memory_memoryManager from "../system/ai/memory/memoryManager.js";
import type * as system_ai_observability_auditMiddleware from "../system/ai/observability/auditMiddleware.js";
import type * as system_ai_observability_costCalculator from "../system/ai/observability/costCalculator.js";
import type * as system_ai_observability_index from "../system/ai/observability/index.js";
import type * as system_ai_observability_logger from "../system/ai/observability/logger.js";
import type * as system_ai_orchestration_executor from "../system/ai/orchestration/executor.js";
import type * as system_ai_orchestration_index from "../system/ai/orchestration/index.js";
import type * as system_ai_orchestration_observability from "../system/ai/orchestration/observability.js";
import type * as system_ai_orchestration_planner from "../system/ai/orchestration/planner.js";
import type * as system_ai_orchestration_policies from "../system/ai/orchestration/policies.js";
import type * as system_ai_orchestration_registry from "../system/ai/orchestration/registry.js";
import type * as system_ai_orchestration_router from "../system/ai/orchestration/router.js";
import type * as system_ai_orchestration_types from "../system/ai/orchestration/types.js";
import type * as system_ai_rag from "../system/ai/rag.js";
import type * as system_ai_rag_bm25 from "../system/ai/rag/bm25.js";
import type * as system_ai_rag_corpus from "../system/ai/rag/corpus.js";
import type * as system_ai_rag_fusion from "../system/ai/rag/fusion.js";
import type * as system_ai_rag_incremental_chunkEmbeddingCache from "../system/ai/rag/incremental/chunkEmbeddingCache.js";
import type * as system_ai_rag_incremental_diffEngine from "../system/ai/rag/incremental/diffEngine.js";
import type * as system_ai_rag_incremental_incrementalPipeline from "../system/ai/rag/incremental/incrementalPipeline.js";
import type * as system_ai_rag_incremental_index from "../system/ai/rag/incremental/index.js";
import type * as system_ai_rag_incremental_manifestStore from "../system/ai/rag/incremental/manifestStore.js";
import type * as system_ai_rag_incremental_pageSplitter from "../system/ai/rag/incremental/pageSplitter.js";
import type * as system_ai_rag_incremental_structureChunker from "../system/ai/rag/incremental/structureChunker.js";
import type * as system_ai_rag_incremental_types from "../system/ai/rag/incremental/types.js";
import type * as system_ai_rag_index from "../system/ai/rag/index.js";
import type * as system_ai_rag_queryNormalizer from "../system/ai/rag/queryNormalizer.js";
import type * as system_ai_rag_queryRouter from "../system/ai/rag/queryRouter.js";
import type * as system_ai_rag_reranker from "../system/ai/rag/reranker.js";
import type * as system_ai_rag_structure_contentBlocks from "../system/ai/rag/structure/contentBlocks.js";
import type * as system_ai_rag_structure_documentParser from "../system/ai/rag/structure/documentParser.js";
import type * as system_ai_rag_structure_index from "../system/ai/rag/structure/index.js";
import type * as system_ai_rag_unifiedSearch from "../system/ai/rag/unifiedSearch.js";
import type * as system_ai_rateLimit_rateLimiter from "../system/ai/rateLimit/rateLimiter.js";
import type * as system_ai_routing_circuitBreaker from "../system/ai/routing/circuitBreaker.js";
import type * as system_ai_routing_executor from "../system/ai/routing/executor.js";
import type * as system_ai_routing_index from "../system/ai/routing/index.js";
import type * as system_ai_routing_models from "../system/ai/routing/models.js";
import type * as system_ai_routing_retry from "../system/ai/routing/retry.js";
import type * as system_ai_security_guardrails from "../system/ai/security/guardrails.js";
import type * as system_ai_security_index from "../system/ai/security/index.js";
import type * as system_ai_security_moderationPipeline from "../system/ai/security/moderationPipeline.js";
import type * as system_ai_security_rateLimiter from "../system/ai/security/rateLimiter.js";
import type * as system_ai_security_sanitizer from "../system/ai/security/sanitizer.js";
import type * as system_ai_tools_escalateConversation from "../system/ai/tools/escalateConversation.js";
import type * as system_ai_tools_resolveConversation from "../system/ai/tools/resolveConversation.js";
import type * as system_ai_tools_search from "../system/ai/tools/search.js";
import type * as system_ai_travel_capability from "../system/ai/travel/capability.js";
import type * as system_ai_travel_normalizer from "../system/ai/travel/normalizer.js";
import type * as system_ai_travel_provider from "../system/ai/travel/provider.js";
import type * as system_ai_travel_types from "../system/ai/travel/types.js";
import type * as system_ai_travel_workflow from "../system/ai/travel/workflow.js";
import type * as system_audit from "../system/audit.js";
import type * as system_cache from "../system/cache.js";
import type * as system_contactSessions from "../system/contactSessions.js";
import type * as system_conversations from "../system/conversations.js";
import type * as system_demo from "../system/demo.js";
import type * as system_jobs from "../system/jobs.js";
import type * as system_jobs_jobRunner from "../system/jobs/jobRunner.js";
import type * as system_memory from "../system/memory.js";
import type * as system_orchestrations from "../system/orchestrations.js";
import type * as system_plugins from "../system/plugins.js";
import type * as system_queue from "../system/queue.js";
import type * as system_rateLimits from "../system/rateLimits.js";
import type * as system_secrets from "../system/secrets.js";
import type * as system_subscriptions from "../system/subscriptions.js";
import type * as system_vapiWebhook from "../system/vapiWebhook.js";
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
  "lib/requestSecurity": typeof lib_requestSecurity;
  "lib/secrets": typeof lib_secrets;
  "lib/uploadSecurity": typeof lib_uploadSecurity;
  playground: typeof playground;
  "private/audit": typeof private_audit;
  "private/contactSessions": typeof private_contactSessions;
  "private/conversations": typeof private_conversations;
  "private/demo": typeof private_demo;
  "private/evaluations": typeof private_evaluations;
  "private/files": typeof private_files;
  "private/jobs": typeof private_jobs;
  "private/messages": typeof private_messages;
  "private/plugins": typeof private_plugins;
  "private/queue": typeof private_queue;
  "private/secrets": typeof private_secrets;
  "private/vapi": typeof private_vapi;
  "private/voiceSettings": typeof private_voiceSettings;
  "private/widgetSettings": typeof private_widgetSettings;
  "public/audit": typeof public_audit;
  "public/contactSessions": typeof public_contactSessions;
  "public/conversations": typeof public_conversations;
  "public/messages": typeof public_messages;
  "public/organizations": typeof public_organizations;
  "public/queue": typeof public_queue;
  "public/secrets": typeof public_secrets;
  "public/travel": typeof public_travel;
  "public/voiceSettings": typeof public_voiceSettings;
  "public/widgetSettings": typeof public_widgetSettings;
  "system/ai/agents/supportAgent": typeof system_ai_agents_supportAgent;
  "system/ai/cache/index": typeof system_ai_cache_index;
  "system/ai/cache/kvCache": typeof system_ai_cache_kvCache;
  "system/ai/cache/retrievalCache": typeof system_ai_cache_retrievalCache;
  "system/ai/cache/semanticCache": typeof system_ai_cache_semanticCache;
  "system/ai/constants": typeof system_ai_constants;
  "system/ai/context/contextManager": typeof system_ai_context_contextManager;
  "system/ai/context/index": typeof system_ai_context_index;
  "system/ai/context/tokenEstimator": typeof system_ai_context_tokenEstimator;
  "system/ai/evaluation/actions": typeof system_ai_evaluation_actions;
  "system/ai/evaluation/index": typeof system_ai_evaluation_index;
  "system/ai/evaluation/judge": typeof system_ai_evaluation_judge;
  "system/ai/memory/memoryManager": typeof system_ai_memory_memoryManager;
  "system/ai/observability/auditMiddleware": typeof system_ai_observability_auditMiddleware;
  "system/ai/observability/costCalculator": typeof system_ai_observability_costCalculator;
  "system/ai/observability/index": typeof system_ai_observability_index;
  "system/ai/observability/logger": typeof system_ai_observability_logger;
  "system/ai/orchestration/executor": typeof system_ai_orchestration_executor;
  "system/ai/orchestration/index": typeof system_ai_orchestration_index;
  "system/ai/orchestration/observability": typeof system_ai_orchestration_observability;
  "system/ai/orchestration/planner": typeof system_ai_orchestration_planner;
  "system/ai/orchestration/policies": typeof system_ai_orchestration_policies;
  "system/ai/orchestration/registry": typeof system_ai_orchestration_registry;
  "system/ai/orchestration/router": typeof system_ai_orchestration_router;
  "system/ai/orchestration/types": typeof system_ai_orchestration_types;
  "system/ai/rag": typeof system_ai_rag;
  "system/ai/rag/bm25": typeof system_ai_rag_bm25;
  "system/ai/rag/corpus": typeof system_ai_rag_corpus;
  "system/ai/rag/fusion": typeof system_ai_rag_fusion;
  "system/ai/rag/incremental/chunkEmbeddingCache": typeof system_ai_rag_incremental_chunkEmbeddingCache;
  "system/ai/rag/incremental/diffEngine": typeof system_ai_rag_incremental_diffEngine;
  "system/ai/rag/incremental/incrementalPipeline": typeof system_ai_rag_incremental_incrementalPipeline;
  "system/ai/rag/incremental/index": typeof system_ai_rag_incremental_index;
  "system/ai/rag/incremental/manifestStore": typeof system_ai_rag_incremental_manifestStore;
  "system/ai/rag/incremental/pageSplitter": typeof system_ai_rag_incremental_pageSplitter;
  "system/ai/rag/incremental/structureChunker": typeof system_ai_rag_incremental_structureChunker;
  "system/ai/rag/incremental/types": typeof system_ai_rag_incremental_types;
  "system/ai/rag/index": typeof system_ai_rag_index;
  "system/ai/rag/queryNormalizer": typeof system_ai_rag_queryNormalizer;
  "system/ai/rag/queryRouter": typeof system_ai_rag_queryRouter;
  "system/ai/rag/reranker": typeof system_ai_rag_reranker;
  "system/ai/rag/structure/contentBlocks": typeof system_ai_rag_structure_contentBlocks;
  "system/ai/rag/structure/documentParser": typeof system_ai_rag_structure_documentParser;
  "system/ai/rag/structure/index": typeof system_ai_rag_structure_index;
  "system/ai/rag/unifiedSearch": typeof system_ai_rag_unifiedSearch;
  "system/ai/rateLimit/rateLimiter": typeof system_ai_rateLimit_rateLimiter;
  "system/ai/routing/circuitBreaker": typeof system_ai_routing_circuitBreaker;
  "system/ai/routing/executor": typeof system_ai_routing_executor;
  "system/ai/routing/index": typeof system_ai_routing_index;
  "system/ai/routing/models": typeof system_ai_routing_models;
  "system/ai/routing/retry": typeof system_ai_routing_retry;
  "system/ai/security/guardrails": typeof system_ai_security_guardrails;
  "system/ai/security/index": typeof system_ai_security_index;
  "system/ai/security/moderationPipeline": typeof system_ai_security_moderationPipeline;
  "system/ai/security/rateLimiter": typeof system_ai_security_rateLimiter;
  "system/ai/security/sanitizer": typeof system_ai_security_sanitizer;
  "system/ai/tools/escalateConversation": typeof system_ai_tools_escalateConversation;
  "system/ai/tools/resolveConversation": typeof system_ai_tools_resolveConversation;
  "system/ai/tools/search": typeof system_ai_tools_search;
  "system/ai/travel/capability": typeof system_ai_travel_capability;
  "system/ai/travel/normalizer": typeof system_ai_travel_normalizer;
  "system/ai/travel/provider": typeof system_ai_travel_provider;
  "system/ai/travel/types": typeof system_ai_travel_types;
  "system/ai/travel/workflow": typeof system_ai_travel_workflow;
  "system/audit": typeof system_audit;
  "system/cache": typeof system_cache;
  "system/contactSessions": typeof system_contactSessions;
  "system/conversations": typeof system_conversations;
  "system/demo": typeof system_demo;
  "system/jobs": typeof system_jobs;
  "system/jobs/jobRunner": typeof system_jobs_jobRunner;
  "system/memory": typeof system_memory;
  "system/orchestrations": typeof system_orchestrations;
  "system/plugins": typeof system_plugins;
  "system/queue": typeof system_queue;
  "system/rateLimits": typeof system_rateLimits;
  "system/secrets": typeof system_secrets;
  "system/subscriptions": typeof system_subscriptions;
  "system/vapiWebhook": typeof system_vapiWebhook;
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
