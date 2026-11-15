import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

/**
 * Versioned LLM-as-a-Judge Rubric & Evaluator
 * Evaluates retrieval relevance, answer faithfulness, answer relevance,
 * completeness, citation validity, and policy compliance.
 */

export const RUBRIC_VERSION = "2026.1";

export const JudgeEvaluationSchema = z.object({
  faithfulness: z.object({
    score: z.number().min(1).max(5).describe("1=Hallucinated/Contradicts evidence, 3=Minor ungrounded claims, 5=Strictly grounded in evidence"),
    rationale: z.string(),
  }),
  answerRelevance: z.object({
    score: z.number().min(1).max(5).describe("1=Completely off-topic, 3=Partially answers, 5=Directly and concisely answers user question"),
    rationale: z.string(),
  }),
  contextRelevance: z.object({
    score: z.number().min(1).max(5).describe("1=Retrieved evidence irrelevant, 3=Partially relevant, 5=Retrieved evidence directly answers question"),
    rationale: z.string(),
  }),
  completeness: z.object({
    score: z.number().min(1).max(5).describe("1=Missing critical answers/units/conditions, 3=Addresses main point only, 5=Thorough and complete"),
    rationale: z.string(),
  }),
  citationValidity: z.object({
    pass: z.boolean().describe("true if cited documents exist in the retrieved evidence, false if fabricated"),
    rationale: z.string(),
  }),
  policyCompliance: z.object({
    pass: z.boolean().describe("true if adheres to support policy (abstains/escalates safely on missing evidence), false if unauthorized commitments made"),
    rationale: z.string(),
  }),
  toolUseCorrectness: z.object({
    score: z.number().min(1).max(5).describe("1=Wrong tool or failed to escalate, 5=Correct tool or safe handling"),
    rationale: z.string(),
  }).optional(),
  overallScore: z.number().min(1).max(5),
  needsHumanReview: z.boolean().describe("Flagged for human operator review if faithfulness < 3, relevance < 3, or citations/policy fails"),
});

export type JudgeEvaluation = z.infer<typeof JudgeEvaluationSchema>;

export const JUDGE_SYSTEM_PROMPT = `
You are an expert, impartial AI Judge and Quality Assurance Evaluator for an enterprise customer support platform.
Your task is to evaluate the interaction between a Customer and an AI Support Agent against rigorous criteria.

### Scoring Rubric (1 to 5 Scale):
1. **Faithfulness**:
   - 5: Every single claim, number, unit, and condition in the answer is directly supported by the retrieved evidence.
   - 3: Mostly supported; no outright contradictions, but slight extrapolation or vague phrasing.
   - 1: Severe hallucination; contains claims contrary to or completely absent from the evidence.
2. **Answer Relevance**:
   - 5: Directly, concisely, and accurately answers the customer's specific question.
   - 3: Answers part of the question, or contains unnecessary filler.
   - 1: Off-topic or ignores the customer's intent.
3. **Context Relevance**:
   - 5: Retrieved evidence contains the exact necessary tables, charts, or text to answer the question.
   - 3: Partially relevant context with some noise.
   - 1: Irrelevant or empty context.
4. **Completeness**:
   - 5: Fully addresses all constraints, units, and conditions mentioned in the prompt and evidence.
   - 3: Answers primary question but misses secondary stipulations.
   - 1: Incomplete or superficial.
5. **Citation Validity**:
   - pass=true: Citations ([Source: ...]) match actual documents in the retrieved evidence.
   - pass=false: Fabricated citations or citations to documents not present.
6. **Policy Compliance**:
   - pass=true: Complies with customer support policy. If evidence was missing, appropriately offered escalation or human assistance rather than guessing.
   - pass=false: Made unauthorized financial/legal promises or gave advice contradictory to policy.

You must return valid JSON strictly conforming to the following structure:
{
  "faithfulness": { "score": number, "rationale": "..." },
  "answerRelevance": { "score": number, "rationale": "..." },
  "contextRelevance": { "score": number, "rationale": "..." },
  "completeness": { "score": number, "rationale": "..." },
  "citationValidity": { "pass": boolean, "rationale": "..." },
  "policyCompliance": { "pass": boolean, "rationale": "..." },
  "toolUseCorrectness": { "score": number, "rationale": "..." },
  "overallScore": number,
  "needsHumanReview": boolean
}
`;

export interface EvaluateInteractionArgs {
  userQuestion: string;
  agentAnswer: string;
  retrievedEvidence?: string;
  toolsUsed?: string[];
  judgeModel?: string;
}

export async function evaluateWithJudge(
  args: EvaluateInteractionArgs
): Promise<JudgeEvaluation> {
  const modelName = args.judgeModel || "gpt-4o-mini";

  const promptContent = `
[EVALUATION CASE]
Customer Question:
"""
${args.userQuestion}
"""

Retrieved Evidence from Knowledge Base:
"""
${args.retrievedEvidence || "None / Not provided"}
"""

Tools Used:
${args.toolsUsed && args.toolsUsed.length > 0 ? args.toolsUsed.join(", ") : "None"}

AI Agent Answer:
"""
${args.agentAnswer}
"""

Evaluate this interaction thoroughly using the rubric and return the JSON object.
`;

  try {
    const result = await generateText({
      model: openai.chat(modelName),
      system: JUDGE_SYSTEM_PROMPT,
      prompt: promptContent,
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in judge output");
    }

    const parsedJson = JSON.parse(jsonMatch[0]);
    const validated = JudgeEvaluationSchema.parse(parsedJson);
    return validated;
  } catch (err) {
    // Robust fallback evaluation if parsing fails or LLM times out
    console.warn("[Judge] Evaluation fallback due to:", err);
    return {
      faithfulness: { score: 3, rationale: "Automated heuristic fallback evaluation." },
      answerRelevance: { score: 3, rationale: "Automated heuristic fallback evaluation." },
      contextRelevance: { score: 3, rationale: "Automated heuristic fallback evaluation." },
      completeness: { score: 3, rationale: "Automated heuristic fallback evaluation." },
      citationValidity: { pass: true, rationale: "Default pass under fallback." },
      policyCompliance: { pass: true, rationale: "Default pass under fallback." },
      overallScore: 3.0,
      needsHumanReview: true,
    };
  }
}
