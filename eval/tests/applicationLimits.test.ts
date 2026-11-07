import assert from "node:assert/strict";
import {
  MAX_PROMPT_LENGTH,
  MAX_OPERATOR_PROMPT_LENGTH,
  MAX_SPOKEN_TURN_LENGTH,
  MAX_PHONE_NUMBER_LENGTH,
  MAX_PASSENGERS,
  MAX_GREET_MESSAGE_LENGTH,
  MAX_SUGGESTION_LENGTH,
  MAX_TRANSCRIPT_MESSAGES,
  MAX_CALLBACK_SCHEDULE_MS,
  MAX_HUMAN_REVIEW_NOTES_LENGTH,
  MAX_AI_SUMMARY_LENGTH,
  PUBLIC_ENDPOINT_MAX_REQUESTS,
  PUBLIC_ENDPOINT_WINDOW_MS,
  SESSION_MESSAGE_MAX_REQUESTS,
  SESSION_MESSAGE_WINDOW_MS,
  TRAVEL_TURN_MAX_REQUESTS,
  TRAVEL_TURN_WINDOW_MS,
  isValidEmail,
  isSafeOrganizationId,
  isE164PhoneNumber,
  resolveSubscriptionTier,
  assertBoundedText,
  countEventsInWindow,
  assertHttpsUrl,
} from "../../packages/backend/convex/lib/requestSecurity";
import {
  ALLOWED_TYPES,
  validateKnowledgeBaseUpload,
} from "../../packages/backend/convex/lib/uploadSecurity";

export async function runApplicationLimitsValidationTests(): Promise<void> {
  console.log("Running Comprehensive Application Limits Validation Tests...");

  // 1. Text Bound Length Limits
  assert.equal(MAX_PROMPT_LENGTH, 4000);
  assert.equal(MAX_OPERATOR_PROMPT_LENGTH, 8000);
  assert.equal(MAX_SPOKEN_TURN_LENGTH, 2000);
  assert.equal(MAX_PHONE_NUMBER_LENGTH, 20);
  assert.equal(MAX_PASSENGERS, 6);
  assert.equal(MAX_GREET_MESSAGE_LENGTH, 500);
  assert.equal(MAX_SUGGESTION_LENGTH, 160);
  assert.equal(MAX_TRANSCRIPT_MESSAGES, 200);
  assert.equal(MAX_AI_SUMMARY_LENGTH, 2000);
  assert.equal(MAX_HUMAN_REVIEW_NOTES_LENGTH, 2000);

  // Boundary checks on assertBoundedText
  const validText = "Hello support";
  assert.equal(assertBoundedText(validText, 20, "Prompt"), "Hello support");

  assert.throws(
    () => assertBoundedText("a".repeat(21), 20, "Prompt"),
    (err: any) => err.data?.code === "BAD_REQUEST"
  );
  assert.throws(
    () => assertBoundedText("   ", 20, "Prompt"),
    (err: any) => err.data?.code === "BAD_REQUEST"
  );

  // 2. Window Request Counting & Limits
  const now = Date.now();
  const timestamps = [
    now - 1000,
    now - 5000,
    now - 10000,
    now - 70000, // Outside 60s window
  ];
  const activeEvents = countEventsInWindow(timestamps, now, 60_000);
  assert.equal(activeEvents, 3);

  assert.equal(PUBLIC_ENDPOINT_MAX_REQUESTS, 30);
  assert.equal(PUBLIC_ENDPOINT_WINDOW_MS, 60_000);
  assert.equal(SESSION_MESSAGE_MAX_REQUESTS, 30);
  assert.equal(SESSION_MESSAGE_WINDOW_MS, 60_000);
  assert.equal(TRAVEL_TURN_MAX_REQUESTS, 20);
  assert.equal(TRAVEL_TURN_WINDOW_MS, 60_000);

  // 3. Organization ID & Identity Restrictions
  assert.equal(isSafeOrganizationId("org_valid_123"), true);
  assert.equal(isSafeOrganizationId("org-valid-enterprise"), true);
  assert.equal(isSafeOrganizationId("org/traversal/attempt"), false);
  assert.equal(isSafeOrganizationId("org$bad*char"), false);
  assert.equal(isSafeOrganizationId(""), false);
  assert.equal(isSafeOrganizationId("a".repeat(129)), false);

  // 4. E.164 Phone Number & Email Validation
  assert.equal(isE164PhoneNumber("+14155552671"), true);
  assert.equal(isE164PhoneNumber("+919876543210"), true);
  assert.equal(isE164PhoneNumber("4155552671"), false); // missing +
  assert.equal(isE164PhoneNumber("+1"), false); // too short
  assert.equal(isE164PhoneNumber("+123456789012345678901"), false); // > 20 chars

  assert.equal(isValidEmail("customer@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("a".repeat(255) + "@test.com"), false);

  // 5. Subscription Tier Resolution
  assert.equal(resolveSubscriptionTier("org_normal", "active"), "pro");
  assert.equal(resolveSubscriptionTier("org_normal", "canceled"), "free");
  assert.equal(resolveSubscriptionTier("org_normal", undefined), "free");

  // 6. HTTPS URL Assertion
  const secureUrl = assertHttpsUrl("https://aivon.ai/webhook", "Webhook");
  assert.equal(secureUrl.hostname, "aivon.ai");
  assert.throws(
    () => assertHttpsUrl("http://insecure.com", "Webhook"),
    (err: any) => err.data?.code === "BAD_REQUEST"
  );
  assert.throws(
    () => assertHttpsUrl("javascript:alert(1)", "Webhook"),
    (err: any) => err.data?.code === "BAD_REQUEST"
  );

  // 7. File Upload Boundary Restrictions
  assert.ok(ALLOWED_TYPES[".pdf"]);
  assert.ok(ALLOWED_TYPES[".txt"]);
  assert.ok(ALLOWED_TYPES[".csv"]);
  assert.ok(ALLOWED_TYPES[".json"]);
  assert.ok(ALLOWED_TYPES[".md"]);
  assert.ok(ALLOWED_TYPES[".png"]);
  assert.ok(ALLOWED_TYPES[".jpg"]);
  assert.ok(ALLOWED_TYPES[".webp"]);

  // Max Text File Size is 2 MB: verify rejection beyond boundary
  const oversizedText = new Uint8Array(2 * 1024 * 1024 + 10);
  oversizedText.fill(65); // ASCII 'A'
  assert.throws(
    () => validateKnowledgeBaseUpload("big_doc.txt", oversizedText.buffer),
    (err: any) => err.data?.message.includes("2 MB")
  );

  // Max Binary File Size is 10 MB: verify rejection beyond boundary
  const oversizedBinary = new Uint8Array(10 * 1024 * 1024 + 50);
  assert.throws(
    () => validateKnowledgeBaseUpload("large.png", oversizedBinary.buffer),
    (err: any) => err.data?.message.includes("10 MB")
  );

  // Empty buffer rejection
  assert.throws(
    () => validateKnowledgeBaseUpload("empty.txt", new ArrayBuffer(0)),
    (err: any) => err.data?.message.includes("between 1 byte and 10 MB")
  );

  // 8. Callback Scheduling Maximum (7 Days)
  assert.equal(MAX_CALLBACK_SCHEDULE_MS, 7 * 24 * 60 * 60 * 1000);

  console.log("✅ All Application Limits Validation Tests Passed Successfully!");
}

runApplicationLimitsValidationTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
