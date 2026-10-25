import { ConvexError } from "convex/values";

export const MAX_PROMPT_LENGTH = 4000;
export const MAX_OPERATOR_PROMPT_LENGTH = 8000;
export const MAX_SPOKEN_TURN_LENGTH = 2000;
export const MAX_PHONE_NUMBER_LENGTH = 20;
export const MAX_PASSENGERS = 6;
export const MAX_GREET_MESSAGE_LENGTH = 500;
export const MAX_SUGGESTION_LENGTH = 160;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
export const MAX_SKILL_COUNT = 20;
export const MAX_SKILL_LENGTH = 40;
export const MAX_TRANSCRIPT_MESSAGES = 200;
export const MAX_CALLBACK_SCHEDULE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_HUMAN_REVIEW_NOTES_LENGTH = 2000;
export const MAX_JOB_LIST_LIMIT = 50;
export const MAX_JOB_PAYLOAD_LENGTH = 32_000;
export const MAX_VOICE_DESCRIPTION_LENGTH = 500;
export const MAX_VAPI_IDENTIFIER_LENGTH = 128;
export const MAX_CONVERSATIONS_PER_SESSION = 25;
export const CONTACT_SESSION_CREATE_WINDOW_MS = 60_000;
export const CONTACT_SESSION_CREATE_MAX = 5;
export const PUBLIC_ENDPOINT_WINDOW_MS = 60_000;
export const PUBLIC_ENDPOINT_MAX_REQUESTS = 30;
export const TRAVEL_SESSION_CREATE_WINDOW_MS = 60_000;
export const TRAVEL_SESSION_CREATE_MAX = 20;
export const TRAVEL_TURN_WINDOW_MS = 60_000;
export const TRAVEL_TURN_MAX_REQUESTS = 20;
export const SESSION_MESSAGE_WINDOW_MS = 60_000;
export const SESSION_MESSAGE_MAX_REQUESTS = 30;
export const MAX_AI_SUMMARY_LENGTH = 2000;
export const MAX_TRANSCRIPT_SUMMARY_CHARS = 12_000;

const ALLOWED_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "canceled",
  "cancelled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

export function rejectBadRequest(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isSafeOrganizationId(organizationId: string): boolean {
  return (
    organizationId.length > 0 &&
    organizationId.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(organizationId)
  );
}

export function isE164PhoneNumber(phone: string): boolean {
  return (
    phone.length <= MAX_PHONE_NUMBER_LENGTH && /^\+[1-9]\d{7,14}$/.test(phone)
  );
}

/**
 * Privilege and restriction checks for the recruiter demo tenant.
 * Both grants (AI without a paid subscription, demo seeding) and write
 * restrictions (secrets/plugins) require an exact configured identifier.
 * Substring matching on "demo" is never used: it is both spoofable from
 * public widget APIs and can lock out legitimate organizations.
 */
export function isConfiguredDemoOrganization(organizationId: string): boolean {
  const configured = process.env.DEMO_ORGANIZATION_ID?.trim();
  return Boolean(
    configured &&
      isSafeOrganizationId(configured) &&
      organizationId === configured,
  );
}

export function isConfiguredDemoActor(identity: {
  orgId?: unknown;
  email?: string | null;
}): boolean {
  const orgId = typeof identity.orgId === "string" ? identity.orgId : "";
  if (isConfiguredDemoOrganization(orgId)) {
    return true;
  }

  const configuredEmail = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
  const email = identity.email?.trim().toLowerCase();
  return Boolean(configuredEmail && email && configuredEmail === email);
}

function configuredIdSet(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => isSafeOrganizationId(value)),
  );
}

export function isConfiguredEnterpriseOrganization(
  organizationId: string,
): boolean {
  return configuredIdSet(process.env.ENTERPRISE_ORGANIZATION_IDS).has(
    organizationId,
  );
}

export function isConfiguredTravelOrganization(
  organizationId: string,
): boolean {
  const travelId = process.env.TRAVEL_ORGANIZATION_ID?.trim();
  if (travelId && isSafeOrganizationId(travelId)) {
    return organizationId === travelId;
  }
  return isConfiguredDemoOrganization(organizationId);
}

export function resolveSubscriptionTier(
  organizationId: string,
  subscriptionStatus: string | undefined,
): "free" | "pro" | "enterprise" {
  if (subscriptionStatus !== "active") return "free";
  if (isConfiguredEnterpriseOrganization(organizationId)) return "enterprise";
  return "pro";
}

export function assertBoundedText(
  value: string,
  maxLength: number,
  label: string,
): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    rejectBadRequest(`${label} is invalid`);
  }
  return trimmed;
}

export function isBoundedIdempotencyKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= MAX_IDEMPOTENCY_KEY_LENGTH &&
    /^[A-Za-z0-9._:-]+$/.test(key)
  );
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

export function generateUnpredictableToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return `${prefix}_${hex}`;
}

export function isAllowedSubscriptionStatus(status: string): boolean {
  return ALLOWED_SUBSCRIPTION_STATUSES.has(status);
}

export function looksLikeConvexId(value: string): boolean {
  return /^[a-z0-9]{16,36}$/i.test(value);
}

export function countEventsInWindow(
  timestamps: number[],
  now: number,
  windowMs: number,
): number {
  return timestamps.filter((timestamp) => now - timestamp < windowMs).length;
}

export function assertHttpsUrl(rawUrl: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    rejectBadRequest(`${label} is not a valid URL.`);
  }
  if (parsed.protocol !== "https:") {
    rejectBadRequest(`${label} must use HTTPS.`);
  }
  return parsed;
}
