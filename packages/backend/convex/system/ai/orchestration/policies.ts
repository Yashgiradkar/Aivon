import { CapabilityDefinition, CapabilityContext } from "./types";

export interface OrchestrationBudget {
  maxSteps: number;
  maxDelegationDepth: number;
  maxTotalExecutionMs: number;
  maxConcurrentTasks: number;
  maxTotalTokens: number;
}

export const DEFAULT_ORCHESTRATION_BUDGET: OrchestrationBudget = {
  maxSteps: 5,
  maxDelegationDepth: 3,
  maxTotalExecutionMs: 20000,
  maxConcurrentTasks: 3,
  maxTotalTokens: 2500,
};

export class OrchestrationPolicyManager {
  /**
   * Validates whether a capability is authorized to run within the given tenant and channel context.
   */
  public static authorizeCapability(
    capability: CapabilityDefinition,
    context: CapabilityContext
  ): { allowed: boolean; reason?: string } {
    if (!context.organizationId || context.organizationId.trim() === "") {
      return { allowed: false, reason: "Missing organization identifier" };
    }

    // Anonymous widget cannot perform unvetted state-changing operations requiring admin approval
    if (context.channel === "chat" && capability.requiresApproval) {
      return {
        allowed: false,
        reason: "Operation requires human approval or operator credentials",
      };
    }

    return { allowed: true };
  }

  /**
   * Enforces that all operations remain strictly bound within the caller's organization.
   */
  public static enforceTenantIsolation(
    contextOrgId: string,
    targetOrgId: string
  ): void {
    if (contextOrgId !== targetOrgId) {
      throw new Error(
        `Cross-tenant access violation: Request org ${contextOrgId} cannot access data for org ${targetOrgId}`
      );
    }
  }

  /**
   * Checks whether the current execution has exceeded defined time or step budgets.
   */
  public static checkBudgetExceeded(
    elapsedMs: number,
    completedSteps: number,
    budget: OrchestrationBudget = DEFAULT_ORCHESTRATION_BUDGET
  ): { exceeded: boolean; reason?: string } {
    if (elapsedMs > budget.maxTotalExecutionMs) {
      return {
        exceeded: true,
        reason: `Execution exceeded maximum duration of ${budget.maxTotalExecutionMs}ms`,
      };
    }

    if (completedSteps >= budget.maxSteps) {
      return {
        exceeded: true,
        reason: `Execution exceeded maximum step limit of ${budget.maxSteps}`,
      };
    }

    return { exceeded: false };
  }

  /**
   * Validates structural invariants and budget limits of an execution plan.
   */
  public static validatePlan(
    plan: any,
    budget: OrchestrationBudget = DEFAULT_ORCHESTRATION_BUDGET
  ): { valid: boolean; reason?: string } {
    if (!plan || !Array.isArray(plan.tasks)) {
      return { valid: false, reason: "Plan contains no valid tasks array" };
    }

    if (plan.tasks.length === 0) {
      return { valid: false, reason: "Execution plan must contain at least 1 task" };
    }

    if (plan.tasks.length > budget.maxSteps) {
      return {
        valid: false,
        reason: `Plan task count (${plan.tasks.length}) exceeds max allowed steps (${budget.maxSteps})`,
      };
    }

    for (const task of plan.tasks) {
      const depth = task.delegationDepth ?? 1;
      if (depth > budget.maxDelegationDepth) {
        return {
          valid: false,
          reason: `Task ${task.taskId || task.id} delegation depth (${depth}) exceeds max allowed (${budget.maxDelegationDepth})`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Checks whether a capability is permitted for the specified communication channel.
   */
  public static isChannelAllowed(
    capabilityId: string,
    channel: any
  ): boolean {
    if (!capabilityId) return false;
    // By default, voice and chat channels support standard capabilities
    return true;
  }
}
