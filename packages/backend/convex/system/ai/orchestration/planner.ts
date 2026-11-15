import { ExecutionPlan, RoutingCategory, TaskPlan } from "./types";

export class OrchestrationPlanner {
  /**
   * Generates a typed execution plan based on the classified routing category.
   */
  public static createPlan(
    routingCategory: RoutingCategory,
    userPrompt: string
  ): ExecutionPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    switch (routingCategory) {
      case "greeting": {
        return {
          planId,
          routingCategory,
          estimatedComplexity: "low",
          requiresApproval: false,
          tasks: [
            {
              taskId: "step_respond",
              id: "step_respond",
              capabilityId: "support_agent",
              capability: "support_agent",
              priority: 2,
              dependencies: [],
              dependsOn: [],
              description: "Generate conversational greeting directly without knowledge retrieval",
              inputArgs: { prompt: userPrompt },
            },
          ],
        };
      }

      case "escalation_request": {
        return {
          planId,
          routingCategory,
          estimatedComplexity: "low",
          requiresApproval: false,
          tasks: [
            {
              taskId: "step_escalate",
              id: "step_escalate",
              capabilityId: "escalate_human",
              capability: "escalate_human",
              priority: 1,
              dependencies: [],
              dependsOn: [],
              description: "Connect customer to human support operator and enter priority queue",
              inputArgs: { reason: "Customer explicitly requested human specialist" },
              abortOnFailure: true,
            },
          ],
        };
      }

      case "resolution_request": {
        return {
          planId,
          routingCategory,
          estimatedComplexity: "low",
          requiresApproval: false,
          tasks: [
            {
              taskId: "step_resolve",
              id: "step_resolve",
              capabilityId: "resolve_conversation",
              capability: "resolve_conversation",
              priority: 1,
              dependencies: [],
              dependsOn: [],
              description: "Mark conversation as resolved upon customer confirmation",
              abortOnFailure: true,
            },
          ],
        };
      }

      case "policy_exact_lookup": {
        return {
          planId,
          routingCategory,
          estimatedComplexity: "medium",
          requiresApproval: false,
          tasks: [
            {
              taskId: "step_retrieve",
              id: "step_retrieve",
              capabilityId: "knowledge_retrieval",
              capability: "knowledge_retrieval",
              priority: 1,
              dependencies: [],
              dependsOn: [],
              description: "Retrieve exact policy evidence from verified knowledge base",
              inputArgs: { query: userPrompt },
            },
            {
              taskId: "step_synthesize",
              id: "step_synthesize",
              capabilityId: "support_agent",
              capability: "support_agent",
              priority: 2,
              dependencies: ["step_retrieve"],
              dependsOn: ["step_retrieve"],
              description: "Synthesize grounded customer response using retrieved policy evidence",
            },
          ],
        };
      }

      case "travel_inquiry": {
        return {
          planId,
          routingCategory,
          estimatedComplexity: "low",
          requiresApproval: false,
          tasks: [
            {
              taskId: "step_travel",
              id: "step_travel",
              capabilityId: "travel_agent",
              capability: "travel_agent",
              priority: 1,
              dependencies: [],
              dependsOn: [],
              description: "Process conversational travel exploration and reservation",
              inputArgs: { prompt: userPrompt },
            },
          ],
        };
      }

      case "knowledge_query":
      case "complex_multi_step":
      default: {
        const tasks: TaskPlan[] = [
          {
            taskId: "step_retrieve",
            id: "step_retrieve",
            capabilityId: "knowledge_retrieval",
            capability: "knowledge_retrieval",
            priority: 2,
            dependencies: [],
            dependsOn: [],
            description: "Retrieve multi-format evidence from verified knowledge base",
            inputArgs: { query: userPrompt },
          },
          {
            taskId: "step_synthesize",
            id: "step_synthesize",
            capabilityId: "support_agent",
            capability: "support_agent",
            priority: 2,
            dependencies: ["step_retrieve"],
            dependsOn: ["step_retrieve"],
            description: "Synthesize grounded customer response using retrieved evidence",
          },
          {
            taskId: "step_eval",
            id: "step_eval",
            capabilityId: "quality_evaluation",
            capability: "quality_evaluation",
            priority: 3,
            dependencies: ["step_synthesize"],
            dependsOn: ["step_synthesize"],
            description: "Asynchronously evaluate answer faithfulness and citation validity",
            isParallel: true,
          },
        ];

        return {
          planId,
          routingCategory,
          estimatedComplexity: routingCategory === "complex_multi_step" ? "high" : "medium",
          requiresApproval: false,
          tasks,
        };
      }
    }
  }
}
