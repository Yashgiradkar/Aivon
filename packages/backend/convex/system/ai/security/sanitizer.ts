/**
 * Security Input Sanitizer & Prompt Injection Defense
 *
 * Implements:
 * 1. Input normalization & character cleanup
 * 2. Prompt injection & jailbreak detection
 * 3. Structured boundary tagging (separating trusted instructions from untrusted data)
 * 4. PII masking for observability & logging
 */

// Common prompt injection & jailbreak heuristic patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /system\s*:\s*override/i,
  /you\s+are\s+now\s+(an?\s+)?unfiltered/i,
  /developer\s+mode\s+(enabled|on)/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,
  /repeat\s+(everything|the\s+prompt|the\s+system\s+instructions)/i,
  /reveal\s+(your\s+)?(system\s+prompt|secret\s+key|api\s+key)/i,
  /print\s+your\s+initial\s+instructions/i,
  /simulate\s+a\s+conversation\s+where\s+you\s+are\s+an\s+unrestricted/i,
];

// PII detection regex patterns
const PII_PATTERNS = {
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
};

export interface SanitizedInputResult {
  sanitizedText: string;
  isSuspicious: boolean;
  matchedThreats: string[];
  sanitizedForLogging: string;
}

/**
 * Normalizes user input by stripping non-printable control characters,
 * enforcing reasonable length boundaries, and evaluating injection risk.
 */
export function sanitizeUserInput(
  rawInput: string,
  maxLength: number = 4000
): SanitizedInputResult {
  if (!rawInput || typeof rawInput !== "string") {
    return {
      sanitizedText: "",
      isSuspicious: false,
      matchedThreats: [],
      sanitizedForLogging: "",
    };
  }

  // 1. Remove dangerous control characters while preserving standard whitespace
  let clean = rawInput
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  // 2. Length bounding
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }

  // 3. Prompt injection detection
  const matchedThreats: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(clean)) {
      matchedThreats.push(pattern.source);
    }
  }

  const isSuspicious = matchedThreats.length > 0;

  // 4. PII Redacted copy for observability / logs
  let sanitizedForLogging = clean
    .replace(PII_PATTERNS.creditCard, "[REDACTED_CC]")
    .replace(PII_PATTERNS.ssn, "[REDACTED_SSN]");

  return {
    sanitizedText: clean,
    isSuspicious,
    matchedThreats,
    sanitizedForLogging,
  };
}

/**
 * Redacts sensitive PII from any arbitrary text string for safe logging.
 */
export function maskPIIForLogging(text: string): string {
  if (!text) return "";
  return text
    .replace(PII_PATTERNS.creditCard, "[REDACTED_CC]")
    .replace(PII_PATTERNS.ssn, "[REDACTED_SSN]");
}

/**
 * Encapsulates user input inside explicit markdown boundary tags to prevent
 * the LLM from misinterpreting user content as privileged system directives.
 */
export function wrapUntrustedUserInput(input: string): string {
  return `<untrusted_user_input>\n${input}\n</untrusted_user_input>`;
}

/**
 * Encapsulates retrieved knowledge inside explicit boundary tags.
 */
export function wrapRetrievedKnowledge(knowledge: string): string {
  return `<retrieved_knowledge_base>\n${knowledge}\n</retrieved_knowledge_base>`;
}
