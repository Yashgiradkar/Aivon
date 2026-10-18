import assert from "node:assert/strict";
import {
  parseDelimitedTextToTable,
  parseJsonToStructuredBlocks,
  parseMarkdownToContentBlocks,
  normalizeDocumentContent,
} from "../../packages/backend/convex/system/ai/rag/structure/documentParser";
import {
  formatTableBlockToSearchable,
  formatChartBlockToSearchable,
  serializeNormalizedDocument,
} from "../../packages/backend/convex/system/ai/rag/structure/contentBlocks";
import { detectQueryIntent } from "../../packages/backend/convex/system/ai/tools/search";
import {
  evaluateOfflineInteraction,
  runOfflineJudgeBenchmark,
} from "../judge/offlineJudge";

export async function runMultiFormatAndJudgeTests(): Promise<void> {
  console.log("Running Multi-Format RAG & LLM-as-a-Judge Unit Tests...");

  // Test 1: CSV Table parsing with headers, units, and row relationships
  const sampleCsv = `Plan Tier,Price ($),Refund Period (days),Max Projects
Basic,9.99,14,3
Professional,29.99,30,unlimited
Enterprise,99.99,60,unlimited`;

  const tableBlock = parseDelimitedTextToTable(sampleCsv, "plans.csv", ",");
  assert.equal(tableBlock.type, "table");
  assert.equal(tableBlock.headers.length, 4);
  assert.equal(tableBlock.rows.length, 3);
  assert.equal(tableBlock.units?.["Price ($)"], "$");
  assert.equal(tableBlock.units?.["Refund Period (days)"], "days");

  // Verify row-level cell bindings
  const searchableTable = formatTableBlockToSearchable(tableBlock);
  assert.ok(searchableTable.includes('Row 3: Plan Tier="Enterprise"'));
  assert.ok(searchableTable.includes('Refund Period (days)="60 days"'));

  // Test 2: JSON Structured data parsing
  const sampleJson = JSON.stringify([
    { id: "usr_1", name: "Alice", tier: "Enterprise" },
    { id: "usr_2", name: "Bob", tier: "Pro" },
  ]);
  const jsonBlocks = parseJsonToStructuredBlocks(sampleJson, "users.json");
  assert.equal(jsonBlocks[0]?.type, "table");

  // Test 3: Markdown parser with headings and markdown tables
  const sampleMarkdown = `# Support Policy
Welcome to our platform.

## Billing and Refunds
Here is the table of refund terms:

| Tier | Refund Period | Support SLA |
| --- | --- | --- |
| Starter | 7 days | 48 hours |
| Enterprise | 60 days | 1 hour |

[CHART: Title="Revenue Trend" Type="bar" X-Axis="Month" Y-Axis="USD" Units="$" Summary="Revenue peaked in Q2"]
`;

  const mdBlocks = parseMarkdownToContentBlocks(sampleMarkdown);
  const headings = mdBlocks.map((b) => b.headingPath);
  assert.ok(headings.some((h) => h?.includes("Billing and Refunds")));

  const tableInMd = mdBlocks.find((b) => b.type === "table");
  assert.ok(tableInMd !== undefined);
  if (tableInMd?.type === "table") {
    assert.equal(tableInMd.headers[0], "Tier");
    assert.equal(tableInMd.rows[1]?.[0], "Enterprise");
  }

  const chartInMd = mdBlocks.find((b) => b.type === "chart");
  assert.ok(chartInMd !== undefined);
  if (chartInMd?.type === "chart") {
    assert.equal(chartInMd.title, "Revenue Trend");
    assert.equal(chartInMd.units, "$");
  }

  // Test 4: Document normalization and serialization
  const normalizedDoc = normalizeDocumentContent(sampleMarkdown, "guide.md", "text/markdown");
  assert.equal(normalizedDoc.metadata.hasTables, true);
  assert.equal(normalizedDoc.metadata.hasCharts, true);

  const serialized = serializeNormalizedDocument(normalizedDoc);
  assert.ok(serialized.includes("Support Policy"));
  assert.ok(serialized.includes("Billing and Refunds"));
  assert.ok(serialized.includes("Enterprise"));

  // Test 5: Query Intent Detection
  assert.equal(detectQueryIntent("What is the price of enterprise tier?"), "table_lookup");
  assert.equal(detectQueryIntent("What was the revenue trend in march?"), "chart_metrics");
  assert.equal(detectQueryIntent("How do I contact customer support?"), "prose");

  // Test 6: LLM-as-a-Judge offline evaluation scoring
  // Valid case with good evidence and accurate citation
  const validEval = evaluateOfflineInteraction({
    id: "t1",
    question: "What is the refund period for Enterprise tier?",
    retrievedEvidence: 'Source: "plans.csv", Row 3: Plan Tier="Enterprise", Refund Period="60 days"',
    agentAnswer: "Enterprise tier has a refund period of 60 days [Source: plans.csv].",
    expectedKeywords: ["Enterprise", "60 days"],
    expectedSource: "plans.csv",
    formatType: "table",
  });
  assert.equal(validEval.faithfulness.score, 5);
  assert.equal(validEval.answerRelevance.score, 5);
  assert.equal(validEval.citationValidity.pass, true);
  assert.equal(validEval.policyCompliance.pass, true);
  assert.equal(validEval.needsHumanReview, false);

  // Invalid citation case
  const invalidCitationEval = evaluateOfflineInteraction({
    id: "t2",
    question: "What is the refund period?",
    retrievedEvidence: 'Source: "plans.csv", Refund Period: 60 days',
    agentAnswer: "The refund period is 60 days [Source: nonexistent_doc.pdf].",
    expectedKeywords: ["60 days"],
    formatType: "table",
  });
  assert.equal(invalidCitationEval.citationValidity.pass, false);
  assert.equal(invalidCitationEval.needsHumanReview, true);

  // Missing evidence abstention case
  const abstentionEval = evaluateOfflineInteraction({
    id: "t3",
    question: "Can I run this on Mars?",
    retrievedEvidence: "NO_RELEVANT_EVIDENCE: No matching records.",
    agentAnswer: "I don't have specific information about that in our knowledge base. Would you like me to connect you with human support?",
    formatType: "abstention",
  });
  assert.equal(abstentionEval.policyCompliance.pass, true);
  assert.equal(abstentionEval.needsHumanReview, false);

  // Benchmark aggregation
  const benchmarkReport = runOfflineJudgeBenchmark([
    {
      id: "b1",
      question: "Q1",
      retrievedEvidence: "plans.csv contains answer details.",
      agentAnswer: "Here is the verified answer [Source: plans.csv].",
      expectedKeywords: ["answer"],
    },
    {
      id: "b2",
      question: "Q2",
      retrievedEvidence: "guide.md contains answer details.",
      agentAnswer: "Here is the verified answer [Source: guide.md].",
      expectedKeywords: ["answer"],
    },
  ]);
  assert.equal(benchmarkReport.totalEvaluated, 2);
  assert.ok(benchmarkReport.averageFaithfulness >= 4.0);
  assert.equal(benchmarkReport.citationPassRate, 100);


  console.log("✅ All Multi-Format RAG & LLM-as-a-Judge Unit Tests Passed Successfully!");
}

runMultiFormatAndJudgeTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
