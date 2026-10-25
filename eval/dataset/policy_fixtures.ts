/**
 * Synthetic Policy Identifier Benchmark Fixtures & Comprehensive Manifest
 *
 * Deterministic, version-controlled test fixtures for exact policy-number
 * retrieval, multimodal evidence extraction (tables, charts, narrative),
 * cross-tenant isolation, version superseding, and negative-answer evaluation.
 *
 * ALL IDENTIFIERS, NAMES, FIGURES, AND POLICIES ARE ENTIRELY SYNTHETIC.
 * No production policy records, customer data, or real credentials are used.
 *
 * Conventions:
 *   TEST-POL-<6-digit-number>  — synthetic policy identifier
 *   TEST-ORG-A / TEST-ORG-B   — synthetic tenant identifiers
 */

export interface PolicyDocument {
  /** Stable document key (filename equivalent) */
  key: string;
  /** Synthetic organization namespace */
  orgId: string;
  /** MIME type representation */
  mimeType: "text/markdown" | "application/pdf" | "image/png";
  /** Document version */
  version: number;
  /** Whether this version has been superseded by a newer version */
  isSuperseded?: boolean;
  /** Full document text as it would appear after multi-format extraction */
  text: string;
  /** Policy identifiers that appear in this document */
  policyIds: string[];
  /** Document modality content breakdown */
  contentTypes: ("prose" | "table" | "chart")[];
}

export interface DocumentManifestItem {
  syntheticDocId: string;
  filename: string;
  mimeType: string;
  documentVersion: number;
  isSuperseded: boolean;
  expectedPolicyNumbers: string[];
  relevantSections: string[];
  expectedFactualAnswers: Record<string, string>;
  expectedSourceReferences: string[];
  testCaseIds: string[];
}

export interface PolicyTestCase {
  id: string;
  category:
    | "exact_direct"
    | "exact_table"
    | "exact_chart"
    | "exact_narrative"
    | "similar_incorrect"
    | "non_existent"
    | "overlapping_prefix"
    | "superseded_version"
    | "cross_tenant"
    | "cross_document_multi_hop";
  description: string;
  orgId: string;
  query: string;
  /** Expected routing strategy */
  expectedRoute: "bm25" | "hybrid" | "dense";
  /** Expected document key(s) in top-K results (empty = expect NO_RESULT) */
  expectedDocs: string[];
  /** Identifiers that must NOT appear in results (similar-ID rejection) */
  rejectedDocs: string[];
  /** Expected fact in answer */
  expectedFact?: string;
  /** If true, expect a refusal / no-evidence response */
  expectNoEvidence: boolean;
}

// ---------------------------------------------------------------------------
// Synthetic Policy Documents (Multi-modal & Multi-format)
// ---------------------------------------------------------------------------

export const POLICY_DOCUMENTS: PolicyDocument[] = [
  // 1. Narrative & Direct Policy
  {
    key: "policy_TEST-POL-482731.md",
    orgId: "TEST-ORG-A",
    mimeType: "text/markdown",
    version: 2,
    isSuperseded: false,
    text: `# Policy TEST-POL-482731 — Home Contents Insurance (Current Version 2)

## Coverage Summary
Policy number: TEST-POL-482731
Policyholder: Synthetic Test Customer A
Effective date: 2026-01-01
Expiry date: 2026-12-31
Status: ACTIVE

## Narrative Conditions
Under policy TEST-POL-482731, personal property inside the insured dwelling is covered against water damage from sudden pipe burst. Flood coverage requires an additional rider.

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
    contentTypes: ["prose"],
  },

  // 2. Superseded Version of TEST-POL-482731
  {
    key: "policy_TEST-POL-482731_v1_superseded.md",
    orgId: "TEST-ORG-A",
    mimeType: "text/markdown",
    version: 1,
    isSuperseded: true,
    text: `# Policy TEST-POL-482731 — Home Contents Insurance (Superseded Version 1)
[SUPERSEDED - DO NOT USE FOR ACTIVE CLAIMS]
Policy number: TEST-POL-482731
Effective date: 2025-01-01
Expiry date: 2025-12-31
Coverage limit: $20,000 (Superseded by $25,000 in Version 2)`,
    policyIds: ["TEST-POL-482731"],
    contentTypes: ["prose"],
  },

  // 3. Table-Heavy Commercial Policy
  {
    key: "policy_commercial_table_TEST-POL-610200.md",
    orgId: "TEST-ORG-A",
    mimeType: "application/pdf",
    version: 1,
    isSuperseded: false,
    text: `# Commercial Property Policy Schedule: TEST-POL-610200

Policy Identifier: TEST-POL-610200
Entity: Synthetic Commercial Holdings LLC
Term: 2026-03-01 to 2027-02-28

## Coverage Schedule & Limits Table
| Coverage Classification | Policy Limit | Deductible | Retroactive Date | Status |
| :--- | :--- | :--- | :--- | :--- |
| Building Physical Loss | $2,500,000 | $10,000 | 2024-01-01 | Active |
| Commercial General Liability | $1,000,000 | $5,000 | 2024-01-01 | Active |
| Cyber Incident Response | $500,000 | $25,000 | 2025-06-01 | Active |
| Business Income Disruption | $750,000 | 72 Hours Waiting Period | 2024-01-01 | Active |

## Deductible Notes
The Cyber Incident Response deductible of $25,000 applies strictly per occurrence under TEST-POL-610200.`,
    policyIds: ["TEST-POL-610200"],
    contentTypes: ["table", "prose"],
  },

  // 4. Chart-Based Visual Policy Document
  {
    key: "policy_loss_ratio_chart_TEST-POL-730100.md",
    orgId: "TEST-ORG-A",
    mimeType: "image/png",
    version: 1,
    isSuperseded: false,
    text: `# Fleet Underwriting Risk & Loss Analysis: TEST-POL-730100

Policy Reference: TEST-POL-730100
Fleet Operator: Metro Logistics Group
Underwriting Cycle: Q1-2026

## Historical Loss Ratio Chart
[CHART: Title="Fleet Annual Loss Ratio 2023-2025" Type="bar" X-Axis="Year" Y-Axis="Loss Ratio Percentage" Units="%" Summary="Loss ratio was 64% in 2023, decreased to 52% in 2024, and reached 41% in 2025 following telematics installation" Data=[{"Year":"2023","Ratio":"64%"},{"Year":"2024","Ratio":"52%"},{"Year":"2025","Ratio":"41%"}]]

## Risk Adjustment Findings
Under policy TEST-POL-730100, the 2025 loss ratio of 41% qualifies the fleet for a 15% preferred renewal credit.`,
    policyIds: ["TEST-POL-730100"],
    contentTypes: ["chart", "prose"],
  },

  // 5. Similar Adjacent Policy Differing by 1 Digit
  {
    key: "policy_TEST-POL-482732.md",
    orgId: "TEST-ORG-A",
    mimeType: "text/markdown",
    version: 1,
    isSuperseded: false,
    text: `# Policy TEST-POL-482732 — Motor Vehicle Comprehensive Insurance

Policy number: TEST-POL-482732
Policyholder: Synthetic Test Customer B
Vehicle: 2024 Hybrid Sedan

## Coverage Limits
- Third-party liability: $1,000,000
- Own vehicle collision damage: $30,000
- Glass breakage deductible: $100

## Exclusions
- Unlicensed operators
- Commercial rideshare without rider`,
    policyIds: ["TEST-POL-482732"],
    contentTypes: ["prose"],
  },

  // 6. Similar Identifier Differing in First Segment
  {
    key: "policy_TEST-POL-582731.md",
    orgId: "TEST-ORG-A",
    mimeType: "text/markdown",
    version: 1,
    isSuperseded: false,
    text: `# Policy TEST-POL-582731 — Term Life Insurance

Policy number: TEST-POL-582731
Insured: Synthetic Test Customer C
Benefit Amount: $500,000
Beneficiary Designation: Primary Trust`,
    policyIds: ["TEST-POL-582731"],
    contentTypes: ["prose"],
  },

  // 7. Cross-Document Supporting Fact Document
  {
    key: "endorsement_endorse_TEST-POL-482731.md",
    orgId: "TEST-ORG-A",
    mimeType: "text/markdown",
    version: 1,
    isSuperseded: false,
    text: `# Policy Endorsement Rider #4: TEST-POL-482731

Associated Policy: TEST-POL-482731
Endorsement Subject: Solar Panel Array Coverage
Approved Addendum:
An additional $12,000 rooftop solar photovoltaic coverage is added to policy TEST-POL-482731, subject to a $500 separate windstorm deductible.`,
    policyIds: ["TEST-POL-482731"],
    contentTypes: ["prose"],
  },

  // 8. Tenant B Document (Cross-Tenant Isolation Test)
  {
    key: "policy_TEST-POL-482731_orgB.md",
    orgId: "TEST-ORG-B",
    mimeType: "text/markdown",
    version: 1,
    isSuperseded: false,
    text: `# Policy TEST-POL-482731 — Marine Cargo Insurance (Tenant B)
Policy number: TEST-POL-482731
Organization: TEST-ORG-B (Restricted Tenant)
Cargo Coverage Limit: $5,000,000 international transit`,
    policyIds: ["TEST-POL-482731"],
    contentTypes: ["prose"],
  },
];

// ---------------------------------------------------------------------------
// Document Manifest (Traceable metadata & expected facts)
// ---------------------------------------------------------------------------

export const DOCUMENT_MANIFEST: DocumentManifestItem[] = [
  {
    syntheticDocId: "DOC-SYN-001",
    filename: "policy_TEST-POL-482731.md",
    mimeType: "text/markdown",
    documentVersion: 2,
    isSuperseded: false,
    expectedPolicyNumbers: ["TEST-POL-482731"],
    relevantSections: ["Coverage Summary", "Narrative Conditions", "Coverage Limits", "Exclusions"],
    expectedFactualAnswers: {
      "personal_belongings": "$25,000",
      "water_damage": "covered against sudden pipe burst",
      "jewellery_limit": "$1,500 per item",
    },
    expectedSourceReferences: ["policy_TEST-POL-482731.md"],
    testCaseIds: ["POL-TC-001", "POL-TC-004", "POL-TC-008"],
  },
  {
    syntheticDocId: "DOC-SYN-002",
    filename: "policy_TEST-POL-482731_v1_superseded.md",
    mimeType: "text/markdown",
    documentVersion: 1,
    isSuperseded: true,
    expectedPolicyNumbers: ["TEST-POL-482731"],
    relevantSections: ["Coverage limit"],
    expectedFactualAnswers: {
      "superseded_limit": "$20,000",
    },
    expectedSourceReferences: ["policy_TEST-POL-482731_v1_superseded.md"],
    testCaseIds: ["POL-TC-008"],
  },
  {
    syntheticDocId: "DOC-SYN-003",
    filename: "policy_commercial_table_TEST-POL-610200.md",
    mimeType: "application/pdf",
    documentVersion: 1,
    isSuperseded: false,
    expectedPolicyNumbers: ["TEST-POL-610200"],
    relevantSections: ["Coverage Schedule & Limits Table", "Deductible Notes"],
    expectedFactualAnswers: {
      "cyber_deductible": "$25,000",
      "building_limit": "$2,500,000",
    },
    expectedSourceReferences: ["policy_commercial_table_TEST-POL-610200.md"],
    testCaseIds: ["POL-TC-002"],
  },
  {
    syntheticDocId: "DOC-SYN-004",
    filename: "policy_loss_ratio_chart_TEST-POL-730100.md",
    mimeType: "image/png",
    documentVersion: 1,
    isSuperseded: false,
    expectedPolicyNumbers: ["TEST-POL-730100"],
    relevantSections: ["Historical Loss Ratio Chart", "Risk Adjustment Findings"],
    expectedFactualAnswers: {
      "loss_ratio_2025": "41%",
      "renewal_credit": "15%",
    },
    expectedSourceReferences: ["policy_loss_ratio_chart_TEST-POL-730100.md"],
    testCaseIds: ["POL-TC-003"],
  },
  {
    syntheticDocId: "DOC-SYN-005",
    filename: "policy_TEST-POL-482732.md",
    mimeType: "text/markdown",
    documentVersion: 1,
    isSuperseded: false,
    expectedPolicyNumbers: ["TEST-POL-482732"],
    relevantSections: ["Coverage Limits"],
    expectedFactualAnswers: {
      "collision_limit": "$30,000",
    },
    expectedSourceReferences: ["policy_TEST-POL-482732.md"],
    testCaseIds: ["POL-TC-005"],
  },
  {
    syntheticDocId: "DOC-SYN-007",
    filename: "endorsement_endorse_TEST-POL-482731.md",
    mimeType: "text/markdown",
    documentVersion: 1,
    isSuperseded: false,
    expectedPolicyNumbers: ["TEST-POL-482731"],
    relevantSections: ["Approved Addendum"],
    expectedFactualAnswers: {
      "solar_array_limit": "$12,000",
    },
    expectedSourceReferences: ["endorsement_endorse_TEST-POL-482731.md"],
    testCaseIds: ["POL-TC-010"],
  },
  {
    syntheticDocId: "DOC-SYN-008",
    filename: "policy_TEST-POL-482731_orgB.md",
    mimeType: "text/markdown",
    documentVersion: 1,
    isSuperseded: false,
    expectedPolicyNumbers: ["TEST-POL-482731"],
    relevantSections: ["Cargo Coverage Limit"],
    expectedFactualAnswers: {
      "tenant_b_cargo": "$5,000,000",
    },
    expectedSourceReferences: ["policy_TEST-POL-482731_orgB.md"],
    testCaseIds: ["POL-TC-009"],
  },
];

// ---------------------------------------------------------------------------
// 10 Required Benchmark Scenarios (Section 4 Requirements)
// ---------------------------------------------------------------------------

export const TEN_REQUIRED_POLICY_SCENARIOS: PolicyTestCase[] = [
  // 1. Exact policy number with direct factual question
  {
    id: "POL-TC-001",
    category: "exact_direct",
    description: "Exact policy number with a direct factual question on personal property limit",
    orgId: "TEST-ORG-A",
    query: "What is the personal belongings coverage limit for policy TEST-POL-482731?",
    expectedRoute: "hybrid",
    expectedDocs: ["policy_TEST-POL-482731.md"],
    rejectedDocs: ["policy_TEST-POL-482732.md", "policy_TEST-POL-482731_orgB.md"],
    expectedFact: "$25,000",
    expectNoEvidence: false,
  },

  // 2. Exact policy number with answer in a table
  {
    id: "POL-TC-002",
    category: "exact_table",
    description: "Exact policy number with a question whose answer appears in a table (Cyber deductible)",
    orgId: "TEST-ORG-A",
    query: "Under commercial policy TEST-POL-610200, what is the Cyber Incident Response deductible in the limits schedule?",
    expectedRoute: "hybrid",
    expectedDocs: ["policy_commercial_table_TEST-POL-610200.md"],
    rejectedDocs: ["policy_TEST-POL-482731.md"],
    expectedFact: "$25,000",
    expectNoEvidence: false,
  },

  // 3. Exact policy number with chart interpretation
  {
    id: "POL-TC-003",
    category: "exact_chart",
    description: "Exact policy number with a question requiring chart interpretation (2025 loss ratio)",
    orgId: "TEST-ORG-A",
    query: "According to the historical loss ratio chart for policy TEST-POL-730100, what was the fleet loss ratio in 2025?",
    expectedRoute: "hybrid",
    expectedDocs: ["policy_loss_ratio_chart_TEST-POL-730100.md"],
    rejectedDocs: ["policy_TEST-POL-482731.md"],
    expectedFact: "41%",
    expectNoEvidence: false,
  },

  // 4. Exact policy number with narrative evidence
  {
    id: "POL-TC-004",
    category: "exact_narrative",
    description: "Exact policy number with narrative evidence regarding pipe burst water damage",
    orgId: "TEST-ORG-A",
    query: "Does policy TEST-POL-482731 cover water damage from a burst pipe inside the dwelling?",
    expectedRoute: "hybrid",
    expectedDocs: ["policy_TEST-POL-482731.md"],
    rejectedDocs: ["policy_TEST-POL-482732.md"],
    expectedFact: "covered against water damage from sudden pipe burst",
    expectNoEvidence: false,
  },

  // 5. Similar but incorrect policy number
  {
    id: "POL-TC-005",
    category: "similar_incorrect",
    description: "Similar but incorrect policy number: query for TEST-POL-482732 must NOT return TEST-POL-482731",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-482732",
    expectedRoute: "bm25",
    expectedDocs: ["policy_TEST-POL-482732.md"],
    rejectedDocs: ["policy_TEST-POL-482731.md", "policy_TEST-POL-582731.md"],
    expectedFact: "$30,000",
    expectNoEvidence: false,
  },

  // 6. Policy number not present in knowledge base (negative answer policy)
  {
    id: "POL-TC-006",
    category: "non_existent",
    description: "Policy number not present in knowledge base returns explicit no-evidence response",
    orgId: "TEST-ORG-A",
    query: "What is the deductible for policy TEST-POL-999999?",
    expectedRoute: "hybrid",
    expectedDocs: [],
    rejectedDocs: ["policy_TEST-POL-482731.md", "policy_commercial_table_TEST-POL-610200.md"],
    expectNoEvidence: true,
  },

  // 7. Two policy numbers with overlapping prefixes
  {
    id: "POL-TC-007",
    category: "overlapping_prefix",
    description: "Two policy numbers with overlapping prefix: TEST-POL-48273 vs TEST-POL-482731",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-48273",
    expectedRoute: "bm25",
    expectedDocs: [], // Exact token matching should NOT return 482731
    rejectedDocs: ["policy_TEST-POL-482731.md"],
    expectNoEvidence: true,
  },

  // 8. Superseded policy document versus current version
  {
    id: "POL-TC-008",
    category: "superseded_version",
    description: "Current policy version 2 ($25,000) must be distinguished from superseded version 1 ($20,000)",
    orgId: "TEST-ORG-A",
    query: "What is the current active personal belongings limit for TEST-POL-482731?",
    expectedRoute: "hybrid",
    expectedDocs: ["policy_TEST-POL-482731.md"],
    rejectedDocs: [],
    expectedFact: "$25,000",
    expectNoEvidence: false,
  },

  // 9. Policy-number query from a different organization
  {
    id: "POL-TC-009",
    category: "cross_tenant",
    description: "Cross-tenant query: TEST-ORG-A querying TEST-POL-482731 must NEVER receive TEST-ORG-B's cargo policy",
    orgId: "TEST-ORG-A",
    query: "TEST-POL-482731 marine cargo limit",
    expectedRoute: "bm25",
    expectedDocs: [],
    rejectedDocs: ["policy_TEST-POL-482731_orgB.md"],
    expectNoEvidence: true,
  },

  // 10. Policy number in one document and supporting facts in another authorized document
  {
    id: "POL-TC-010",
    category: "cross_document_multi_hop",
    description: "Multi-document evidence: solar endorsement addendum for TEST-POL-482731",
    orgId: "TEST-ORG-A",
    query: "What is the solar panel array endorsement coverage limit for policy TEST-POL-482731?",
    expectedRoute: "hybrid",
    expectedDocs: ["endorsement_endorse_TEST-POL-482731.md"],
    rejectedDocs: ["policy_TEST-POL-482732.md"],
    expectedFact: "$12,000",
    expectNoEvidence: false,
  },
];

export const POLICY_TEST_CASES = TEN_REQUIRED_POLICY_SCENARIOS;

