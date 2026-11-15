import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RagasAdapter, RagasTestCase } from "../adapters/ragas";
import { DeepEvalAdapter, DeepEvalTestCase } from "../adapters/deepEval";

export async function runRagasAndDeepEvalTests(): Promise<void> {
  console.log("Running RAGAS & DeepEval Adapter Tests...");

  // Test 1: Load and validate v2_golden_customer_support.json dataset
  const datasetPath = path.resolve(process.cwd(), "eval/dataset/v2_golden_customer_support.json");
  const datasetRaw = fs.readFileSync(datasetPath, "utf-8");
  const dataset = JSON.parse(datasetRaw);

  assert.equal(dataset.version, "2026.2");
  assert.ok(Array.isArray(dataset.cases));
  assert.ok(dataset.cases.length >= 10);

  // Test 2: RAGAS Context Precision
  const retrievedDocs = [
    "Policy TEST-POL-610200 has a deductible of $1,250.",
    "General customer support phone number is 1-800-555-0199.",
    "Holiday office closures schedule for 2026.",
  ];
  const referenceDocs = ["Policy TEST-POL-610200 has a deductible of $1,250."];

  const precision = RagasAdapter.calculateContextPrecision(retrievedDocs, referenceDocs);
  assert.ok(precision >= 0.9, `Precision was ${precision}`);

  // Test 3: RAGAS Context Recall
  const recall = RagasAdapter.calculateContextRecall(retrievedDocs, referenceDocs);
  assert.equal(recall, 1.0);

  // Test 4: RAGAS Faithfulness
  const faithfulAnswer = "The deductible for policy TEST-POL-610200 is $1,250.";
  const faithScore = RagasAdapter.calculateFaithfulness(faithfulAnswer, retrievedDocs);
  assert.ok(faithScore >= 0.9);

  const hallucinatedAnswer = "The deductible is $9,999 and includes free oil changes forever.";
  const unfaithfulScore = RagasAdapter.calculateFaithfulness(hallucinatedAnswer, retrievedDocs);
  assert.ok(unfaithfulScore < 0.6);

  // Test 5: RAGAS Answer Semantic Similarity
  const genA = "The deductible for policy TEST-POL-610200 is $1,250.";
  const refA = "Policy TEST-POL-610200 features a $1,250 deductible.";
  const similarity = RagasAdapter.calculateSemanticSimilarity(genA, refA);
  assert.ok(similarity > 0.5);

  // Test 6: RAGAS Evaluation Suite Runner
  const suiteCases: RagasTestCase[] = [
    {
      id: "tc-1",
      question: "What is the deductible for TEST-POL-610200?",
      generatedAnswer: "The deductible for policy TEST-POL-610200 is $1,250.",
      referenceAnswer: "The deductible for policy TEST-POL-610200 is $1,250.",
      retrievedContexts: retrievedDocs,
      referenceContexts: referenceDocs,
    },
  ];

  const report = RagasAdapter.evaluateSuite(suiteCases, 0.70);
  assert.equal(report.totalCases, 1);
  assert.ok(report.overallRagasScore >= 0.70);
  assert.equal(report.pass, true);

  // Test 7: DeepEval GEval Criteria Evaluation
  const deTestCase: DeepEvalTestCase = {
    id: "de-1",
    input: "What is the deductible for TEST-POL-610200?",
    actualOutput: "The deductible for policy TEST-POL-610200 is $1,250.",
    context: ["Policy TEST-POL-610200: Commercial property coverage with deductible $1,250."],
  };

  const gEvalScore = DeepEvalAdapter.evaluateGEval(deTestCase);
  assert.ok(gEvalScore >= 0.85);

  // Test 8: DeepEval HallucinationMetric
  const noHallucination = DeepEvalAdapter.evaluateHallucination(
    "The deductible is $1,250 for TEST-POL-610200",
    ["TEST-POL-610200 deductible is $1,250"]
  );
  assert.equal(noHallucination, 0.0);

  const withHallucination = DeepEvalAdapter.evaluateHallucination(
    "Your bonus credit code is BONUS9988 and refund is $8500",
    ["Standard terms apply without promotional codes"]
  );
  assert.ok(withHallucination > 0.5);

  // Test 9: DeepEval Synthetic Test Case Generation
  const syntheticKnowledge = `
    Aivon provides real-time AI customer support with automated escalation.
    Organizations can upload PDFs, CSVs, and markdown files to the knowledge base.
    Sessions expire automatically after 24 hours of inactivity.
  `;
  const syntheticCases = DeepEvalAdapter.generateSyntheticTestCases("doc_faq_1", syntheticKnowledge);
  assert.ok(syntheticCases.length >= 2);
  assert.ok(syntheticCases[0]!.id.startsWith("synth_doc_faq_1"));

  console.log("✅ All RAGAS & DeepEval Adapter Tests Passed Successfully!");
}

runRagasAndDeepEvalTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

