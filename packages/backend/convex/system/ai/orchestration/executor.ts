import {
  CapabilityContext,
  ExecutionPlan,
  NormalizedCapabilityResult,
  TaskPlan,
} from "./types";
import { CapabilityRegistry } from "./registry";
import { OrchestrationPolicyManager } from "./policies";
import { executeReliableAI } from "../routing/executor";

export class OrchestrationExecutor {
  /**
   * Executes an execution plan, resolving dependencies and bounding concurrency.
   */
  public static async executePlan(
    ctx: any,
    plan: ExecutionPlan,
    initialContext: CapabilityContext
  ): Promise<{
    finalResult: NormalizedCapabilityResult;
    stepResults: Record<string, NormalizedCapabilityResult>;
    totalLatencyMs: number;
  }> {
    const startOverall = Date.now();
    const stepResults: Record<string, NormalizedCapabilityResult> = {};
    const context: CapabilityContext = {
      ...initialContext,
      priorTaskOutputs: stepResults,
    };

    let finalResult: NormalizedCapabilityResult = {
      status: "success",
      output: "",
      latencyMs: 0,
    };

    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i] as TaskPlan;
      const taskId = task.taskId || task.id || `step_${i}`;
      const capabilityId = task.capabilityId || task.capability || "";
      const dependencies = task.dependsOn || task.dependencies || [];

      // Check step budget & timeout
      const budgetCheck = OrchestrationPolicyManager.checkBudgetExceeded(
        Date.now() - startOverall,
        i
      );
      if (budgetCheck.exceeded) {
        finalResult = {
          status: "timeout",
          output: "I apologize, but your request took longer than expected to process. Please try again.",
          error: budgetCheck.reason,
        };
        break;
      }

      // Check dependencies
      if (dependencies && dependencies.length > 0) {
        const missingDeps = dependencies.filter((depId) => !stepResults[depId]);
        if (missingDeps.length > 0) {
          finalResult = {
            status: "permanent_failure",
            output: "Execution plan failed due to missing prerequisite tasks.",
            error: `Missing dependencies: ${missingDeps.join(", ")}`,
          };
          break;
        }
      }

      const capability = CapabilityRegistry.get(capabilityId);
      if (!capability) {
        finalResult = {
          status: "permanent_failure",
          output: "Required capability not found.",
          error: `Capability ${capabilityId} not registered`,
        };
        break;
      }

      // Authorize capability execution
      const auth = OrchestrationPolicyManager.authorizeCapability(capability, context);
      if (!auth.allowed) {
        finalResult = {
          status: "auth_failure",
          output: "You do not have permission to execute this operation.",
          error: auth.reason,
        };
        break;
      }

      // Merge outputs of prior steps into task input if applicable
      const inputArgs = { ...(task.inputArgs || task.inputPayload || {}) };
      if (capabilityId === "support_agent" && stepResults["step_retrieve"]) {
        const retrievalOutput = stepResults["step_retrieve"].output;
        if (retrievalOutput) {
          inputArgs.prompt = `${context.userPrompt}\n\n[Retrieved Evidence]:\n${retrievalOutput}`;
        }
      }

      if (capabilityId === "quality_evaluation" && stepResults["step_synthesize"]) {
        inputArgs.agentAnswer = stepResults["step_synthesize"].output;
        inputArgs.userQuestion = context.userPrompt;
      }

      // Execute task protected by reliable AI executor
      const taskStart = Date.now();
      try {
        const taskResult = await executeReliableAI(
          async () => capability.execute(ctx, context, inputArgs),
          {
            timeoutMs: capability.defaultTimeoutMs,
            maxRetries: capability.maxRetries,
          }
        );

        taskResult.latencyMs = Date.now() - taskStart;
        stepResults[taskId] = taskResult;

        // Propagate evidence citations if available
        if (taskResult.evidence && taskResult.evidence.length > 0) {
          finalResult.evidence = taskResult.evidence;
        }

        // Check if task requested escalation
        if (taskResult.status === "escalation_required") {
          finalResult = taskResult;
          break;
        }

        if (taskResult.status === "insufficient_evidence") {
          // If pure exact lookup or no evidence found, provide clear abstention
          if (plan.routingCategory === "policy_exact_lookup") {
            finalResult = {
              status: "insufficient_evidence",
              output: `I could not find a verified policy document matching that identifier in our knowledge base. Would you like me to connect you with a human specialist?`,
              evidence: [],
            };
            break;
          }
        }

        // For response-generating tasks, set as current final result
        if (taskResult.output && capabilityId !== "quality_evaluation") {
          finalResult = taskResult;
        }

        // Handle abortOnFailure
        if (
          task.abortOnFailure &&
          (taskResult.status === "permanent_failure" ||
            taskResult.status === "retryable_failure")
        ) {
          finalResult = taskResult;
          break;
        }
      } catch (err: any) {
        const errorResult: NormalizedCapabilityResult = {
          status: "permanent_failure",
          output: "An error occurred while processing this request step.",
          error: err.message,
          latencyMs: Date.now() - taskStart,
        };
        stepResults[taskId] = errorResult;

        if (task.abortOnFailure) {
          finalResult = errorResult;
          break;
        }
      }
    }

    const totalLatencyMs = Date.now() - startOverall;
    finalResult.latencyMs = totalLatencyMs;

    return {
      finalResult,
      stepResults,
      totalLatencyMs,
    };
  }
}
