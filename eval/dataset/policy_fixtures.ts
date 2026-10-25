/**
 * Synthetic Policy Identifier Benchmark Fixtures
 *
 * Deterministic, version-controlled test fixtures for exact policy-number
 * retrieval regression tests. All identifiers and content are synthetic.
 * No production policy numbers or customer data are used.
 *
 * Naming convention:
 *   TEST-POL-<6-digit-number>  — synthetic policy identifier
 *   TEST-ORG-A / TEST-ORG-B   — synthetic tenant identifiers
 */

export interface PolicyDocument {
  /** Stable document key (filename equivalent) */
  key: string;
  /** Synthetic organization namespace */
  orgId: string;
  /** Full document text as it would appear after extraction */
  text: string;
  /** Policy identifiers that appear in this document */
  policyIds: string[];
}

export interface PolicyTestCase {
  id: string;
  description: string;
  orgId: string;
  query: string;
  /** Expected routing strategy */
  expectedRoute: "bm25" | "hybrid" | "dense";
  /** Expected document key(s) in top-K results (empty = expect NO_RESULT) */
  expectedDocs: string[];
  /** Identifiers that must NOT appear in results (similar-ID rejection) */
  rejectedDocs: string[];
  /** If true, expect a refusal / no-evidence response */
  expectNoEvidence: boolean;
}

// ---------------------------------------------------------------------------
// Synthetic policy documents
// ---------------------------------------------------------------------------

export const POLICY_DOCUMENTS: PolicyDocument[] = [
  {
    key: "policy_TEST-POL-482731.md",
    orgId: "TEST-ORG-A",
    text: `# Policy TEST-POL-482731 — Home Contents Insurance

## Coverage Summary
Policy number: TEST-POL-482731
Policyholder: Synthetic Test Customer A
Effective date: 2026-01-01
Expiry date: 2026-12-31

## Coverage Limits
- Personal belongings: $25,000
- Accidental damage: $5,000
- Emergency accommodation: $2,000 per event

## Exclusions
Items excluded from coverage under TEST-POL-482731:
- Jewellery above $1,500 per item (schedule separately)
- Motor vehicles
- Pre-existing structural damage`,
    policyIds: ["TEST-POL-482731"],
  },
  {
    key: "policy_TEST-POL-482732.md",
    orgId: "TEST-ORG-A",
    text: `# Policy TEST-POL-482732 — Motor Vehicle Insurance

## Coverage Summary
Policy number: TEST-POL-482732
Policyholder: Synthetic Test Customer B
Effective date: 2026-02-01
Expiry date: 2027-01-31

## Coverage Limits
- Third-party liability: $1,000,000
- Own damage: $30,000
- Roadside assistance: Included

## Exclusions
Items excluded from coverage under TEST-POL-482732:
- Racing and off-road use
- Unlicensed drivers`,
    policyIds: ["TEST-POL-482732"],
  },
  {
    key: "policy_TEST-POL-582731.md",
    orgId: "TEST-ORG-A",
    text: `# Policy TEST-POL-582731 — Life Insurance

## Coverage Summary
Policy number: TEST-POL-582731
Policyholder: Synthetic Test Customer C
Sum insured: $500,000

## Exclusions
- Pre-existing conditions within 2 years
- Self-inflicted injury`,
    policyIds: ["TEST-POL-582731"],
  },
  {
    key: "policy_TEST-POL-482731_orgB.md",
    orgId: "TEST-ORG-B",
    // Same policy ID, different org — must NEVER appear in TEST-ORG-A results
    text: `# Policy TEST-POL-482731 — Business Interruption Insurance
Policy number: TEST-POL-482731
Organization: TEST-ORG-B (different tenant)
Coverage: $100,000 business interruption per month`,
    policyIds: ["TEST-POL-482731"],
  },
  {
    key: "general_faq.md",
    orgId: "TEST-ORG-A",
    text: `# General FAQ

## How do I file a claim?
Contact our claims team at claims@example.com or call 1-800-CLAIMS.

## What is my policy number?
Your policy number appears on your insurance certificate and renewal notice.

## How long does a claim take?
Most claims are processed within 10 business days.`,
    policyIds: [],
  },
];

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

export const POLICY_TEST_CASES: PolicyTestCase[] = [
  {
    id: "POL-TC-001",
    description: "Exact 3-segment policy ID lookup returns the correct document",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-482731",
    expectedRoute: "bm25",
    expectedDocs: ["policy_TEST-POL-482731.md"],
    rejectedDocs: [
      "policy_TEST-POL-482732.md",  // differs by last digit
      "policy_TEST-POL-582731.md",  // differs by first digit group
      "policy_TEST-POL-482731_orgB.md", // same ID, wrong tenant
    ],
    expectNoEvidence: false,
  },
  {
    id: "POL-TC-002",
    description: "Similar identifier TEST-POL-482732 must NOT match TEST-POL-482731",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-482732",
    expectedRoute: "bm25",
    expectedDocs: ["policy_TEST-POL-482732.md"],
    rejectedDocs: [
      "policy_TEST-POL-482731.md",  // one digit different
      "policy_TEST-POL-582731.md",
    ],
    expectNoEvidence: false,
  },
  {
    id: "POL-TC-003",
    description: "Similar identifier TEST-POL-582731 must NOT match TEST-POL-482731",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-582731",
    expectedRoute: "bm25",
    expectedDocs: ["policy_TEST-POL-582731.md"],
    rejectedDocs: [
      "policy_TEST-POL-482731.md",  // one digit different
      "policy_TEST-POL-482732.md",
    ],
    expectNoEvidence: false,
  },
  {
    id: "POL-TC-004",
    description: "Hybrid: policy ID + natural-language question",
    orgId: "TEST-ORG-A",
    query: "What are the coverage limits for policy TEST-POL-482731?",
    expectedRoute: "hybrid",
    expectedDocs: ["policy_TEST-POL-482731.md"],
    rejectedDocs: [
      "policy_TEST-POL-482732.md",
      "policy_TEST-POL-482731_orgB.md",
    ],
    expectNoEvidence: false,
  },
  {
    id: "POL-TC-005",
    description: "Cross-tenant isolation: TEST-ORG-A query must not surface TEST-ORG-B document",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-482731",
    expectedRoute: "bm25",
    expectedDocs: ["policy_TEST-POL-482731.md"],
    rejectedDocs: ["policy_TEST-POL-482731_orgB.md"],
    expectNoEvidence: false,
  },
  {
    id: "POL-TC-006",
    description: "Non-existent policy number returns no evidence",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-999999",
    expectedRoute: "bm25",
    expectedDocs: [],
    rejectedDocs: [
      "policy_TEST-POL-482731.md",
      "policy_TEST-POL-482732.md",
      "policy_TEST-POL-582731.md",
    ],
    expectNoEvidence: true,
  },
  {
    id: "POL-TC-007",
    description: "Semantic query (no policy ID) routes to dense retrieval",
    orgId: "TEST-ORG-A",
    query: "How do I file a claim for my insurance policy?",
    expectedRoute: "dense",
    expectedDocs: ["general_faq.md"],
    rejectedDocs: [],
    expectNoEvidence: false,
  },
  {
    id: "POL-TC-008",
    description: "Ambiguous numeric suffix — TEST-POL-482731 not confused with TEST-POL-48273 (shorter)",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-48273",
    expectedRoute: "bm25",
    expectedDocs: [],   // No document has exactly TEST-POL-48273
    rejectedDocs: ["policy_TEST-POL-482731.md"], // Must NOT fuzzy-match
    expectNoEvidence: true,
  },
];
