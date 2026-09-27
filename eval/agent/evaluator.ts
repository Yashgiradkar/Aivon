/**
 * AI Agent Trajectory & Tool Selection Evaluator
 */

export interface AgentEvalItem {
  question: string;
  expectedTool: string;
  actualToolCalled?: string;
  expectedKeywords: string[];
  actualAnswer: string;
}

export interface AgentEvalMetrics {
  toolSelectionAccuracy: number;
  keywordMatchRate: number;
  totalEvaluated: number;
}

export function evaluateAgentPerformance(items: AgentEvalItem[]): AgentEvalMetrics {
  if (items.length === 0) {
    return { toolSelectionAccuracy: 0, keywordMatchRate: 0, totalEvaluated: 0 };
  }

  let correctToolCount = 0;
  let totalKeywordMatches = 0;
  let totalExpectedKeywords = 0;

  for (const item of items) {
    if (item.expectedTool === "none") {
      if (!item.actualToolCalled || item.actualToolCalled === "none") {
        correctToolCount++;
      }
    } else if (item.actualToolCalled === item.expectedTool) {
      correctToolCount++;
    }

    const answerLower = item.actualAnswer.toLowerCase();
    for (const kw of item.expectedKeywords) {
      totalExpectedKeywords++;
      if (answerLower.includes(kw.toLowerCase())) {
        totalKeywordMatches++;
      }
    }
  }

  return {
    toolSelectionAccuracy: Number((correctToolCount / items.length).toFixed(4)),
    keywordMatchRate:
      totalExpectedKeywords > 0
        ? Number((totalKeywordMatches / totalExpectedKeywords).toFixed(4))
        : 1.0,
    totalEvaluated: items.length,
  };
}
