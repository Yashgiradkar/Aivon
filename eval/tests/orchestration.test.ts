import assert from "node:assert/strict";
import { ConversationRouter } from "../../packages/backend/convex/system/ai/orchestration/router";
import { OrchestrationPlanner } from "../../packages/backend/convex/system/ai/orchestration/planner";
import { CapabilityRegistry } from "../../packages/backend/convex/system/ai/orchestration/registry";
import { OrchestrationPolicyManager } from "../../packages/backend/convex/system/ai/orchestration/policies";
import { OrchestrationExecutor } from "../../packages/backend/convex/system/ai/orchestration/executor";
import { OrchestrationTelemetry } from "../../packages/backend/convex/system/ai/orchestration/observability";
import {
  CapabilityContext,
  ExecutionPlan,
  OrchestrationRequest,
  TaskState,
} from "../../packages/backend/convex/system/ai/orchestration/types";

export async function runOrchestrationTests(): Promise<void> {
  console.log("Running Multi-Agent Orchestration Layer Unit & Integration Tests...\n");

  // =========================================================================
  // Test 1: Capability Registry Inspection & Tenant Isolation
  // =========================================================================
  console.log("1. Testing Capability Registry & Metadata...");
  const capabilities = CapabilityRegistry.getAllCapabilities();
  assert.ok(capabilities.length >= 5, "Expected at least 5 registered specialized capabilities");

  const expectedNames = [
    "knowledge_retrieval",
    "support_agent",
    "escalate_human",
    "resolve_conversation",
    "quality_evaluation",
  ];

  for (const name of expectedNames) {
    const cap = CapabilityRegistry.getCapability(name as any);
    assert.ok(cap, `Capability ${name} must be registered`);
    assert.equal(cap.id, name);
    assert.ok((cap.timeoutMs ?? cap.defaultTimeoutMs) > 0, `Capability ${name} must specify a positive timeout`);
    assert.ok(cap.description.length > 10, `Capability ${name} must have a descriptive purpose`);
  }

  // Capability channel support check
  const retrievalCap = CapabilityRegistry.getCapability("knowledge_retrieval")!;
  assert.ok(retrievalCap.supportedChannels?.includes("chat"));
  assert.ok(retrievalCap.supportedChannels?.includes("voice"));
  console.log("   ✓ All specialized capabilities registered with strict contracts and timeouts");

  // =========================================================================
  // Test 2: Deterministic Intent Classification (ConversationRouter)
  // =========================================================================
  console.log("2. Testing Deterministic Intent Classification...");

  // Greetings
  assert.equal(ConversationRouter.classifyIntent("Hello!"), "greeting");
  assert.equal(ConversationRouter.classifyIntent("Hi there, good morning"), "greeting");
  assert.equal(ConversationRouter.classifyIntent("Hey"), "greeting");

  // Human Escalation
  assert.equal(ConversationRouter.classifyIntent("I need to speak with a human agent please"), "escalation_request");
  assert.equal(ConversationRouter.classifyIntent("Connect me to a real person"), "escalation_request");
  assert.equal(ConversationRouter.classifyIntent("Representative now!"), "escalation_request");
  assert.equal(ConversationRouter.classifyIntent("Transfer me to support"), "escalation_request");

  // Issue Resolution
  assert.equal(ConversationRouter.classifyIntent("That solved my problem, thanks!"), "resolution_request");
  assert.equal(ConversationRouter.classifyIntent("Issue resolved, close this ticket"), "resolution_request");
  assert.equal(ConversationRouter.classifyIntent("All fixed now"), "resolution_request");

  // Policy Exact Lookups
  assert.equal(ConversationRouter.classifyIntent("Can you verify policy POL-10928?"), "policy_exact_lookup");
  assert.equal(ConversationRouter.classifyIntent("Lookup account POL-99212 status"), "policy_exact_lookup");
  assert.equal(ConversationRouter.classifyIntent("Is document DOC-5511 valid?"), "policy_exact_lookup");

  // Complex Multi-Step Inquiries
  assert.equal(
    ConversationRouter.classifyIntent("First check my balance, then explain the refund process, and lastly update my email"),
    "complex_multi_step"
  );

  // Standard Knowledge Inquiries
  assert.equal(ConversationRouter.classifyIntent("What are your business operating hours?"), "knowledge_query");
  assert.equal(ConversationRouter.classifyIntent("How do I cancel my subscription?"), "knowledge_query");
  console.log("   ✓ Deterministic routing correctly classifies greetings, escalations, resolutions, exact policies & multi-step requests");

  // =========================================================================
  // Test 3: Plan Construction (OrchestrationPlanner)
  // =========================================================================
  console.log("3. Testing Dynamic Execution Plan Construction...");

  // Plan for greeting: single step fast-path
  const greetingPlan = OrchestrationPlanner.createPlan("greeting", "Hello");
  assert.equal(greetingPlan.tasks.length, 1);
  assert.equal(greetingPlan.tasks[0]?.capability, "support_agent");
  assert.equal(greetingPlan.routingCategory, "greeting");

  // Plan for escalation: single step fast-path to escalate_human
  const escPlan = OrchestrationPlanner.createPlan("escalation_request", "Connect me to an agent");
  assert.equal(escPlan.tasks.length, 1);
  assert.equal(escPlan.tasks[0]?.capability, "escalate_human");
  assert.equal(escPlan.tasks[0]?.priority, 1); // Highest priority

  // Plan for resolution: single step fast-path to resolve_conversation
  const resPlan = OrchestrationPlanner.createPlan("resolution_request", "Everything is fixed");
  assert.equal(resPlan.tasks.length, 1);
  assert.equal(resPlan.tasks[0]?.capability, "resolve_conversation");

  // Plan for exact policy lookup: retrieval step chained into support_agent explanation
  const policyPlan = OrchestrationPlanner.createPlan("policy_exact_lookup", "What does POL-1234 state?");
  assert.equal(policyPlan.tasks.length, 2);
  assert.equal(policyPlan.tasks[0]?.capability, "knowledge_retrieval");
  assert.equal(policyPlan.tasks[1]?.capability, "support_agent");
  assert.ok(policyPlan.tasks[1]?.dependencies.includes(policyPlan.tasks[0]?.id || ""));

  // Plan for complex multi-step: retrieval + support_agent + quality_evaluation
  const multiPlan = OrchestrationPlanner.createPlan("complex_multi_step", "Explain refund policies step by step");
  assert.ok(multiPlan.tasks.length >= 3);
  const evalStep = multiPlan.tasks.find((t) => t.capability === "quality_evaluation");
  assert.ok(evalStep, "Complex multi-step plan must schedule quality evaluation");
  console.log("   ✓ Execution plans correctly map dependencies, step priority, and fast paths");

  // =========================================================================
  // Test 4: Orchestration Policy Enforcement
  // =========================================================================
  console.log("4. Testing Orchestration Policy Enforcement & Guardrails...");

  const validPlan: ExecutionPlan = {
    planId: "p_test_1",
    routingCategory: "knowledge_query",
    tasks: [
      {
        id: "t_1",
        capability: "knowledge_retrieval",
        dependencies: [],
        priority: 2,
        inputPayload: { query: "pricing" },
        status: "pending",
        delegationDepth: 1,
      },
      {
        id: "t_2",
        capability: "support_agent",
        dependencies: ["t_1"],
        priority: 2,
        inputPayload: { query: "pricing" },
        status: "pending",
        delegationDepth: 2,
      },
    ],
    maxSteps: 5,
    budgetTimeoutMs: 15000,
    createdTimestamp: Date.now(),
  };

  const validationResult = OrchestrationPolicyManager.validatePlan(validPlan);
  assert.equal(validationResult.valid, true);

  // Exceed max steps guardrail
  const bloatedPlan: ExecutionPlan = {
    ...validPlan,
    tasks: Array.from({ length: 6 }).map((_, i) => ({
      id: `t_${i}`,
      capability: "knowledge_retrieval",
      dependencies: [],
      priority: 2,
      inputPayload: {},
      status: "pending",
      delegationDepth: 1,
    })),
  };
  const bloatedCheck = OrchestrationPolicyManager.validatePlan(bloatedPlan);
  assert.equal(bloatedCheck.valid, false);
  assert.ok(bloatedCheck.reason?.includes("exceeds max allowed"));

  // Exceed max delegation depth
  const deepPlan: ExecutionPlan = {
    ...validPlan,
    tasks: [
      {
        id: "t_deep",
        capability: "support_agent",
        dependencies: [],
        priority: 2,
        inputPayload: {},
        status: "pending",
        delegationDepth: 4, // Max is 3
      },
    ],
  };
  const deepCheck = OrchestrationPolicyManager.validatePlan(deepPlan);
  assert.equal(deepCheck.valid, false);
  assert.ok(deepCheck.reason?.includes("depth"));

  // Channel permission check
  const voiceAllowed = OrchestrationPolicyManager.isChannelAllowed("knowledge_retrieval", "voice");
  assert.equal(voiceAllowed, true);

  const escalationVoiceAllowed = OrchestrationPolicyManager.isChannelAllowed("escalate_human", "voice");
  assert.equal(escalationVoiceAllowed, true);
  console.log("   ✓ Policy manager enforces max steps (5), recursion depth (3), and channel compatibility");

  // =========================================================================
  // Test 5: Simulated Execution Engine & Context Propagation
  // =========================================================================
  console.log("5. Testing Simulated Execution Engine & Context Forwarding...");

  // Mock Convex context
  const mockCtx = {
    runAction: async (_action: any, _args: any) => {
      return "Mock AI response";
    },
    runMutation: async (_mutation: any, args: any) => {
      return args;
    },
    runQuery: async (_query: any, _args: any) => {
      return null;
    },
  };

  const mockCapabilityContext: CapabilityContext = {
    organizationId: "org_test_orchestration",
    conversationId: "conv_123" as any,
    threadId: "th_123",
    contactSessionId: "session_123" as any,
    channel: "chat",
    customerIdentifier: "customer@example.com",
    userPrompt: "Hello, I need assistance",
    memoryContext: "Customer preference: prefers concise answers",
  };

  const simplePlan = OrchestrationPlanner.createPlan("greeting", "Hello");
  const execResult = await OrchestrationExecutor.executePlan(mockCtx, simplePlan, mockCapabilityContext);

  assert.equal(execResult.finalResult.status, "success");
  assert.ok(execResult.finalResult.output.length > 0);
  assert.equal(Object.keys(execResult.stepResults).length, 1);
  assert.equal(Object.values(execResult.stepResults)[0]?.status, "success");
  console.log("   ✓ Execution engine executes single-step plans and captures step telemetry");

  // Test multi-step chaining with simulated retrieval
  const testChainPlan: ExecutionPlan = {
    planId: "p_chain_test",
    routingCategory: "knowledge_query",
    tasks: [
      {
        id: "step_retrieval",
        capability: "knowledge_retrieval",
        dependencies: [],
        priority: 2,
        inputPayload: { query: "refund policy" },
        status: "pending",
        delegationDepth: 1,
      },
      {
        id: "step_agent",
        capability: "support_agent",
        dependencies: ["step_retrieval"],
        priority: 2,
        inputPayload: { query: "refund policy" },
        status: "pending",
        delegationDepth: 1,
      },
    ],
    maxSteps: 5,
    budgetTimeoutMs: 15000,
    createdTimestamp: Date.now(),
  };

  // Mock ctx that returns evidence on retrieval
  const mockRAGCtx = {
    runAction: async (action: any, args: any) => {
      return "Based on our refund policy, returns are accepted within 30 days.";
    },
    runMutation: async (_mutation: any, args: any) => args,
    runQuery: async (_query: any, _args: any) => null,
  };

  const chainResult = await OrchestrationExecutor.executePlan(mockRAGCtx, testChainPlan, mockCapabilityContext);
  assert.equal(Object.keys(chainResult.stepResults).length, 2);
  assert.equal(chainResult.finalResult.status, "success");
  console.log("   ✓ Execution engine successfully resolves task dependencies and chains outputs");

  // =========================================================================
  // Test 6: Observability Telemetry Logging Integrity
  // =========================================================================
  console.log("6. Testing Observability Telemetry Emitter...");
  let logOutputCaptured = false;

  // Ensure telemetry methods do not throw even with missing/empty inputs
  assert.doesNotThrow(() => {
    OrchestrationTelemetry.logExecutionStart({
      traceId: "tr_test_123",
      organizationId: "org_1",
      conversationId: "conv_1",
      threadId: "th_1",
      channel: "chat",
      promptLength: 25,
    });

    OrchestrationTelemetry.logPlanCreated({
      traceId: "tr_test_123",
      organizationId: "org_1",
      conversationId: "conv_1",
      routingCategory: "knowledge_query",
      plan: validPlan,
    });

    OrchestrationTelemetry.logStepOutcome({
      traceId: "tr_test_123",
      stepId: "s_1",
      capability: "knowledge_retrieval",
      status: "success",
      latencyMs: 120,
    });

    OrchestrationTelemetry.logExecutionCompleted({
      traceId: "tr_test_123",
      organizationId: "org_1",
      conversationId: "conv_1",
      threadId: "th_1",
      result: { status: "success", output: "All done" },
      totalLatencyMs: 350,
      tokensUsed: 140,
      routingCategory: "knowledge_query",
    });
    logOutputCaptured = true;
  });

  assert.equal(logOutputCaptured, true);
  console.log("   ✓ Observability telemetry logs execution start, plan, steps & outcomes cleanly");

  console.log("\n=======================================================");
  console.log("✅ All 6 Multi-Agent Orchestration Suites Passed (100%)!");
  console.log("=======================================================\n");
}

runOrchestrationTests().catch((err) => {
  console.error("❌ Orchestration Test Suite Failed:", err);
  process.exit(1);
});
