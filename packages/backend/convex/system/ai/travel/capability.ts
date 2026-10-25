import { CapabilityDefinition, CapabilityContext, NormalizedCapabilityResult } from "../orchestration/types";
import { TravelWorkflowManager } from "./workflow";
import { TravelWorkflowState, TravelSlots, TravelOption } from "./types";

export const TravelAgentCapability: CapabilityDefinition = {
  id: "travel_agent",
  name: "AI Travel Assistant",
  version: "1.0.0",
  description: "Specialized conversational voice agent for searching trains, flights, and buses, calculating fares, and executing validated bookings",
  isReadOnly: false,
  requiresApproval: false,
  defaultTimeoutMs: 12000,
  timeoutMs: 12000,
  maxRetries: 2,
  supportedChannels: ["voice", "chat", "operator"],
  execute: async (_ctx, context: CapabilityContext, inputArgs): Promise<NormalizedCapabilityResult> => {
    const startTime = Date.now();
    const prompt = (inputArgs?.prompt as string) || context.userPrompt;
    const currentState = ((inputArgs?.currentState as string) || "GREETING") as TravelWorkflowState;
    const currentSlots = (inputArgs?.currentSlots || {}) as TravelSlots;
    const availableOptions = (inputArgs?.availableOptions || []) as TravelOption[];
    const selectedOption = inputArgs?.selectedOption as TravelOption | undefined;

    try {
      const turnResult = await TravelWorkflowManager.processTurn({
        spokenText: prompt,
        currentState,
        currentSlots,
        availableOptions,
        selectedOption,
      });

      return {
        status: "success",
        output: turnResult.spokenResponse,
        latencyMs: Date.now() - startTime,
        metadata: {
          nextState: turnResult.nextState,
          updatedSlots: turnResult.updatedSlots,
          options: turnResult.options,
          selectedOption: turnResult.selectedOption,
          confirmationRequired: turnResult.confirmationRequired,
          bookingResult: turnResult.bookingResult,
          suggestedQuickReplies: turnResult.suggestedQuickReplies,
        },
      };
    } catch (err: any) {
      return {
        status: "retryable_failure",
        output: "I encountered an issue processing your travel request. Please let me know your departure and destination again.",
        error: err.message || "Travel agent turn execution failed",
        latencyMs: Date.now() - startTime,
      };
    }
  },
};
