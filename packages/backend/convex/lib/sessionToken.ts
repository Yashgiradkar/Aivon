/**
 * Cryptographically Secure Contact Session Token Engine
 *
 * Replaces raw database IDs with ephemeral, HMAC-SHA256 signed tokens
 * to protect against tampering, session fixation, and cross-tenant leakage
 * when session identifiers are stored in client localStorage.
 *
 * Token Format:
 * ast_v1.{base64url(JSON({ sessionId, orgId, exp }))}.{hmacSha256SignatureHex}
 */

import { timingSafeEqualString } from "./requestSecurity";

export interface SessionTokenPayload {
  sessionId: string;
  orgId: string;
  exp: number; // Expiration timestamp in ms
}

export interface VerifySessionTokenResult {
  valid: boolean;
  payload?: SessionTokenPayload;
  reason?: string;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(b64: string): string {
  let standard = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (standard.length % 4) {
    standard += "=";
  }
  const binary = atob(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function resolveSecret(customSecret?: string): string {
  return (
    customSecret ||
    process.env.SESSION_HMAC_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    "aivon-session-hmac-sha256-default-key-v1"
  );
}

/**
 * Creates an ephemeral, tamper-proof HMAC-SHA256 signed session token.
 */
export async function createSignedSessionToken(
  payload: SessionTokenPayload,
  customSecret?: string
): Promise<string> {
  if (!payload.sessionId || !payload.orgId || typeof payload.exp !== "number") {
    throw new Error("[SessionToken] Invalid payload claims for token generation.");
  }

  const secret = resolveSecret(customSecret);
  const rawData = `${payload.sessionId}.${payload.orgId}.${payload.exp}`;
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(rawData)
  );

  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const payloadB64 = toBase64Url(JSON.stringify(payload));
  return `ast_v1.${payloadB64}.${signatureHex}`;
}

/**
 * Cryptographically verifies an HMAC-SHA256 signed session token.
 * Validates format, signature integrity (constant-time), expiration, and organization scoping.
 */
export async function verifySignedSessionToken(
  token: string,
  expectedOrgId?: string,
  customSecret?: string
): Promise<VerifySessionTokenResult> {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Missing token" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "ast_v1") {
    return { valid: false, reason: "Malformed session token format" };
  }

  const [, payloadB64, signatureHex] = parts;
  if (!payloadB64 || !signatureHex) {
    return { valid: false, reason: "Incomplete token segments" };
  }

  let payload: SessionTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64));
  } catch {
    return { valid: false, reason: "Invalid token payload encoding" };
  }

  if (!payload.sessionId || !payload.orgId || typeof payload.exp !== "number") {
    return { valid: false, reason: "Missing required token claims" };
  }

  // 1. Check expiration
  if (Date.now() >= payload.exp) {
    return { valid: false, reason: "Session token has expired" };
  }

  // 2. Check tenant scoping
  if (expectedOrgId && payload.orgId !== expectedOrgId) {
    return { valid: false, reason: "Token organization mismatch" };
  }

  // 3. Cryptographic HMAC-SHA256 signature verification
  const secret = resolveSecret(customSecret);
  const rawData = `${payload.sessionId}.${payload.orgId}.${payload.exp}`;
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const expectedSigBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(rawData)
  );

  const expectedSigHex = Array.from(new Uint8Array(expectedSigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time string comparison to defend against timing attacks
  if (!timingSafeEqualString(signatureHex, expectedSigHex)) {
    return {
      valid: false,
      reason: "Cryptographic signature verification failed (tampered token)",
    };
  }

  return {
    valid: true,
    payload,
  };
}
