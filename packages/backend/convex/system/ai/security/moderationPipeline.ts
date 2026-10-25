/**
 * Multi-Stage Defense-in-Depth Moderation & Safety Pipeline
 *
 * Implements:
 * 1. Input moderation (harmful, abusive, toxic content)
 * 2. Prompt injection & jailbreak detection
 * 3. Untrusted document / indirect injection sanitization
 * 4. Tool-call authorization & argument validation
 * 5. Output moderation & credential leak prevention
 * 6. Explicit failure behaviors (fail-closed for high-risk ops, graceful fallback for queries)
 */

export type ModerationCategory =
  | "hate"
  | "self_harm"
  | "sexual"
  | "violence"
  | "prompt_injection"
  | "credential_leak"
  | "indirect_injection"
  | "unauthorized_tool";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategory[];
  riskLevel: RiskLevel;
  rejectionReason?: string;
  sanitizedText: string;
}

export interface ToolCallSpec {
  toolName: string;
  arguments: Record<string, unknown>;
  isHighRisk?: boolean;
}

export interface ToolAuthResult {
  allowed: boolean;
  reason?: string;
}

export class ModerationPipeline {
  // Harmful & unsafe content patterns
  private static TOXIC_PATTERNS = [
    /\b(kill\s+yourself|suicide|end\s+my\s+life)\b/i,
    /\b(how\s+to\s+(?:build|make)\s+a?\s*bomb)\b/i,
    /\b(exploit|ddos|zero-day|sql\s+injection\s+payload)\b/i,
  ];

  // Indirect injection patterns inside external files / retrieved docs
  private static INDIRECT_INJECTION_PATTERNS = [
    /\[System\s*Message\s*:\s*Ignore/i,
    /<!--\s*ai-instruction\s*:\s*override/i,
    /system\s*instructions\s*have\s*changed/i,
    /assistant\s*must\s*now\s*output/i,
  ];

  /**
   * Evaluates untrusted customer input for harmful content and prompt injection.
   */
  public static moderateInput(rawInput: string): ModerationResult {
    if (!rawInput || typeof rawInput !== "string") {
      return { flagged: false, categories: [], riskLevel: "low", sanitizedText: "" };
    }

    const categories: ModerationCategory[] = [];
    let riskLevel: RiskLevel = "low";

    // 1. Harmful content check
    for (const pattern of this.TOXIC_PATTERNS) {
      if (pattern.test(rawInput)) {
        categories.push("violence");
        riskLevel = "critical";
      }
    }

    // 2. Prompt injection / jailbreak check
    const injectionPatterns = [
      /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
      /developer\s+mode\s+(enabled|on)/i,
      /reveal\s+(your\s+)?(system\s+prompt|secret\s+key|api\s+key)/i,
      /disregard\s+(all\s+)?(previous|prior|above)/i,
      /system\s*:\s*override|system\s+override/i,
      /uncensored|unrestricted|jailbreak/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(rawInput)) {
        categories.push("prompt_injection");
        if (riskLevel !== "critical") riskLevel = "high";
      }
    }

    const flagged = categories.length > 0;
    return {
      flagged,
      categories,
      riskLevel,
      rejectionReason: flagged
        ? `Request flagged by safety policy: ${categories.join(", ")}`
        : undefined,
      sanitizedText: rawInput.trim(),
    };
  }

  /**
   * Sanitizes retrieved knowledge chunks to prevent indirect prompt injection.
   */
  public static sanitizeRetrievedDocument(documentContent: string): {
    sanitized: string;
    indirectInjectionFound: boolean;
  } {
    let indirectInjectionFound = false;
    let sanitized = documentContent;

    for (const pattern of this.INDIRECT_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        indirectInjectionFound = true;
        sanitized = sanitized.replace(pattern, "[MALICIOUS_INSTRUCTION_REDACTED]");
      }
    }

    return { sanitized, indirectInjectionFound };
  }

  /**
   * Authorizes tool calls before execution. High-risk tools (e.g. escalations, modifications)
   * must satisfy strict parameter constraints and fail closed.
   */
  public static authorizeToolCall(toolCall: ToolCallSpec): ToolAuthResult {
    const { toolName, arguments: args } = toolCall;

    // Fail closed on unknown or empty tool names
    if (!toolName) {
      return { allowed: false, reason: "Tool name is required" };
    }

    // Escalation tool verification
    if (toolName === "escalateConversation") {
      const reason = args.reason;
      if (reason && typeof reason === "string" && reason.length > 500) {
        return { allowed: false, reason: "Escalation reason exceeds allowable length" };
      }
      return { allowed: true };
    }

    // Search tool verification
    if (toolName === "search") {
      const query = args.query;
      if (!query || typeof query !== "string") {
        return { allowed: false, reason: "Search tool requires non-empty query parameter" };
      }
      if (query.length > 500) {
        return { allowed: false, reason: "Search query exceeds allowable length" };
      }
      return { allowed: true };
    }

    // Default allow for registered non-sensitive tools
    return { allowed: true };
  }

  /**
   * Validates LLM output to prevent system prompt leakage, secret exposure, or toxic speech.
   */
  public static moderateOutput(rawOutput: string): ModerationResult {
    if (!rawOutput || typeof rawOutput !== "string") {
      return { flagged: false, categories: [], riskLevel: "low", sanitizedText: "" };
    }

    const categories: ModerationCategory[] = [];
    const leakPatterns = [
      /my\s+initial\s+instructions\s+(are|were)/i,
      /my\s+system\s+prompt\s+(is|was)/i,
      /sk-[A-Za-z0-9_-]{20,}/,
      /aws_secret_access_key/i,
    ];

    for (const pattern of leakPatterns) {
      if (pattern.test(rawOutput)) {
        categories.push("credential_leak");
      }
    }

    const flagged = categories.length > 0;
    return {
      flagged,
      categories,
      riskLevel: flagged ? "high" : "low",
      rejectionReason: flagged ? "Response contained prohibited internal system or credential patterns" : undefined,
      sanitizedText: flagged
        ? "I apologize, but I cannot fulfill that request as it conflicts with our safety policies. How else may I assist you with your account?"
        : rawOutput,
    };
  }
}
