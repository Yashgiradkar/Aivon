import { RoutingCategory } from "./types";

export class ConversationRouter {
  private static GREETING_REGEX =
    /^(hi|hello|hey|howdy|good\s+(morning|afternoon|evening))([,\s]+(there|everyone|team|good\s+(morning|afternoon|evening)))*[\s!.,]*$/i;

  private static ESCALATION_REGEX =
    /\b(speak|talk|connect|transfer)\s+(me\s+)?(to|with)\s+(a\s+)?(real\s+)?(human|agent|person|representative|operator|specialist|support)\b|\b(need|want)\s+(to\s+)?(speak|talk|connect)\s+(to|with)\b|\bhuman\s+(agent|support|specialist|operator|person)\b|\b(live\s+agent|real\s+person|representative\s+now|transfer\s+me)\b/i;

  private static RESOLUTION_REGEX =
    /\b(that\s+solved\s+(it|my\s+problem)|issue\s+(is\s+)?resolved|problem\s+(is\s+)?solved|all\s+(good|fixed)\s+now|that\s+fixed\s+it|close\s+(this\s+)?ticket|i'?m\s+all\s+set|thanks\s+that'?s\s+all)\b/i;

  private static POLICY_CODE_REGEX =
    /\b(POL|DOC|REF|INV|INS|ACCT|SEC)-[A-Z0-9]{2,12}\b|\b[A-Z]{2,6}-[A-Z0-9]{2,6}-\d{4,8}\b|\b[A-Z]{2,4}-\d{4,8}\b/i;

  private static MULTI_STEP_REGEX =
    /\b(first\b.*\bthen\b|\bstep\s+by\s+step\b|\band\s+(then|lastly|finally)\b)/i;

  /**
   * Deterministically classifies the user query intent to avoid unnecessary LLM planning overhead.
   */
  public static classifyIntent(prompt: string): RoutingCategory {
    const trimmed = prompt.trim();

    if (this.GREETING_REGEX.test(trimmed)) {
      return "greeting";
    }

    if (this.ESCALATION_REGEX.test(trimmed)) {
      return "escalation_request";
    }

    if (this.RESOLUTION_REGEX.test(trimmed)) {
      return "resolution_request";
    }

    if (this.POLICY_CODE_REGEX.test(trimmed)) {
      return "policy_exact_lookup";
    }

    if (this.MULTI_STEP_REGEX.test(trimmed)) {
      return "complex_multi_step";
    }

    // Check for complex multi-part queries (e.g. multiple distinct question marks)
    const questionMarks = (trimmed.match(/\?/g) || []).length;
    if (questionMarks >= 2 && trimmed.length > 120) {
      return "complex_multi_step";
    }

    if (this.TRAVEL_REGEX.test(trimmed)) {
      return "travel_inquiry";
    }

    return "knowledge_query";
  }

  private static TRAVEL_REGEX =
    /\b(travel\s+from|trip\s+to|train\s+to|flight\s+to|bus\s+to|book\s+(train|flight|bus|ticket)|from\s+[a-zA-Z\s]+?\s+to\s+[a-zA-Z\s]+?)\b/i;
}
