import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { TravelWorkflowManager } from "../system/ai/travel/workflow";
import { travelProvider } from "../system/ai/travel/provider";
import { SUPPORTED_LOCATIONS } from "../system/ai/travel/normalizer";
import { TravelOption, TravelSlots, TravelWorkflowState } from "../system/ai/travel/types";
import {
  countEventsInWindow,
  generateUnpredictableToken,
  isBoundedIdempotencyKey,
  isConfiguredTravelOrganization,
  MAX_PASSENGERS,
  MAX_SPOKEN_TURN_LENGTH,
  TRAVEL_SESSION_CREATE_MAX,
  TRAVEL_SESSION_CREATE_WINDOW_MS,
  TRAVEL_TURN_MAX_REQUESTS,
  TRAVEL_TURN_WINDOW_MS,
} from "../lib/requestSecurity";
import { sanitizeUserInput } from "../system/ai/security";

const TRAVEL_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const getAvailableLocations = query({
  args: {},
  handler: async () => {
    return Object.values(SUPPORTED_LOCATIONS).map((loc) => ({
      name: loc.name,
      code: loc.code,
      state: loc.state,
    }));
  },
});

export const getSession = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("travelSessions")
      .withIndex("by_session_token", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    if (!session) return null;
    if (Date.now() - session.lastActiveAt > TRAVEL_SESSION_TTL_MS) {
      return null;
    }
    return session;
  },
});

export const createOrGetSession = mutation({
  args: {
    organizationId: v.string(),
    sessionToken: v.optional(v.string()),
    contactSessionId: v.optional(v.id("contactSessions")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const organizationId = args.organizationId.trim();
    if (!isConfiguredTravelOrganization(organizationId)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Invalid organization",
      });
    }

    if (args.sessionToken) {
      const existing = await ctx.db
        .query("travelSessions")
        .withIndex("by_session_token", (q) =>
          q.eq("sessionToken", args.sessionToken!),
        )
        .first();

      if (existing) {
        if (existing.organizationId !== organizationId) {
          throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Incorrect travel session",
          });
        }
        if (now - existing.lastActiveAt > TRAVEL_SESSION_TTL_MS) {
          throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Travel session expired",
          });
        }
        await ctx.db.patch(existing._id, {
          lastActiveAt: now,
          updatedAt: now,
        });
        return existing;
      }
    }

    const recentSessions = await ctx.db
      .query("travelSessions")
      .withIndex("by_organization_id", (q) =>
        q.eq("organizationId", organizationId),
      )
      .order("desc")
      .take(TRAVEL_SESSION_CREATE_MAX);
    if (
      countEventsInWindow(
        recentSessions.map((session) => session.createdAt),
        now,
        TRAVEL_SESSION_CREATE_WINDOW_MS,
      ) >= TRAVEL_SESSION_CREATE_MAX
    ) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many travel sessions. Please wait and try again.",
      });
    }

    const token = generateUnpredictableToken("ts");
    const newSessionId = await ctx.db.insert("travelSessions", {
      organizationId,
      sessionToken: token,
      contactSessionId: args.contactSessionId,
      status: "GREETING",
      extractedSlots: {},
      confirmationRequired: false,
      idempotencyToken: `idemp_${token}_${now}`,
      lastActiveAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(newSessionId);
  },
});

export const processSpokenTurn = mutation({
  args: {
    sessionToken: v.string(),
    spokenText: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = await ctx.db
      .query("travelSessions")
      .withIndex("by_session_token", (q) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Travel session not found or has expired.",
      });
    }

    if (now - session.lastActiveAt > TRAVEL_SESSION_TTL_MS) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Travel session expired",
      });
    }

    const turnLimit = await ctx.runMutation(
      internal.system.rateLimits.checkKeyedWindow,
      {
        key: `travel_turn:${session._id}`,
        maxRequests: TRAVEL_TURN_MAX_REQUESTS,
        windowMs: TRAVEL_TURN_WINDOW_MS,
      },
    );
    if (!turnLimit.allowed) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many travel requests. Please wait and try again.",
      });
    }

    const spoken = sanitizeUserInput(args.spokenText, MAX_SPOKEN_TURN_LENGTH);
    if (!spoken.sanitizedText) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Spoken text is required",
      });
    }

    const availableOptions: TravelOption[] = parseJsonField(
      session.searchResults,
      [],
    );
    const selectedOption: TravelOption | undefined = parseJsonField(
      session.selectedOption,
      undefined,
    );

    // Process turn through multi-turn workflow
    const turnResult = await TravelWorkflowManager.processTurn({
      spokenText: spoken.sanitizedText,
      currentState: session.status as TravelWorkflowState,
      currentSlots: session.extractedSlots as TravelSlots,
      availableOptions,
      selectedOption,
      referenceMs: now,
    });

    // Update persisted workflow state in Convex
    await ctx.db.patch(session._id, {
      status: turnResult.nextState,
      extractedSlots: turnResult.updatedSlots,
      searchResults: turnResult.options ? JSON.stringify(turnResult.options) : session.searchResults,
      selectedOption: turnResult.selectedOption ? JSON.stringify(turnResult.selectedOption) : session.selectedOption,
      confirmationRequired: turnResult.confirmationRequired,
      lastSpokenTurn: spoken.sanitizedText,
      lastActiveAt: now,
      updatedAt: now,
    });

    return {
      spokenResponse: turnResult.spokenResponse,
      nextState: turnResult.nextState,
      slots: turnResult.updatedSlots,
      options: turnResult.options || availableOptions,
      selectedOption: turnResult.selectedOption || selectedOption,
      confirmationRequired: turnResult.confirmationRequired,
      bookingResult: turnResult.bookingResult,
      suggestedQuickReplies: turnResult.suggestedQuickReplies,
    };
  },
});

export const confirmBooking = mutation({
  args: {
    sessionToken: v.string(),
    confirmedByCustomer: v.boolean(),
    passengers: v.array(
      v.object({
        name: v.string(),
        age: v.number(),
        gender: v.string(),
      })
    ),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Consequential Safeguard: explicit customer confirmation check
    if (!args.confirmedByCustomer) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Explicit customer confirmation is required to execute booking.",
      });
    }

    const session = await ctx.db
      .query("travelSessions")
      .withIndex("by_session_token", (q) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (!session) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Travel session not found.",
      });
    }

    if (!session.selectedOption) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No travel option has been selected for booking.",
      });
    }

    if (now - session.lastActiveAt > TRAVEL_SESSION_TTL_MS) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Travel session expired",
      });
    }

    const bookingLimit = await ctx.runMutation(
      internal.system.rateLimits.checkKeyedWindow,
      {
        key: `travel_booking:${session._id}`,
        maxRequests: 5,
        windowMs: TRAVEL_TURN_WINDOW_MS,
      },
    );
    if (!bookingLimit.allowed) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many booking attempts. Please wait and try again.",
      });
    }

    if (!isBoundedIdempotencyKey(args.idempotencyKey)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Idempotency key is invalid",
      });
    }

    if (
      args.passengers.length === 0 ||
      args.passengers.length > MAX_PASSENGERS ||
      args.passengers.some(
        (passenger) =>
          !passenger.name.trim() ||
          passenger.name.trim().length > 80 ||
          passenger.age < 0 ||
          passenger.age > 120 ||
          passenger.gender.trim().length > 32,
      )
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Passenger details are invalid",
      });
    }

    const selectedOption = parseJsonField<TravelOption | undefined>(
      session.selectedOption,
      undefined,
    );
    if (!selectedOption) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No travel option has been selected for booking.",
      });
    }

    const tenantIdempotencyKey = `${session.organizationId}:${args.idempotencyKey}`;

    // 2. Check if already booked with this idempotency key for this tenant
    const existingBooking = await ctx.db
      .query("travelBookings")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", tenantIdempotencyKey))
      .first();

    if (existingBooking) {
      return {
        success: true,
        bookingReference: existingBooking.bookingReference,
        status: existingBooking.status,
        option: selectedOption,
        passengers: existingBooking.passengers,
        totalFare: existingBooking.fare,
        confirmedAt: existingBooking.createdAt,
      };
    }

    // 3. Execute booking via travel provider
    const bookingResult = await travelProvider.initiateBooking({
      organizationId: session.organizationId,
      travelSessionId: session._id,
      optionId: selectedOption.id,
      passengers: args.passengers,
      idempotencyKey: tenantIdempotencyKey,
      confirmedByCustomer: true,
    });

    if (!bookingResult.success) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: bookingResult.error || "Booking failed with travel provider.",
      });
    }

    // 4. Persist booking record
    await ctx.db.insert("travelBookings", {
      organizationId: session.organizationId,
      travelSessionId: session._id,
      bookingReference: bookingResult.bookingReference,
      transportMode: selectedOption.transportMode,
      origin: selectedOption.origin,
      originCode: selectedOption.originCode,
      destination: selectedOption.destination,
      destinationCode: selectedOption.destinationCode,
      travelDate: session.extractedSlots.travelDate || new Date().toISOString().split("T")[0]!,
      departureTime: selectedOption.departureTime,
      arrivalTime: selectedOption.arrivalTime,
      serviceName: selectedOption.serviceName,
      serviceNumber: selectedOption.serviceNumber,
      fare: bookingResult.totalFare,
      currency: selectedOption.currency,
      passengers: bookingResult.passengers.map((p) => ({
        name: p.name,
        age: p.age || 30,
        gender: p.gender || "Adult",
        seatNumber: p.seatNumber,
        status: "CONFIRMED",
      })),
      status: "confirmed",
      idempotencyKey: tenantIdempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Transition session to BOOKED
    await ctx.db.patch(session._id, {
      status: "BOOKED",
      bookingReference: bookingResult.bookingReference,
      confirmedAt: now,
      confirmationRequired: false,
      lastActiveAt: now,
      updatedAt: now,
    });

    return bookingResult;
  },
});

export const cancelSession = mutation({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("travelSessions")
      .withIndex("by_session_token", (q) => q.eq("sessionToken", args.sessionToken))
      .first();

    if (session) {
      await ctx.db.patch(session._id, {
        status: "CANCELLED",
        confirmationRequired: false,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

function parseJsonField<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
