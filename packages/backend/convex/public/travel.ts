import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { TravelWorkflowManager } from "../system/ai/travel/workflow";
import { travelProvider } from "../system/ai/travel/provider";
import { SUPPORTED_LOCATIONS } from "../system/ai/travel/normalizer";
import { TravelOption, TravelSlots, TravelWorkflowState } from "../system/ai/travel/types";

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
    return await ctx.db
      .query("travelSessions")
      .withIndex("by_session_token", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
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
    const token =
      args.sessionToken ||
      `ts_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Try finding existing session
    const existing = await ctx.db
      .query("travelSessions")
      .withIndex("by_session_token", (q) => q.eq("sessionToken", token))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActiveAt: now,
        updatedAt: now,
      });
      return existing;
    }

    // Create fresh travel session
    const newSessionId = await ctx.db.insert("travelSessions", {
      organizationId: args.organizationId,
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

    const availableOptions: TravelOption[] = session.searchResults
      ? JSON.parse(session.searchResults)
      : [];
    const selectedOption: TravelOption | undefined = session.selectedOption
      ? JSON.parse(session.selectedOption)
      : undefined;

    // Process turn through multi-turn workflow
    const turnResult = await TravelWorkflowManager.processTurn({
      spokenText: args.spokenText,
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
      lastSpokenTurn: args.spokenText,
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

    const selectedOption: TravelOption = JSON.parse(session.selectedOption);

    // 2. Check if already booked with this idempotency key
    const existingBooking = await ctx.db
      .query("travelBookings")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
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
      idempotencyKey: args.idempotencyKey,
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
      idempotencyKey: args.idempotencyKey,
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
