import { evaluateRetrieval } from "./retrieval/evaluator";
import { evaluateAgentPerformance } from "./agent/evaluator";
import { runOfflineJudgeBenchmark } from "./judge/offlineJudge";
import goldenData from "./dataset/golden.json";

/**
 * CLI Evaluation Runner
 * Executes benchmarks against multi-format golden dataset and prints structured metrics.
 */
export async function runEvaluation(): Promise<void> {
  console.log("=================================================");
  console.log("   Aivon AI Multi-Format RAG & Judge Benchmark   ");
  console.log("=================================================");
  console.log(`Loaded ${goldenData.length} multi-format golden test cases.\n`);

  // 1. RAG Retrieval Metrics Benchmark
  const mockRetrievalResults = [
    { retrievedDocIds: ["doc_1", "doc_2", "doc_3"], relevantDocIds: ["doc_1"] },
    { retrievedDocIds: ["doc_4", "doc_5", "doc_6"], relevantDocIds: ["doc_4", "doc_7"] },
    { retrievedDocIds: ["doc_8", "doc_9", "doc_10"], relevantDocIds: ["doc_8"] },
    { retrievedDocIds: ["doc_11", "doc_12", "doc_13"], relevantDocIds: ["doc_12"] },
  ];

  const retrievalMetrics = evaluateRetrieval(mockRetrievalResults, 3);
  console.log("📊 RAG Retrieval Metrics (Top-3):");
  console.log(`   - Precision@3: ${(retrievalMetrics.precisionAtK * 100).toFixed(1)}%`);
  console.log(`   - Recall@3:    ${(retrievalMetrics.recallAtK * 100).toFixed(1)}%`);
  console.log(`   - MRR:         ${retrievalMetrics.mrr}`);
  console.log(`   - Hit Rate:    ${(retrievalMetrics.hitRate * 100).toFixed(1)}%\n`);

  // 2. Agent Trajectory & Tool Selection Benchmark
  const mockAgentResults = [
    {
      question: "How do I reset my password?",
      expectedTool: "searchTool",
      actualToolCalled: "searchTool",
      expectedKeywords: ["login", "forgot password", "reset link"],
      actualAnswer: "Go to login, click forgot password to receive a reset link [Source: account_help.md].",
    },
    {
      question: "What is the refund period and maximum refund amount for Enterprise tier customers?",
      expectedTool: "searchTool",
      actualToolCalled: "searchTool",
      expectedKeywords: ["Enterprise", "60 days", "$5,000", "refund"],
      actualAnswer: "For Enterprise tier, the refund period is 60 days up to a maximum refund amount of $5,000 [Source: pricing_plans.csv].",
    },
    {
      question: "What was the monthly revenue in INR thousands for March according to the Q1 chart?",
      expectedTool: "searchTool",
      actualToolCalled: "searchTool",
      expectedKeywords: ["March", "135", "INR"],
      actualAnswer: "According to the Q1 chart, the revenue for March was 135 INR thousands [Source: q1_performance_chart.png].",
    },
    {
      question: "I want to talk to a human support agent right now",
      expectedTool: "escalateConversationTool",
      actualToolCalled: "escalateConversationTool",
      expectedKeywords: ["escalate", "human"],
      actualAnswer: "I have escalated your conversation to a human support specialist.",
    },
    {
      question: "What is the warranty policy on quantum processors?",
      expectedTool: "searchTool",
      actualToolCalled: "searchTool",
      expectedKeywords: ["don't have specific information", "human support"],
      actualAnswer: "I don't have specific information about quantum processors in our knowledge base. Would you like me to connect you with a human support specialist?",
    },
  ];

  const agentMetrics = evaluateAgentPerformance(mockAgentResults);
  console.log("🤖 Agent Performance Metrics:");
  console.log(`   - Tool Selection Accuracy: ${(agentMetrics.toolSelectionAccuracy * 100).toFixed(1)}%`);
  console.log(`   - Keyword / Faithfulness Match: ${(agentMetrics.keywordMatchRate * 100).toFixed(1)}%`);
  console.log(`   - Total Scenarios Evaluated: ${agentMetrics.totalEvaluated}\n`);

  // 3. LLM-as-a-Judge Evaluation Benchmark across 6 Dimensions
  const judgeTestCases = [
    {
      id: "tc-001",
      question: "How do I reset my password?",
      retrievedEvidence: 'Source: "account_help.md", Section: "Auth": To reset your password, click Forgot Password on the login page.',
      agentAnswer: "To reset your password, visit the login page and click Forgot Password [Source: account_help.md].",
      expectedKeywords: ["login", "forgot password"],
      expectedSource: "account_help.md",
      formatType: "prose",
    },
    {
      id: "tc-002",
      question: "What is the refund period and maximum refund amount for Enterprise tier customers?",
      retrievedEvidence: 'Source: "pricing_plans.csv", Table: "Plans": Headers: | Tier | Refund Period (days) | Max Refund ($) | Data: - Row 3: Tier="Enterprise", Refund Period="60 days", Max Refund="$5,000"',
      agentAnswer: "Enterprise tier customers have a refund period of 60 days up to a maximum refund of $5,000 [Source: pricing_plans.csv].",
      expectedKeywords: ["Enterprise", "60 days", "$5,000"],
      expectedSource: "pricing_plans.csv",
      formatType: "table",
    },
    {
      id: "tc-003",
      question: "What was the monthly revenue in INR thousands for March according to the Q1 chart?",
      retrievedEvidence: 'Source: "q1_performance_chart.png", Chart: "Q1 Revenue", Axes: X="Month", Y="INR thousands": Plotted Data: January=120, February=150, March=135',
      agentAnswer: "According to the Q1 revenue chart, March revenue was 135 INR thousands [Source: q1_performance_chart.png].",
      expectedKeywords: ["March", "135", "INR"],
      expectedSource: "q1_performance_chart.png",
      formatType: "chart",
    },
    {
      id: "tc-007",
      question: "What is the warranty policy on quantum processors?",
      retrievedEvidence: "NO_RELEVANT_EVIDENCE: No matching records found.",
      agentAnswer: "I don't have specific information about that in our knowledge base. Would you like me to connect you with a human support specialist?",
      expectedKeywords: ["don't have specific information", "human support"],
      formatType: "abstention",
    },
  ];

  const judgeReport = runOfflineJudgeBenchmark(judgeTestCases);
  console.log("⚖️  LLM-as-a-Judge Evaluation Dimensions (Rubric v" + judgeReport.rubricVersion + "):");
  console.log(`   - Average Faithfulness:      ${judgeReport.averageFaithfulness} / 5.0`);
  console.log(`   - Average Answer Relevance:  ${judgeReport.averageAnswerRelevance} / 5.0`);
  console.log(`   - Average Context Relevance: ${judgeReport.averageContextRelevance} / 5.0`);
  console.log(`   - Average Completeness:      ${judgeReport.averageCompleteness} / 5.0`);
  console.log(`   - Citation Pass Rate:        ${judgeReport.citationPassRate}%`);
  console.log(`   - Policy Compliance Rate:    ${judgeReport.policyComplianceRate}%`);
  console.log(`   - Flagged for Human Review:  ${judgeReport.needsReviewCount} of ${judgeReport.totalEvaluated}\n`);

  console.log("=================================================");
  console.log("✅ All Evaluation Benchmarks Completed Successfully.");
}

runEvaluation().catch(console.error);
