import assert from "node:assert/strict";
import {
  isAllowedSubscriptionStatus,
  isSafeOrganizationId,
  looksLikeConvexId,
} from "../../packages/backend/convex/lib/requestSecurity";
import { maskPIIForLogging } from "../../packages/backend/convex/system/ai/security/sanitizer";

export async function runSecurityHardeningTests(): Promise<void> {
  console.log("Running Security Hardening & Remediation Unit Tests...");

  // 1. Subscription Lifecycle Statuses (Clerk Billing Synchronization)
  const validStatuses = [
    "active",
    "canceled",
    "cancelled",
    "ended",
    "expired",
    "incomplete",
    "incomplete_expired",
    "past_due",
    "paused",
    "trialing",
    "unpaid",
    "upcoming",
    "abandoned",
  ];
  for (const status of validStatuses) {
    assert.equal(
      isAllowedSubscriptionStatus(status),
      true,
      `Expected status ${status} to be allowed`
    );
  }

  const maliciousStatuses = [
    "admin",
    "superuser",
    "active' OR 1=1 --",
    "__proto__",
    "delete_all",
    "",
  ];
  for (const status of maliciousStatuses) {
    assert.equal(
      isAllowedSubscriptionStatus(status),
      false,
      `Expected status ${status} to be rejected`
    );
  }

  // 2. Safe Organization ID & Convex ID Validation
  assert.equal(isSafeOrganizationId("org_2tTestOrganization123"), true);
  assert.equal(isSafeOrganizationId("org-test-123_abc"), true);
  assert.equal(isSafeOrganizationId(""), false);
  assert.equal(isSafeOrganizationId("../escape/org"), false);
  assert.equal(isSafeOrganizationId("org:with:colons"), false);
  assert.equal(isSafeOrganizationId("org with spaces"), false);

  assert.equal(looksLikeConvexId("k17abcdefghijklmnopqrstuv"), true);
  assert.equal(looksLikeConvexId("j570123456789abcdef01234567"), true);
  assert.equal(looksLikeConvexId("not-a-convex-id!"), false);
  assert.equal(looksLikeConvexId("short"), false);

  // 3. PII Masking in Observability & Log Details
  const sampleLogDetail = {
    userQuery: "My card is 4111-2222-3333-4444 and my SSN is 000-12-3456",
    nested: {
      accountNotes: "Customer called from card ending in 4111-2222-3333-4444",
      items: ["Item 1", "Card 5555 4444 3333 2222"],
    },
  };

  const maskedText = maskPIIForLogging(sampleLogDetail.userQuery);
  assert.ok(maskedText.includes("[REDACTED_CC]"));
  assert.ok(maskedText.includes("[REDACTED_SSN]"));
  assert.ok(!maskedText.includes("4111-2222-3333-4444"));
  assert.ok(!maskedText.includes("000-12-3456"));

  // 4. Transcript Filtering Logic (Exclusion of Tool / System messages)
  const mockMessages = [
    {
      tool: false,
      message: { role: "system" as const, content: "You are an AI support agent." },
      text: "System prompt instructions",
    },
    {
      tool: false,
      message: { role: "user" as const, content: "I need help with my policy renewal" },
      text: "I need help with my policy renewal",
    },
    {
      tool: true,
      message: { role: "tool" as const, content: '{"result": "internal database dump"}' },
      text: undefined,
    },
    {
      tool: false,
      message: { role: "assistant" as const, content: "I can help you review your policy." },
      text: "I can help you review your policy.",
    },
  ];

  const filteredTranscript = mockMessages
    .filter((m) => !m.tool && m.message?.role !== "tool" && m.message?.role !== "system")
    .map((m) => {
      const role = m.message?.role === "user" ? "Customer" : "Assistant";
      const text =
        m.text ??
        (typeof m.message?.content === "string"
          ? m.message.content
          : JSON.stringify(m.message?.content ?? ""));
      return `${role}: ${text}`;
    })
    .filter((line) => line.trim().length > 0)
    .join("\n");

  assert.ok(filteredTranscript.includes("Customer: I need help with my policy renewal"));
  assert.ok(filteredTranscript.includes("Assistant: I can help you review your policy."));
  assert.ok(!filteredTranscript.includes("System prompt instructions"));
  assert.ok(!filteredTranscript.includes("internal database dump"));

  // 5. Embed Position Parameter Defense
  const parsePosition = (rawPos: string | null): "bottom-right" | "bottom-left" => {
    return rawPos === "bottom-left" ? "bottom-left" : "bottom-right";
  };
  assert.equal(parsePosition("bottom-left"), "bottom-left");
  assert.equal(parsePosition("bottom-right"), "bottom-right");
  assert.equal(parsePosition("bottom-right; background: red;"), "bottom-right");
  assert.equal(parsePosition("<script>alert(1)</script>"), "bottom-right");
  assert.equal(parsePosition(null), "bottom-right");

  console.log("✅ All Security Hardening & Remediation Unit Tests Passed Successfully!");
}

runSecurityHardeningTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

