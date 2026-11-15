import assert from "node:assert/strict";
import { JobRunnerLogic } from "../../packages/backend/convex/system/jobs/jobRunner";

export async function runBackgroundJobsTests(): Promise<void> {
  console.log("Running Durable Background Job Queue Tests...");

  // Test 1: Exponential backoff with jitter progression
  const attempt1Delay = JobRunnerLogic.computeNextRetry(1, 2000, 60000);
  assert.ok(attempt1Delay >= 2000 && attempt1Delay <= 3000);

  const attempt2Delay = JobRunnerLogic.computeNextRetry(2, 2000, 60000);
  assert.ok(attempt2Delay >= 4000 && attempt2Delay <= 6000);

  const attempt3Delay = JobRunnerLogic.computeNextRetry(3, 2000, 60000);
  assert.ok(attempt3Delay >= 8000 && attempt3Delay <= 12000);

  // Maximum backoff ceiling
  const attempt10Delay = JobRunnerLogic.computeNextRetry(10, 2000, 60000);
  assert.ok(attempt10Delay <= 80000); // capped with jitter

  // Test 2: Error sanitization - Scrubbing credentials, tokens, and keys
  const sensitiveError = new Error(
    "Failed to authenticate with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9. Header sk-proj-1234567890abcdef1234567890 was rejected"
  );
  const sanitized = JobRunnerLogic.sanitizeError(sensitiveError);
  assert.ok(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
  assert.ok(!sanitized.includes("sk-proj-1234567890abcdef1234567890"));
  assert.ok(sanitized.includes("Bearer [REDACTED]"));
  assert.ok(sanitized.includes("sk-[REDACTED]"));

  // String error sanitization
  const paramError = "Database error: connection string password=superSecretPassword123 timeout";
  const sanitizedParam = JobRunnerLogic.sanitizeError(paramError);
  assert.ok(!sanitizedParam.includes("superSecretPassword123"));
  assert.ok(sanitizedParam.includes("password=[REDACTED]"));

  // Test 3: Tenant concurrency check
  assert.equal(JobRunnerLogic.isConcurrencyExceeded(4, 5), false);
  assert.equal(JobRunnerLogic.isConcurrencyExceeded(5, 5), true);
  assert.equal(JobRunnerLogic.isConcurrencyExceeded(6, 5), true);

  console.log("✅ All Durable Background Job Queue Tests Passed Successfully!");
}

runBackgroundJobsTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

