import assert from "node:assert/strict";
import { TravelWorkflowManager } from "../../packages/backend/convex/system/ai/travel/workflow";
import { travelProvider, DeterministicMockTravelProvider } from "../../packages/backend/convex/system/ai/travel/provider";
import { TravelSlots, TravelWorkflowState } from "../../packages/backend/convex/system/ai/travel/types";

export async function runTravelWorkflowTests(): Promise<void> {
  console.log("Running Multi-Turn Voice Travel Agent Workflow & Guardrail Tests...\n");
  const referenceMs = new Date("2026-10-25T10:00:00Z").getTime();

  // =========================================================================
  // Test 1: Complete 5-Turn Canonical Travel Conversation Journey
  // =========================================================================
  console.log("1. Simulating 5-Turn Canonical Voice Journey (Prompt Example)...");

  // Turn 1: User specifies journey from Nagpur to Mumbai tomorrow morning
  let state: TravelWorkflowState = "GREETING";
  let slots: TravelSlots = {};

  const turn1 = await TravelWorkflowManager.processTurn({
    spokenText: "I need to travel from Nagpur to Mumbai tomorrow morning.",
    currentState: state,
    currentSlots: slots,
    referenceMs,
  });

  assert.equal(turn1.nextState, "CLARIFYING");
  assert.equal(turn1.updatedSlots.origin, "Nagpur");
  assert.equal(turn1.updatedSlots.destination, "Mumbai");
  assert.equal(turn1.updatedSlots.travelDate, "2026-10-26");
  assert.ok(turn1.spokenResponse.includes("train, a flight, or a bus"));
  console.log("   ✓ Turn 1: Extracted Origin, Destination & Date; Clarified Transport Mode");

  // Turn 2: User specifies preferred mode: train
  // NOTE: "tomorrow morning" in turn 1 already set the departure window (06:00-12:00).
  // With origin, destination, date, mode, and window all known, the workflow proceeds
  // directly to search and presents options (AWAITING_SELECTION).
  state = turn1.nextState;
  slots = turn1.updatedSlots;

  const turn2 = await TravelWorkflowManager.processTurn({
    spokenText: "Preferably a train.",
    currentState: state,
    currentSlots: slots,
    referenceMs,
  });

  assert.equal(turn2.nextState, "AWAITING_SELECTION");
  assert.equal(turn2.updatedSlots.transportMode, "train");
  assert.ok(turn2.options && turn2.options.length > 0);
  console.log(`   ✓ Turn 2: Extracted Transport Mode; All Slots Complete → Presented ${turn2.options?.length} Options`);

  // Turn 3: User refines departure window; from AWAITING_SELECTION the workflow re-searches
  state = turn2.nextState;
  slots = turn2.updatedSlots;
  const initialOptions = turn2.options || [];

  const turn3 = await TravelWorkflowManager.processTurn({
    spokenText: "Anything between 7 and 10.",
    currentState: state,
    currentSlots: slots,
    availableOptions: initialOptions,
    referenceMs,
  });

  assert.equal(turn3.nextState, "AWAITING_SELECTION");
  assert.equal(turn3.updatedSlots.departureWindowStart, "07:00");
  assert.equal(turn3.updatedSlots.departureWindowEnd, "10:00");
  assert.ok(turn3.options && turn3.options.length > 0);
  assert.ok(turn3.spokenResponse.includes("Vande Bharat Express") || turn3.spokenResponse.includes("options") || turn3.spokenResponse.includes("updated"));
  console.log(`   ✓ Turn 3: Refined Time Window; Re-searched → Presented ${turn3.options?.length} Services`);

  // Turn 4: User selects option ("Choose the first one")
  state = turn3.nextState;
  slots = turn3.updatedSlots;
  const presentedOptions = turn3.options || [];

  const turn4 = await TravelWorkflowManager.processTurn({
    spokenText: "Choose the first one.",
    currentState: state,
    currentSlots: slots,
    availableOptions: presentedOptions,
    referenceMs,
  });

  assert.equal(turn4.nextState, "AWAITING_CONFIRMATION");
  assert.ok(turn4.selectedOption !== undefined);
  assert.equal(turn4.confirmationRequired, true);
  assert.ok(turn4.spokenResponse.includes("confirm and proceed"));
  console.log("   ✓ Turn 4: Resolved Spoken Ordinal; Presented Summary with Explicit Confirmation Gate");

  // Turn 5: User confirms booking
  state = turn4.nextState;
  slots = turn4.updatedSlots;
  const chosenOption = turn4.selectedOption;

  const turn5 = await TravelWorkflowManager.processTurn({
    spokenText: "Yes confirm booking.",
    currentState: state,
    currentSlots: slots,
    availableOptions: presentedOptions,
    selectedOption: chosenOption,
    referenceMs,
  });

  assert.equal(turn5.nextState, "BOOKED");
  assert.ok(turn5.bookingResult !== undefined);
  assert.equal(turn5.bookingResult?.status, "confirmed");
  assert.ok(turn5.bookingResult?.bookingReference.startsWith("PNR-NGP-"));
  assert.ok(turn5.spokenResponse.includes("Your booking is confirmed"));
  console.log(`   ✓ Turn 5: Consequential Action Executed Safely! PNR: ${turn5.bookingResult?.bookingReference}`);

  // =========================================================================
  // Test 2: Consequential Action Guardrails (Unconfirmed Booking Abort)
  // =========================================================================
  console.log("\n2. Testing Consequential Action Protection...");
  const unconfirmedBooking = await travelProvider.initiateBooking({
    organizationId: "org_test",
    travelSessionId: "session_fake" as any,
    optionId: "opt_train_20912_0",
    passengers: [{ name: "Test Passenger", age: 25, gender: "Male" }],
    idempotencyKey: "test_unconfirmed_key",
    confirmedByCustomer: false, // Strict negative
  });

  assert.equal(unconfirmedBooking.success, false);
  assert.equal(unconfirmedBooking.status, "failed");
  assert.ok(unconfirmedBooking.error?.includes("Explicit customer confirmation is strictly required"));
  console.log("   ✓ Provider strictly rejected booking without explicit customer confirmation");

  // =========================================================================
  // Test 3: Idempotency Protection (Duplicate Prevention)
  // =========================================================================
  console.log("\n3. Testing Booking Idempotency Protection...");
  const key = "idemp_test_safe_441";
  const firstCall = await travelProvider.initiateBooking({
    organizationId: "org_test",
    travelSessionId: "session_fake" as any,
    optionId: "opt_train_20912_0",
    passengers: [{ name: "Alex Kumar", age: 32, gender: "Male" }],
    idempotencyKey: key,
    confirmedByCustomer: true,
  });
  assert.equal(firstCall.success, true);

  const duplicateCall = await travelProvider.initiateBooking({
    organizationId: "org_test",
    travelSessionId: "session_fake" as any,
    optionId: "opt_train_20912_0",
    passengers: [{ name: "Alex Kumar", age: 32, gender: "Male" }],
    idempotencyKey: key, // Replay
    confirmedByCustomer: true,
  });
  assert.equal(duplicateCall.success, true);
  assert.equal(duplicateCall.bookingReference, firstCall.bookingReference);
  console.log("   ✓ Repeated execution with identical idempotency token returns existing confirmed booking");

  // =========================================================================
  // Test 4: Cancellation & Abandonment Workflow
  // =========================================================================
  console.log("\n4. Testing Cancellation & Abandonment During Confirmation...");
  const cancelTurn = await TravelWorkflowManager.processTurn({
    spokenText: "No, cancel this",
    currentState: "AWAITING_CONFIRMATION",
    currentSlots: slots,
    availableOptions: presentedOptions,
    selectedOption: chosenOption,
    referenceMs,
  });

  assert.equal(cancelTurn.nextState, "AWAITING_SELECTION");
  assert.ok(cancelTurn.spokenResponse.includes("cancelled"));
  assert.equal(cancelTurn.bookingResult, undefined); // No booking occurred
  console.log("   ✓ User cancellation safely reverted state to selection without creating reservations");

  // Reset conversation test
  const resetTurn = await TravelWorkflowManager.processTurn({
    spokenText: "Start over from scratch",
    currentState: "AWAITING_SELECTION",
    currentSlots: slots,
    referenceMs,
  });
  assert.equal(resetTurn.nextState, "COLLECTING_REQUIREMENTS");
  assert.equal(Object.keys(resetTurn.updatedSlots).length, 0);
  console.log("   ✓ 'Start over' reset slots and workflow cleanly");

  console.log("\n=======================================================");
  console.log("✅ All Voice Travel Workflow & Guardrail Tests PASSED (100%)!");
  console.log("=======================================================\n");
}

runTravelWorkflowTests().catch((err) => {
  console.error("❌ Travel Workflow Tests Failed:", err);
  process.exit(1);
});
