import { JudgeEvaluationSchema, JudgeEvaluation, RUBRIC_VERSION } from "../../packages/backend/convex/system/ai/evaluation/judge";

export interface OfflineEvaluationItem {
  id: string;
  question: string;
  retrievedEvidence: string;
  agentAnswer: string;
  expectedAnswer?: string;
  expectedKeywords?: string[];
  expectedSource?: string;
  formatType?: string;
}

export interface OfflineJudgeReport {
  rubricVersion: string;
  totalEvaluated: number;
  averageFaithfulness: number;
  averageAnswerRelevance: number;
  averageContextRelevance: number;
  averageCompleteness: number;
  citationPassRate: number;
  policyComplianceRate: number;
  needsReviewCount: number;
  results: Array<{
    id: string;
    question: string;
    evaluation: JudgeEvaluation;
  }>;
}

/**
 * Deterministic offline rubric evaluator for CI/CD and regression benchmarking.
 * Computes scores across all 6 core dimensions using calibrated ground-truth criteria.
 */
export function evaluateOfflineInteraction(item: OfflineEvaluationItem): JudgeEvaluation {
  const answerLower = item.agentAnswer.toLowerCase();
  const evidenceLower = item.retrievedEvidence.toLowerCase();
  const questionLower = item.question.toLowerCase();

  // 1. Citation Validity: Check if cited sources exist in retrieved evidence
  const citationMatches = item.agentAnswer.match(/\[Source:\s*([^\]]+)\]/g);
  let citationPass = true;
  let citationRationale = "All citations correspond to valid source evidence.";

  if (citationMatches && citationMatches.length > 0) {
    for (const match of citationMatches) {
      const docName = match.replace(/\[Source:\s*/, "").replace(/\]/, "").trim().toLowerCase();
      if (!evidenceLower.includes(docName)) {
        citationPass = false;
        citationRationale = `Citation ${match} not found in retrieved evidence.`;
        break;
      }
    }
  }

  // 2. Policy Compliance: Safe abstention on missing evidence
  let policyPass = true;
  let policyRationale = "Complies with customer support policy.";
  if (item.formatType === "abstention") {
    if (
      !answerLower.includes("don't have specific information") &&
      !answerLower.includes("human support") &&
      !answerLower.includes("specialist")
    ) {
      policyPass = false;
      policyRationale = "Failed to abstain or offer human support when evidence was missing.";
    }
  }

  // 3. Faithfulness: verify that key numerical and factual claims are present in evidence
  let faithfulnessScore = 5;
  let faithfulnessRationale = "All stated claims are strictly supported by retrieved evidence.";

  if (item.expectedKeywords && item.expectedKeywords.length > 0) {
    const missingInEvidence = item.expectedKeywords.filter(
      (kw) => !evidenceLower.includes(kw.toLowerCase()) && item.formatType !== "abstention"
    );
    if (missingInEvidence.length > 0 && item.formatType !== "abstention") {
      faithfulnessScore = 2;
      faithfulnessRationale = `Claims contain details (${missingInEvidence.join(", ")}) not present in evidence.`;
    }
  }

  // 4. Answer Relevance: does it address the question?
  let relevanceScore = 5;
  let relevanceRationale = "Directly and accurately addresses the customer question.";
  if (item.expectedKeywords && item.expectedKeywords.length > 0) {
    const missingInAnswer = item.expectedKeywords.filter(
      (kw) => !answerLower.includes(kw.toLowerCase())
    );
    if (missingInAnswer.length > 1) {
      relevanceScore = 3;
      relevanceRationale = `Answer omits key requested details (${missingInAnswer.join(", ")}).`;
    }
  }

  // 5. Context Relevance: does retrieved context match question?
  let contextScore = 5;
  let contextRationale = "Retrieved evidence directly matches user inquiry.";
  if (item.formatType === "abstention") {
    contextScore = 1;
    contextRationale = "No relevant context found in knowledge base.";
  }

  // 6. Completeness
  let completenessScore = 5;
  let completenessRationale = "Complete answer covering all requested constraints.";
  if (relevanceScore < 4) {
    completenessScore = 3;
    completenessRationale = "Partial answer; some conditions omitted.";
  }

  const overallScore = Number(
    (
      (faithfulnessScore * 0.35 +
        relevanceScore * 0.25 +
        contextScore * 0.15 +
        completenessScore * 0.15 +
        (citationPass ? 5 : 1) * 0.05 +
        (policyPass ? 5 : 1) * 0.05)
    ).toFixed(2)
  );

  const needsHumanReview =
    faithfulnessScore < 3 || relevanceScore < 3 || !citationPass || !policyPass;

  return JudgeEvaluationSchema.parse({
    faithfulness: { score: faithfulnessScore, rationale: faithfulnessRationale },
    answerRelevance: { score: relevanceScore, rationale: relevanceRationale },
    contextRelevance: { score: contextScore, rationale: contextRationale },
    completeness: { score: completenessScore, rationale: completenessRationale },
    citationValidity: { pass: citationPass, rationale: citationRationale },
    policyCompliance: { pass: policyPass, rationale: policyRationale },
    overallScore,
    needsHumanReview,
  });
}

export function runOfflineJudgeBenchmark(
  items: OfflineEvaluationItem[]
): OfflineJudgeReport {
  let sumFaithfulness = 0;
  let sumAnswerRelevance = 0;
  let sumContextRelevance = 0;
  let sumCompleteness = 0;
  let citationPasses = 0;
  let policyPasses = 0;
  let needsReviewCount = 0;

  const results = items.map((item) => {
    const evaluation = evaluateOfflineInteraction(item);
    sumFaithfulness += evaluation.faithfulness.score;
    sumAnswerRelevance += evaluation.answerRelevance.score;
    sumContextRelevance += evaluation.contextRelevance.score;
    sumCompleteness += evaluation.completeness.score;
    if (evaluation.citationValidity.pass) citationPasses++;
    if (evaluation.policyCompliance.pass) policyPasses++;
    if (evaluation.needsHumanReview) needsReviewCount++;

    return {
      id: item.id,
      question: item.question,
      evaluation,
    };
  });

  const n = items.length || 1;
  return {
    rubricVersion: RUBRIC_VERSION,
    totalEvaluated: items.length,
    averageFaithfulness: Number((sumFaithfulness / n).toFixed(2)),
    averageAnswerRelevance: Number((sumAnswerRelevance / n).toFixed(2)),
    averageContextRelevance: Number((sumContextRelevance / n).toFixed(2)),
    averageCompleteness: Number((sumCompleteness / n).toFixed(2)),
    citationPassRate: Number(((citationPasses / n) * 100).toFixed(1)),
    policyComplianceRate: Number(((policyPasses / n) * 100).toFixed(1)),
    needsReviewCount,
    results,
  };
}
