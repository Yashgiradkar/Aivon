import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { SESSION_DURATION_MS } from "../constants";
import {
  CONTACT_SESSION_CREATE_MAX,
  CONTACT_SESSION_CREATE_WINDOW_MS,
  countEventsInWindow,
  isSafeOrganizationId,
  isValidEmail,
} from "../lib/requestSecurity";

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    organizationId: v.string(),
    metadata: v.optional(
      v.object({
        userAgent: v.optional(v.string()),
        language: v.optional(v.string()),
        languages: v.optional(v.string()),
        platform: v.optional(v.string()),
        vendor: v.optional(v.string()),
        screenResolution: v.optional(v.string()),
        viewportSize: v.optional(v.string()),
        timezone: v.optional(v.string()),
        timezoneOffset: v.optional(v.number()),
        cookieEnabled: v.optional(v.boolean()),
        referrer: v.optional(v.string()),
        currentUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const organizationId = args.organizationId.trim();
    if (
      !name ||
      name.length > 120 ||
      !isValidEmail(email) ||
      !isSafeOrganizationId(organizationId)
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Invalid contact session details",
      });
    }

    if (!metadataIsBounded(args.metadata)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Contact metadata exceeds permitted limits",
      });
    }

    const now = Date.now();
    const recentSessions = await ctx.db
      .query("contactSessions")
      .withIndex("by_organization_id_and_email", (q) =>
        q.eq("organizationId", organizationId).eq("email", email),
      )
      .order("desc")
      .take(CONTACT_SESSION_CREATE_MAX);
    if (
      countEventsInWindow(
        recentSessions.map((session) => session._creationTime),
        now,
        CONTACT_SESSION_CREATE_WINDOW_MS,
      ) >= CONTACT_SESSION_CREATE_MAX
    ) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many session attempts. Please wait and try again.",
      });
    }

    const expiresAt = now + SESSION_DURATION_MS;

    const contactSessionId = await ctx.db.insert("contactSessions", {
      name,
      email,
      organizationId,
      expiresAt,
      metadata: args.metadata,
    });

    return contactSessionId;
  },
});

function metadataIsBounded(
  metadata: Record<string, unknown> | undefined,
): boolean {
  if (!metadata) return true;
  return Object.values(metadata).every(
    (value) => typeof value !== "string" || value.length <= 512,
  );
}

export const validate = mutation({
  args: {
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId);

    if (!contactSession) {
      return { valid: false, reason: "Contact session not found" };
    }

    if (contactSession.expiresAt < Date.now()) {
      return { valid: false, reason: "Contact session expired" };
    }

    return { valid: true };
  },
});
