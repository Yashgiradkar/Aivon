import { z } from "zod";

/**
 * Output Guardrails & Validation Layer
 *
 * Ensures that model responses meet safety criteria, do not leak system prompts or
 * internal secrets, and conform to expected output schemas.
 */

export const AgentResponseSchema = z.object({
  text: z.string().min(1),
  isEscalated: z.boolean().default(false),
  isResolved: z.boolean().default(false),
  confidenceScore: z.number().min(0).max(1).optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

const SYSTEM_LEAK_PATTERNS = [
  /i am an ai instructed by/i,
  /my initial instructions (are|were)/i,
  /my system prompt (is|was)/i,
  /openai_api_key/i,
  /aws_secret/i,
];

export interface ValidationResult {
  isValid: boolean;
  sanitizedResponse: string;
  violations: string[];
}

/**
 * Validates and sanitizes agent text output before it is delivered to the user or stored.
 */
export function validateAgentOutput(
  rawOutput: string,
  fallbackMessage: string = "I apologize, but I am unable to process that request right now. Would you like me to connect you with a human support agent?"
): ValidationResult {
  if (!rawOutput || typeof rawOutput !== "string" || rawOutput.trim().length === 0) {
    return {
      isValid: false,
      sanitizedResponse: fallbackMessage,
      violations: ["EMPTY_OUTPUT"],
    };
  }

  const violations: string[] = [];

  // Check for system prompt leakage or secret disclosures
  for (const pattern of SYSTEM_LEAK_PATTERNS) {
    if (pattern.test(rawOutput)) {
      violations.push(`LEAK_PATTERN_${pattern.source}`);
    }
  }

  if (violations.length > 0) {
    return {
      isValid: false,
      sanitizedResponse: fallbackMessage,
      violations,
    };
  }

  return {
    isValid: true,
    sanitizedResponse: rawOutput.trim(),
    violations: [],
  };
}
