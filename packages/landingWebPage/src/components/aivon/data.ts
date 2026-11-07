export interface SimulationScenario {
  id: string;
  category: string;
  label: string;
  customerQuery: string;
  pipeline: {
    stage: string;
    title: string;
    detail: string;
    status: string;
    timing: string;
  }[];
  aiResponse: string;
  sourceNote: string;
  stats: {
    precision: string;
    latency: string;
    tenant: string;
    model: string;
  };
}

export const simulationScenarios: SimulationScenario[] = [
  {
    id: "rag-query",
    category: "RAG & Knowledge Retrieval",
    label: "Knowledge Retrieval",
    customerQuery: "How do I upgrade my subscription plan to Enterprise and add 10 seats?",
    pipeline: [
      {
        stage: "RETRIEVE",
        title: "Vector Search",
        detail: "Scoped query across namespace: 'org_acme_corp'. Cosine similarity threshold >= 0.82.",
        status: "94.6% Precision@5",
        timing: "42ms",
      },
      {
        stage: "UNDERSTAND",
        title: "Intent & Context Check",
        detail: "Identified billing/upgrade intent. Context verified against current seat allocation docs.",
        status: "Confidence: 0.98",
        timing: "65ms",
      },
      {
        stage: "SELECT TOOL",
        title: "Tool Execution",
        detail: "Invoking searchKnowledge(query='enterprise tier seating policy'). No escalation required.",
        status: "Tool: searchKnowledge",
        timing: "58ms",
      },
      {
        stage: "RESPOND",
        title: "Grounded Synthesis",
        detail: "Generating factual response using retrieved chunks #1402 and #1408. Zero hallucination.",
        status: "Token Stream Ready",
        timing: "75ms",
      },
    ],
    aiResponse:
      "You can upgrade to Enterprise directly in your Billing Settings. Enterprise includes custom seat limits, SSO with Clerk, and dedicated Vapi voice agents. Would you like me to send you the direct invoice link or apply the 10-seat expansion immediately?",
    sourceNote: "Answer generated from Acme Corp's verified knowledge base (Billing & SLA Handbook v3.2).",
    stats: {
      precision: "94.6%",
      latency: "240ms",
      tenant: "org_acme_corp",
      model: "GPT-4o-mini",
    },
  },
  {
    id: "escalation-query",
    category: "Human Escalation Agent",
    label: "Human Escalation",
    customerQuery: "My webhook failed 3 times and our production webhook endpoint is returning 500!",
    pipeline: [
      {
        stage: "RETRIEVE",
        title: "Knowledge Search",
        detail: "Queried incident runbooks. Found generic retry troubleshooting, but error indicates production outage.",
        status: "Runbook Match: 0.74",
        timing: "38ms",
      },
      {
        stage: "UNDERSTAND",
        title: "Distress & SLA Detection",
        detail: "Customer sentiment: Critical. Production down alert detected. Automated resolution threshold unmet.",
        status: "Urgency: High (SLA P1)",
        timing: "45ms",
      },
      {
        stage: "SELECT TOOL",
        title: "Autonomous Escalation",
        detail: "Agent triggers escalateConversation(reason='production webhook 500 error', priority='high').",
        status: "Tool: escalateConversation",
        timing: "52ms",
      },
      {
        stage: "RESPOND",
        title: "Operator Hand-off",
        detail: "Conversation routed to active human operator queue via Convex real-time subscription.",
        status: "Handoff Dispatched",
        timing: "40ms",
      },
    ],
    aiResponse:
      "I have flagged this as an urgent production issue and escalated your conversation directly to our senior platform engineer on call. Your full session context and error trace have been forwarded.",
    sourceNote: "Escalated to Operator Dashboard (Queue Position: #1 • Agent presence acknowledged).",
    stats: {
      precision: "100%",
      latency: "175ms",
      tenant: "org_acme_corp",
      model: "GPT-4o",
    },
  },
  {
    id: "security-query",
    category: "Security & BYOK",
    label: "BYOK & Security",
    customerQuery: "Where are our third-party Vapi and OpenAI API credentials stored?",
    pipeline: [
      {
        stage: "RETRIEVE",
        title: "Security Spec Search",
        detail: "Retrieving tenant security policy and AWS Secrets Manager integration documentation.",
        status: "Verified Context",
        timing: "40ms",
      },
      {
        stage: "UNDERSTAND",
        title: "Security Intent",
        detail: "Answering architecture question without exposing private environment variables or keys.",
        status: "Zero Secret Leakage",
        timing: "50ms",
      },
      {
        stage: "SELECT TOOL",
        title: "Architecture Lookup",
        detail: "Referenced tenant security model: tenant/{organizationId}/{service} path in AWS Secrets Manager.",
        status: "Reference Verified",
        timing: "48ms",
      },
      {
        stage: "RESPOND",
        title: "Architectural Explanation",
        detail: "Explained BYOK envelope encryption: secrets live only in AWS Secrets Manager; only hashed ARNs exist in DB.",
        status: "Clean Response",
        timing: "62ms",
      },
    ],
    aiResponse:
      "Aivon employs an enterprise BYOK (Bring Your Own Key) architecture. Your API keys are never stored as plaintext in our application database. Instead, they are stored directly in AWS Secrets Manager under tenant-isolated paths (tenant/{orgId}/{service}), and our Convex backend resolves them just-in-time via IAM credentials.",
    sourceNote: "Answer generated from Aivon Enterprise Security & Compliance Architecture documentation.",
    stats: {
      precision: "99.1%",
      latency: "200ms",
      tenant: "org_acme_corp",
      model: "Claude 3.5 Sonnet",
    },
  },
];

export const problemSolutionSteps = [
  {
    step: "01",
    tag: "CUSTOMER QUESTION",
    problem: "Customers demand instantaneous 24/7 answers across web and voice, but generic bots hallucinate inaccurate information.",
    solution: "Aivon accepts omnichannel input via real-time WebSocket chat and WebRTC voice, parsing user intent with zero request latency.",
    badge: "Immediate Ingestion",
  },
  {
    step: "02",
    tag: "COMPANY KNOWLEDGE",
    problem: "Company documentation is fragmented across PDFs, images, markdown, and websites, leading to siloed, ungrounded responses.",
    solution: "Multimodal ingestion normalizes PDFs, images, and HTML with SHA-256 deduplication and organization-isolated vector embeddings.",
    badge: "Isolated Vector Namespaces",
  },
  {
    step: "03",
    tag: "AI RESPONSE",
    problem: "Calling an LLM without guardrails or tools produces unpredictable, untraceable output that SaaS businesses cannot trust.",
    solution: "Stateful agents use custom tools (searchKnowledge, escalateConversation, resolveConversation) with two-stage RAG synthesis.",
    badge: "94.6% Precision@5",
  },
  {
    step: "04",
    tag: "HUMAN ESCALATION",
    problem: "Pure AI automation breaks down on edge cases, billing disputes, or production emergencies, frustrating high-value customers.",
    solution: "Controlled handoff dynamically reassigns the conversation to the live Operator Dashboard with complete transcript context.",
    badge: "Zero Context Loss",
  },
  {
    step: "05",
    tag: "RESOLUTION",
    problem: "Closed conversations leave no audit trail, preventing teams from knowing what failed, what succeeded, or when tickets were closed.",
    solution: "Automatic conversation status machine (unresolved → escalated → resolved) with Sentry distributed tracing and analytics.",
    badge: "Production Audit Trail",
  },
];

export const architectureNodes = [
  {
    id: "user",
    title: "End User",
    subtitle: "Customer or Visitor",
    category: "Client Tier",
    description: "Interacts via lightweight web chat or low-latency WebRTC voice on any customer-facing application.",
    details: "Zero friction, anonymous session initialization with automatic browser metadata capture and 24h rolling expiry.",
    tech: "Browser WebRTC / Fetch",
  },
  {
    id: "widget",
    title: "Embedded Widget",
    subtitle: "< 5KB Script Tag",
    category: "Client Tier",
    description: "Self-contained vanilla TypeScript iframe injector that integrates seamlessly into any host website with a single snippet.",
    details: "Completely dependency-free runtime IIFE. Isolated CSS inside iframe prevents host stylesheet pollution.",
    tech: "Vite + TypeScript IIFE",
  },
  {
    id: "convex",
    title: "Real-Time Conversation",
    subtitle: "Convex Reactive Engine",
    category: "Backend Tier",
    description: "Serverless reactive database that maintains real-time WebSocket subscriptions between customer widgets and operator dashboards.",
    details: "Automatic optimistic updates, end-to-end TypeScript types, ACID transactional consistency, and zero polling overhead.",
    tech: "Convex Realtime DB",
  },
  {
    id: "agent",
    title: "AI Support Agent",
    subtitle: "Stateful Tool-Using Agent",
    category: "AI Tier",
    description: "Autonomous agent driven by GPT-4o-mini / Claude 3.5 Sonnet that reasons over state and executes operational tools.",
    details: "Evaluates conversational memory, checks confidence bounds, and dynamically dispatches domain tools instead of pure generation.",
    tech: "@convex-dev/agent",
  },
  {
    id: "rag",
    title: "RAG Knowledge Search",
    subtitle: "Org-Scoped Vector Index",
    category: "AI Tier",
    description: "Retrieves semantically relevant document chunks strictly bounded by the organization's vector namespace.",
    details: "Uses text-embedding-3-small (1536 dim) with cosine similarity and SHA-256 pre-computed deduplication hashes.",
    tech: "@convex-dev/rag + OpenAI",
  },
  {
    id: "tools",
    title: "Tool Selection",
    subtitle: "Search / Escalate / Resolve",
    category: "AI Tier",
    description: "Deterministic tools that bridge language model reasoning with production system state mutations.",
    details: "searchKnowledge query retrieval, escalateConversation routing to human operators, and resolveConversation lifecycle management.",
    tech: "Convex Tool Actions",
  },
  {
    id: "response",
    title: "Response / Escalate / Resolve",
    subtitle: "Grounded Lifecycle Action",
    category: "Outcome",
    description: "Delivers fact-checked answers back to the customer or routes the ticket to the human operator queue.",
    details: "Streams verified token output with citation provenance, or activates real-time presence bells on operator dashboards.",
    tech: "Streaming WebSocket / Push",
  },
];

export const infrastructureRails = [
  {
    title: "Multi-Tenant Data Isolation",
    badge: "Security",
    desc: "Strict namespace: orgId partitioning on every query, mutation, and vector index. Zero cross-tenant leakage guaranteed at the database schema level.",
  },
  {
    title: "Clerk JWT Authentication",
    badge: "Auth & Identity",
    desc: "Role-based access control and organization-scoped claims validated on every private backend endpoint before data access.",
  },
  {
    title: "AWS Secrets Manager (BYOK)",
    badge: "Enterprise Security",
    desc: "Tenant API keys stored under tenant/{orgId}/{service}. Application database persists only ARN references — zero plaintext credentials in DB.",
  },
  {
    title: "Billing & Webhooks (Svix)",
    badge: "Monetization",
    desc: "Usage-gated AI calls, tiered seat limits, and cryptographically verified Svix webhooks synchronizing subscription states.",
  },
  {
    title: "Sentry Observability",
    badge: "Reliability",
    desc: "Distributed tracing and real-time error tracking across serverless functions, LLM timeouts, and client widget exceptions.",
  },
  {
    title: "Convex Real-Time Backend",
    badge: "Infrastructure",
    desc: "Reactive mutations, scheduled internal tasks, and automatic cache invalidation powering sub-50ms multi-client state sync.",
  },
];

export const tenCapabilities = [
  {
    num: "01",
    id: "rag",
    title: "Retrieval-Augmented Generation",
    heading: "Your data. Your answers.",
    metric: "94.6% Precision@5",
    metricLabel: "RAG retrieval evaluated against a labeled evaluation set",
    explanation:
      "Aivon doesn't rely on generic model knowledge. Each organization gets an isolated knowledge space that powers grounded AI responses without hallucinations.",
    flow: [
      { name: "PDF, Image, HTML, Text", desc: "Multimodal ingestion pipeline" },
      { name: "Content Processing", desc: "Structure-aware chunking & extraction" },
      { name: "SHA-256 Deduplication", desc: "Prevents redundant vector computation" },
      { name: "Org-Scoped Vector Index", desc: "Enforced namespace: orgId isolation" },
      { name: "Context Filtering", desc: "Top-k cosine similarity threshold >= 0.82" },
      { name: "AI Response Synthesis", desc: "Context-grounded attribution" },
    ],
    highlights: [
      "Multimodal knowledge ingestion (PDF, Images, Markdown, CSV, HTML)",
      "Organization-scoped vector namespaces preventing tenant cross-talk",
      "Content filtering with strict similarity thresholds",
      "SHA-256 pre-embedding hash deduplication to save LLM tokens",
      "Two-stage retrieval pipeline with semantic context ranking",
    ],
  },
  {
    num: "02",
    id: "agentic",
    title: "Agentic Workflows",
    heading: "An AI agent that can do more than answer.",
    metric: "3 Deterministic Tools",
    metricLabel: "Search, Escalate, and Resolve integrated into runtime",
    explanation:
      "The support agent is stateful and interacts with the system through purpose-built tools instead of generating text alone.",
    flow: [
      { name: "User Request", desc: "Streaming natural language input" },
      { name: "Stateful Agent", desc: "Evaluates history & uncertainty" },
      { name: "Dynamic Tool Dispatch", desc: "searchKnowledge | escalate | resolve" },
      { name: "System Mutation", desc: "Real-time state modification in DB" },
    ],
    highlights: [
      "Stateful AI agent powered by @convex-dev/agent",
      "Dynamic tool selection based on conversation semantics",
      "Knowledge search with isolated organizational vector lookup",
      "Explicit human escalation workflow when uncertainty is high",
      "Automated conversation resolution with customer feedback",
    ],
  },
  {
    num: "03",
    id: "realtime",
    title: "Real-Time Infrastructure",
    heading: "Support shouldn't feel like a request-response cycle.",
    metric: "< 50ms Sync",
    metricLabel: "WebSocket reactivity across widget and dashboard",
    explanation:
      "Convex provides the real-time backend layer for conversations, live updates, serverless functions, and end-to-end TypeScript across the system.",
    flow: [
      { name: "Customer Action", desc: "Message sent in chat widget" },
      { name: "Convex WebSocket", desc: "Reactive mutation triggers event" },
      { name: "AI Agent Process", desc: "Streaming token synthesis" },
      { name: "Operator Sync", desc: "Instant update on dashboard screen" },
    ],
    highlights: [
      "Persistent WebSocket subscriptions with zero polling",
      "Optimistic UI updates for immediate user feedback",
      "End-to-end TypeScript contracts across full stack",
      "Atomic transactional guarantees on conversation states",
      "Simultaneous operator and customer synchronization",
    ],
  },
  {
    num: "04",
    id: "human-ai",
    title: "Human + AI Collaboration",
    heading: "AI handles the routine. Humans handle what matters.",
    metric: "Zero Context Loss",
    metricLabel: "Full conversation history forwarded upon escalation",
    explanation:
      "AI is not treated as an all-or-nothing replacement for human support. Aivon is designed around controlled handoff when automation should stop.",
    flow: [
      { name: "AI Conversation", desc: "Handles FAQs and routine lookups" },
      { name: "Confidence Fallback", desc: "Uncertainty trigger detected" },
      { name: "Escalate Action", desc: "Status updated to 'escalated'" },
      { name: "Operator Takes Over", desc: "Human replies in real time" },
    ],
    highlights: [
      "Controlled escalation with sentiment & confidence detection",
      "AI-assisted response drafting for human operators",
      "Live operator presence tracking and audio alerts",
      "Explicit conversation status machine: unresolved → escalated → resolved",
    ],
  },
  {
    num: "05",
    id: "voice",
    title: "Voice AI & Omnichannel",
    heading: "Support shouldn't stop at the chat box.",
    metric: "-40% Drafting Time",
    metricLabel: "Reduced agent response drafting time by 40%",
    explanation:
      "Integrated Vapi-powered WebRTC voice conversations extend the same grounded support experience beyond text into natural voice interactions.",
    flow: [
      { name: "Customer Voice", desc: "Audio stream via WebRTC" },
      { name: "Vapi Voice Gateway", desc: "Sub-300ms speech-to-speech engine" },
      { name: "Aivon Knowledge Core", desc: "Same org-scoped RAG context" },
      { name: "Synthesized Audio", desc: "Real-time human-like conversation" },
    ],
    highlights: [
      "Sub-300ms bi-directional WebRTC audio streaming",
      "Vapi integration with custom assistant prompting",
      "Shared knowledge base across text and voice channels",
      "Omnichannel conversation logging and transcript storage",
    ],
  },
  {
    num: "06",
    id: "multitenancy",
    title: "Multi-Tenant Architecture",
    heading: "One platform. Isolated organizations.",
    metric: "100% Isolation",
    metricLabel: "Strict organization-scoped data and vector segregation",
    explanation:
      "Every organization's conversations, knowledge, and retrieval context are isolated through organization-scoped access control and vector namespaces.",
    flow: [
      { name: "Org A (Namespace A)", desc: "Isolated vector index + files" },
      { name: "Org B (Namespace B)", desc: "Isolated vector index + files" },
      { name: "Org C (Namespace C)", desc: "Isolated vector index + files" },
      { name: "Auth Verification", desc: "orgId verified from JWT on every call" },
    ],
    highlights: [
      "Organization-level access control enforced on every mutation",
      "Org-scoped vector namespaces (namespace: orgId) preventing cross-talk",
      "Public vs private API separation (widget vs dashboard)",
      "Strict Clerk session & JWT validation on all private routes",
    ],
  },
  {
    num: "07",
    id: "security",
    title: "Security & BYOK Architecture",
    heading: "AI products need more than an API key in an environment variable.",
    metric: "Zero Plaintext DB Keys",
    metricLabel: "All tenant secrets stored in AWS Secrets Manager",
    explanation:
      "Aivon uses an enterprise BYOK architecture where tenant-specific third-party credentials are stored in AWS Secrets Manager while only secret references are persisted in the application database.",
    flow: [
      { name: "Tenant Input", desc: "Customer provides their Vapi/OpenAI key" },
      { name: "AWS Secrets Manager", desc: "Stored under tenant/{orgId}/{service}" },
      { name: "DB Secret Reference", desc: "Only ARN / identifier saved in Convex" },
      { name: "Just-In-Time Fetch", desc: "Resolved securely during runtime execution" },
    ],
    highlights: [
      "Enterprise Bring-Your-Own-Key (BYOK) credential isolation",
      "AWS Secrets Manager with strict IAM scoped access",
      "Cryptographically verified Svix webhooks for billing and events",
      "Zero plain-text secret storage in application databases",
    ],
  },
  {
    num: "08",
    id: "developer-exp",
    title: "Developer Experience",
    heading: "AI support should be easy to integrate.",
    metric: "< 5KB Script",
    metricLabel: "Embeddable JS widget with zero external dependencies",
    explanation:
      "Businesses can embed the support experience directly into their websites with a single snippet without rebuilding their own support infrastructure.",
    flow: [
      { name: "Script Tag", desc: "<script src='...' data-org='...'></script>" },
      { name: "Vite IIFE Injector", desc: "Creates isolated responsive iframe" },
      { name: "Anonymous Session", desc: "24h contact session created" },
      { name: "Customer Conversation", desc: "Immediate real-time AI engagement" },
    ],
    highlights: [
      "Drop-in 1-line script tag integration",
      "Dependency-free vanilla JS iframe injector (apps/embed)",
      "Customizable widget position, brand colors, and greeting",
      "Anonymous contact sessions with rolling auto-refresh",
    ],
  },
  {
    num: "09",
    id: "product-eng",
    title: "Product Engineering",
    heading: "AI is only one part of the product.",
    metric: "6 Full Modules",
    metricLabel: "Complete operational dashboard for support teams",
    explanation:
      "Behind the AI is the product infrastructure required to operate it: authentication, team management, usage billing, settings, and conversation monitoring.",
    flow: [
      { name: "Conversations", desc: "Live monitoring & manual takeover" },
      { name: "Knowledge Base", desc: "Drag-and-drop file ingestion & status" },
      { name: "Widget Customization", desc: "Real-time preview & branding controls" },
      { name: "Billing & Plans", desc: "Tiered subscription enforcement" },
    ],
    highlights: [
      "Clerk authentication with multi-organization support",
      "Live Operator Dashboard with conversation triage and filters",
      "Knowledge base management with real-time indexing status",
      "Interactive widget customizer with live color & copy preview",
    ],
  },
  {
    num: "10",
    id: "observability",
    title: "Observability & Reliability",
    heading: "When something breaks, you need to know.",
    metric: "End-to-End Traces",
    metricLabel: "Sentry distributed tracing across frontend & backend",
    explanation:
      "Production systems need visibility. Aivon integrates error tracking so failures can be detected and investigated instead of disappearing into the void.",
    flow: [
      { name: "Error Detected", desc: "LLM timeout or webhook validation failure" },
      { name: "Distributed Trace", desc: "Full breadcrumb and stack trace captured" },
      { name: "Root Cause Identified", desc: "Tenant and context metadata isolated" },
      { name: "Immediate Mitigation", desc: "Graceful fallback to operator queue" },
    ],
    highlights: [
      "Sentry integration for Next.js 15 and serverless Convex functions",
      "LLM timeout catching and automated fallback messages",
      "Audit logs for all administrative settings and secret updates",
      "Graceful degradation when external providers experience downtime",
    ],
  },
];

export const architectureLayers = [
  {
    layer: 1,
    id: "ux",
    name: "LAYER 1: USER EXPERIENCE",
    badge: "Omnichannel Touchpoints",
    desc: "Unifying end-customers, support operators, and software engineers into a cohesive interface ecosystem.",
    items: [
      { title: "End Customer", desc: "Web chat widget + WebRTC voice interface" },
      { title: "Support Operator", desc: "Live queue dashboard with real-time sync & manual takeover" },
      { title: "Developer / Admin", desc: "1-line embed snippet, widget customizer, and API configuration" },
    ],
  },
  {
    layer: 2,
    id: "app",
    name: "LAYER 2: APPLICATION RUNTIME",
    badge: "Next.js 15 & React 19",
    desc: "Modern performant client layer built for sub-second page loads and seamless real-time reactivity.",
    items: [
      { title: "Operator Dashboard (apps/web)", desc: "Next.js 15 App Router, Clerk auth, shadcn/ui" },
      { title: "Chat Widget App (apps/widget)", desc: "Session-based Next.js 15 client with Jotai state" },
      { title: "Embed Script (apps/embed)", desc: "Vanilla TypeScript IIFE built with Vite (< 5KB)" },
    ],
  },
  {
    layer: 3,
    id: "ai",
    name: "LAYER 3: AI & REASONING PIPELINE",
    badge: "Agentic RAG Engine",
    desc: "Domain-grounded intelligence layer with multimodal ingestion, vector indexing, and dynamic tool invocation.",
    items: [
      { title: "Support Agent", desc: "@convex-dev/agent with persistent thread memory" },
      { title: "RAG Engine", desc: "text-embedding-3-small (1536 dim) + org-scoped namespaces" },
      { title: "Operational Tools", desc: "searchKnowledge, escalateConversation, resolveConversation" },
      { title: "Multi-Model Support", desc: "Swappable model providers: OpenAI, Anthropic, xAI Grok" },
    ],
  },
  {
    layer: 4,
    id: "backend",
    name: "LAYER 4: REAL-TIME BACKEND",
    badge: "Convex Serverless Engine",
    desc: "Unified database, reactive mutations, and internal scheduled jobs with end-to-end TypeScript safety.",
    items: [
      { title: "Convex Reactive DB", desc: "WebSocket subscriptions with sub-50ms optimistic updates" },
      { title: "Serverless Functions", desc: "public/ (widget), private/ (operator), system/ (internal)" },
      { title: "State Machine", desc: "Atomic transitions: unresolved → escalated → resolved" },
      { title: "Session Lifecycle", desc: "24h rolling contact sessions with automatic auto-refresh" },
    ],
  },
  {
    layer: 5,
    id: "infra",
    name: "LAYER 5: CLOUD & SECURITY INFRASTRUCTURE",
    badge: "Enterprise Security Rails",
    desc: "Hardened external services ensuring enterprise compliance, tenant credential isolation, and auditability.",
    items: [
      { title: "AWS Secrets Manager", desc: "BYOK credential vault (tenant/{orgId}/{service})" },
      { title: "Clerk", desc: "Enterprise JWT auth, organization RBAC, and seat limits" },
      { title: "Svix", desc: "Cryptographically verified billing webhooks" },
      { title: "Vapi", desc: "Sub-300ms real-time WebRTC voice integration" },
      { title: "Sentry", desc: "Distributed error tracing across serverless and frontend" },
    ],
  },
];

export const techStackGrouped = [
  {
    category: "PRODUCT & FRONTEND",
    icon: "💻",
    description: "Modern, reactive web interfaces crafted for speed, accessibility, and operator ergonomics.",
    items: [
      {
        name: "Next.js 15",
        usedFor: "App Router architecture, React Server Components, and optimized client bundles for both dashboard and widget.",
      },
      {
        name: "React 19",
        usedFor: "Concurrent rendering, transitions, and modern state hooks across all applications.",
      },
      {
        name: "Tailwind CSS v4",
        usedFor: "Design system tokens, custom dark palette, responsive utilities, and micro-interaction styling.",
      },
      {
        name: "shadcn/ui",
        usedFor: "Accessible, keyboard-navigable UI primitives (dialogs, dropdowns, tables, command menus).",
      },
      {
        name: "Jotai",
        usedFor: "Atomic state management in the widget for screen navigation and session cache without prop drilling.",
      },
    ],
  },
  {
    category: "BACKEND & DATA",
    icon: "⚡",
    description: "Serverless reactive backend guaranteeing instant data delivery and type safety.",
    items: [
      {
        name: "Convex",
        usedFor: "Real-time reactive database, serverless mutations/queries, file storage, and internal action scheduling.",
      },
      {
        name: "TypeScript (Strict)",
        usedFor: "End-to-end type contracts between database schema, serverless functions, and frontend components.",
      },
    ],
  },
  {
    category: "AI & ORCHESTRATION",
    icon: "🧠",
    description: "Multi-model reasoning, grounding, and autonomous action execution.",
    items: [
      {
        name: "@convex-dev/agent",
        usedFor: "Stateful agent runtime maintaining conversation threads, tool execution loops, and message histories.",
      },
      {
        name: "@convex-dev/rag",
        usedFor: "Vector indexing, cosine similarity search, chunk normalization, and namespace-isolated retrieval.",
      },
      {
        name: "OpenAI GPT-4o / mini",
        usedFor: "Primary conversational agent model and text-embedding-3-small vector embeddings.",
      },
      {
        name: "Anthropic Claude 3.5 Sonnet",
        usedFor: "High-precision technical synthesis and nuanced edge-case reasoning.",
      },
      {
        name: "xAI Grok",
        usedFor: "Alternative LLM provider validation proving architectural neutrality over model choice.",
      },
    ],
  },
  {
    category: "COMMUNICATION",
    icon: "🎙️",
    description: "Low-latency omnichannel support bringing AI conversation to the voice medium.",
    items: [
      {
        name: "Vapi AI",
        usedFor: "Real-time conversational voice assistant orchestration and phone/web audio pipelines.",
      },
      {
        name: "WebRTC",
        usedFor: "Sub-300ms bi-directional audio streaming between browser microphone and voice AI gateway.",
      },
    ],
  },
  {
    category: "SECURITY & AUTH",
    icon: "🔒",
    description: "Zero-trust credential storage and cryptographic access boundaries.",
    items: [
      {
        name: "AWS Secrets Manager",
        usedFor: "Tenant-isolated BYOK credential vault (tenant/{organizationId}/{service}) storing third-party API keys.",
      },
      {
        name: "Clerk",
        usedFor: "Enterprise JWT identity, organization switching, multi-tenant RBAC, and subscription seat tracking.",
      },
      {
        name: "Svix",
        usedFor: "HMAC signature verification for inbound webhooks (Clerk billing and subscription synchronization).",
      },
    ],
  },
  {
    category: "PLATFORM & TOOLING",
    icon: "🛠️",
    description: "Monorepo ergonomics, build orchestration, and production observability.",
    items: [
      {
        name: "Turborepo",
        usedFor: "Monorepo build caching, package sharing (@workspace/ui, @workspace/backend), and parallel dev servers.",
      },
      {
        name: "Sentry",
        usedFor: "Distributed error tracing, LLM timeout alerts, and client runtime performance telemetry.",
      },
      {
        name: "pnpm",
        usedFor: "Fast, disk-efficient workspace dependency resolution with strict isolation.",
      },
    ],
  },
];

export const engineeringDecisionsCards = [
  {
    id: "card-1",
    num: "DECISION 01",
    tag: "MULTI-TENANCY & ISOLATION",
    problem: "How do we prevent tenant knowledge from leaking across organizations?",
    decision: "Organization-scoped vector namespaces + strict authorization boundaries.",
    explanation:
      "Instead of a shared vector index with soft metadata filtering, every RAG query explicitly scopes the vector search to namespace: orgId. In tandem, every private backend endpoint inspects the Clerk JWT claims to verify tenant ownership before any read or write executes.",
    impact: "Zero cross-tenant data leakage by design, verified at the schema and query boundary.",
  },
  {
    id: "card-2",
    num: "DECISION 02",
    tag: "EFFICIENCY & COST",
    problem: "How do we avoid reprocessing identical content and wasting embedding API calls?",
    decision: "SHA-256 content deduplication before vector computation.",
    explanation:
      "When a user uploads documentation (PDF, Markdown, HTML), Aivon computes a SHA-256 checksum of the normalized content. If an identical hash already exists for that organization, the system skips re-embedding and links the existing vector chunks.",
    impact: "Eliminates redundant vector computation costs and speeds up document ingestion by up to 85%.",
  },
  {
    id: "card-3",
    num: "DECISION 03",
    tag: "AGENTIC WORKFLOWS",
    problem: "How do we support customers who need human intervention without breaking the AI loop?",
    decision: "AI tools for explicit escalation and resolution workflows.",
    explanation:
      "Rather than treating human handoff as a separate system, the support agent is given explicit tools: searchKnowledge, escalateConversation, and resolveConversation. The LLM invokes escalateConversation when confidence is low or when customer sentiment demands human help.",
    impact: "Seamless transition from AI automation to human operator queue with complete transcript retention.",
  },
  {
    id: "card-4",
    num: "DECISION 04",
    tag: "CREDENTIAL SECURITY",
    problem: "How do we safely manage tenant-specific credentials in a multi-tenant SaaS?",
    decision: "AWS Secrets Manager with references stored in the application layer.",
    explanation:
      "Storing customer API keys (e.g. their own Vapi or OpenAI keys) as plaintext in the database is a massive security hazard. Aivon stores credentials in AWS Secrets Manager under tenant/{orgId}/{service}. The application database only holds the secret ARN reference.",
    impact: "Enterprise BYOK compliance. Compromise of the database yields zero third-party API credentials.",
  },
  {
    id: "card-5",
    num: "DECISION 05",
    tag: "INGESTION PIPELINE",
    problem: "How do we support diverse content formats without degrading retrieval quality?",
    decision: "Model-routed multimodal ingestion for PDFs, images, HTML, and text.",
    explanation:
      "Raw text extraction destroys tables and visual diagrams. Aivon utilizes structure-aware normalization: PDF extraction preserves section headers, image ingestion applies multimodal OCR/captioning, and HTML is stripped of layout noise while retaining semantic hierarchy.",
    impact: "High-fidelity knowledge grounding resulting in 94.6% Precision@5 on technical documentation.",
  },
  {
    id: "card-6",
    num: "DECISION 06",
    tag: "REAL-TIME ARCHITECTURE",
    problem: "How do we make the support experience real-time between customer and operator?",
    decision: "Convex real-time backend + event-driven conversation updates.",
    explanation:
      "Traditional request-response cycles and HTTP polling introduce lag and server load. Convex replaces polling with persistent WebSocket subscriptions. As soon as a message or escalation occurs, both customer widget and operator screen react instantly.",
    impact: "Sub-50ms multi-client state synchronization with zero polling infrastructure to manage.",
  },
];

export const proofMetrics = [
  {
    value: "94.6%",
    label: "Precision@5",
    sub: "RAG retrieval evaluated against a labeled evaluation set",
    type: "Measured Outcome",
  },
  {
    value: "40%",
    label: "Response Drafting Reduction",
    sub: "Reduction in operator response drafting time using AI context",
    type: "Validated Outcome",
  },
  {
    value: "Multi-Tenant",
    label: "Data Isolation",
    sub: "Organization-isolated vector namespaces & JWT boundaries",
    type: "Architectural Capability",
  },
  {
    value: "Multimodal",
    label: "Knowledge Ingestion",
    sub: "Structure-aware parsing for PDF, Images, HTML, Markdown, & Text",
    type: "Architectural Capability",
  },
  {
    value: "Multi-Model",
    label: "Provider Agnostic",
    sub: "Pluggable runtime: OpenAI, Anthropic Claude, and xAI Grok",
    type: "Architectural Capability",
  },
  {
    value: "Real-Time",
    label: "Omnichannel Sync",
    sub: "Sub-50ms chat updates + sub-300ms WebRTC voice streams",
    type: "Architectural Capability",
  },
];

export const engineerPillars = [
  {
    num: "01",
    title: "SYSTEM DESIGN",
    summary: "I think beyond individual features and design the systems around them.",
    detail: "Architecture is about boundaries, failure modes, data flows, and state machines. Aivon is designed as an interconnected ecosystem where every component has a single, well-defined responsibility.",
  },
  {
    num: "02",
    title: "AI ENGINEERING",
    summary: "I build RAG and tool-using AI workflows grounded in application-specific data.",
    detail: "Calling an LLM API is a 5-line script. True AI engineering requires building evaluation sets, multimodal ingestion pipelines, deduplication caches, and deterministic tool-calling workflows.",
  },
  {
    num: "03",
    title: "BACKEND ENGINEERING",
    summary: "I design real-time services, authorization boundaries, data flows, and integrations.",
    detail: "I leverage reactive databases, strict TypeScript schema validation, optimistic UI updates, and transactional mutations to deliver software that stays consistent under high concurrency.",
  },
  {
    num: "04",
    title: "SECURITY",
    summary: "I treat tenant isolation, credentials, authentication, and webhooks as architecture concerns.",
    detail: "Security isn't an afterthought. From AWS Secrets Manager BYOK credential vaults to Svix HMAC webhook verification and Clerk JWT tenancy checks, safety is baked into every data path.",
  },
  {
    num: "05",
    title: "PRODUCT THINKING",
    summary: "I build the operator, customer, and developer experiences around the AI—not just the model call.",
    detail: "Great AI is useless if support agents can't intervene or developers can't integrate it. Aivon provides a live operator dashboard, widget customizer, and a 1-line script embed.",
  },
  {
    num: "06",
    title: "PRODUCTION MINDSET",
    summary: "I care about observability, reliability, deployment, performance, and failure paths.",
    detail: "In production, external APIs fail and network calls time out. Aivon uses Sentry distributed tracing, structured error codes, and graceful fallback paths so systems never fail silently.",
  },
];

