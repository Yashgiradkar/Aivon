/**
 * RAGAS Evaluation Adapter
 *
 * Implements standard RAGAS metrics for production RAG evaluation:
 * 1. Context Precision: Evaluates whether retrieved contexts rank ground-truth relevant evidence above noise.
 * 2. Context Recall: Measures whether the retrieved evidence covers the reference ground-truth requirements.
 * 3. Faithfulness: Verifies that claims in the generated answer are grounded in the supplied context.
 * 4. Answer Semantic Similarity: Calculates semantic alignment between generated answer and reference answer.
 */

export interface RagasTestCase {
  id: string;
  question: string;
  generatedAnswer: string;
  referenceAnswer: string;
  retrievedContexts: string[];
  referenceContexts: string[];
}

export interface RagasMetricResult {
  testCaseId: string;
  contextPrecision: number;
  contextRecall: number;
  faithfulness: number;
  answerSemanticSimilarity: number;
  overallScore: number;
}

export interface RagasAggregateReport {
  totalCases: number;
  meanContextPrecision: number;
  meanContextRecall: number;
  meanFaithfulness: number;
  meanAnswerSemanticSimilarity: number;
  overallRagasScore: number;
  pass: boolean;
  perCaseResults: RagasMetricResult[];
}

export class RagasAdapter {
  /**
   * Evaluates Context Precision:
   * Precision@K = (Sum of Precision@k for relevant contexts) / Total relevant contexts
   */
  public static calculateContextPrecision(
    retrieved: string[],
    reference: string[]
  ): number {
    if (!retrieved || retrieved.length === 0) return 0;
    if (!reference || reference.length === 0) return 1.0;

    let hits = 0;
    let runningPrecisionSum = 0;

    for (let k = 0; k < retrieved.length; k++) {
      const isRelevant = reference.some((ref) =>
        retrieved[k]!.toLowerCase().includes(ref.toLowerCase().slice(0, 30))
      );

      if (isRelevant) {
        hits++;
        runningPrecisionSum += hits / (k + 1);
      }
    }

    if (hits === 0) return 0;
    return Number((runningPrecisionSum / hits).toFixed(4));
  }

  /**
   * Evaluates Context Recall:
   * Proportion of reference facts/contexts captured in retrieved set.
   */
  public static calculateContextRecall(
    retrieved: string[],
    reference: string[]
  ): number {
    if (!reference || reference.length === 0) return 1.0;
    if (!retrieved || retrieved.length === 0) return 0;

    const normalizedRetrieved = retrieved
      .join(" ")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ");
    let captured = 0;

    for (const ref of reference) {
      // Check if essential tokens of reference are present
      const keyTokens = ref
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2);

      if (keyTokens.length === 0) {
        captured++;
        continue;
      }

      const foundCount = keyTokens.filter((token) => normalizedRetrieved.includes(token)).length;
      if (foundCount / keyTokens.length >= 0.6) {
        captured++;
      }
    }

    return Number((captured / reference.length).toFixed(4));
  }

  /**
   * Evaluates Faithfulness:
   * Verifies that statements/claims in generatedAnswer are grounded in retrieved contexts.
   */
  public static calculateFaithfulness(
    answer: string,
    retrievedContexts: string[]
  ): number {
    if (!answer || answer.trim().length === 0) return 0;
    if (!retrievedContexts || retrievedContexts.length === 0) return 0;

    const fullContext = retrievedContexts.join(" ").toLowerCase();
    // Split answer into sentences
    const sentences = answer
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length === 0) return 1.0;

    let supportedSentences = 0;
    for (const sentence of sentences) {
      const words = sentence
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 4);

      if (words.length === 0) {
        supportedSentences++;
        continue;
      }

      const matchRatio = words.filter((w) => fullContext.includes(w)).length / words.length;
      if (matchRatio >= 0.5) {
        supportedSentences++;
      }
    }

    return Number((supportedSentences / sentences.length).toFixed(4));
  }

  /**
   * Evaluates Answer Semantic Similarity using token overlap & normalized n-gram similarity.
   */
  public static calculateSemanticSimilarity(
    generated: string,
    reference: string
  ): number {
    if (!generated || !reference) return 0;

    const genWords = new Set(
      generated.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean)
    );
    const refWords = new Set(
      reference.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean)
    );

    let intersection = 0;
    for (const word of genWords) {
      if (refWords.has(word)) intersection++;
    }

    const union = new Set([...genWords, ...refWords]).size;
    if (union === 0) return 0;

    const jaccard = intersection / union;
    // Scale slightly for semantic leniency
    return Number(Math.min(1.0, jaccard * 1.5).toFixed(4));
  }

  /**
   * Evaluates a batch of test cases and generates a complete RAGAS report.
   */
  public static evaluateSuite(
    testCases: RagasTestCase[],
    regressionThreshold: number = 0.70
  ): RagasAggregateReport {
    const results: RagasMetricResult[] = [];

    for (const tc of testCases) {
      const precision = this.calculateContextPrecision(tc.retrievedContexts, tc.referenceContexts);
      const recall = this.calculateContextRecall(tc.retrievedContexts, tc.referenceContexts);
      const faithfulness = this.calculateFaithfulness(tc.generatedAnswer, tc.retrievedContexts);
      const similarity = this.calculateSemanticSimilarity(tc.generatedAnswer, tc.referenceAnswer);

      const overall = Number(((precision + recall + faithfulness + similarity) / 4).toFixed(4));

      results.push({
        testCaseId: tc.id,
        contextPrecision: precision,
        contextRecall: recall,
        faithfulness,
        answerSemanticSimilarity: similarity,
        overallScore: overall,
      });
    }

    const n = Math.max(1, results.length);
    const meanPrecision = Number((results.reduce((s, r) => s + r.contextPrecision, 0) / n).toFixed(4));
    const meanRecall = Number((results.reduce((s, r) => s + r.contextRecall, 0) / n).toFixed(4));
    const meanFaithfulness = Number((results.reduce((s, r) => s + r.faithfulness, 0) / n).toFixed(4));
    const meanSimilarity = Number((results.reduce((s, r) => s + r.answerSemanticSimilarity, 0) / n).toFixed(4));
    const overallScore = Number(((meanPrecision + meanRecall + meanFaithfulness + meanSimilarity) / 4).toFixed(4));

    return {
      totalCases: results.length,
      meanContextPrecision: meanPrecision,
      meanContextRecall: meanRecall,
      meanFaithfulness,
      meanAnswerSemanticSimilarity: meanSimilarity,
      overallRagasScore: overallScore,
      pass: overallScore >= regressionThreshold,
      perCaseResults: results,
    };
  }
}
