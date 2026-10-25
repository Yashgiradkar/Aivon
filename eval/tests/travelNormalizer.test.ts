import assert from "node:assert/strict";
import { TravelNormalizer, SUPPORTED_LOCATIONS } from "../../packages/backend/convex/system/ai/travel/normalizer";

export async function runTravelNormalizerTests(): Promise<void> {
  console.log("Running Travel Normalizer & Slot Extraction Tests...\n");

  // 1. Location Resolution & Aliases
  console.log("1. Testing Location Resolution & Station Code Mapping...");
  const nagpur = TravelNormalizer.resolveLocation("Nagpur");
  assert.ok(nagpur !== null);
  assert.equal(nagpur?.code, "NGP");
  assert.equal(nagpur?.name, "Nagpur");

  const bombay = TravelNormalizer.resolveLocation("bombay");
  assert.ok(bombay !== null);
  assert.equal(bombay?.code, "CSMT");
  assert.equal(bombay?.name, "Mumbai");

  const blr = TravelNormalizer.resolveLocation("BLR");
  assert.ok(blr !== null);
  assert.equal(blr?.code, "SBC");
  assert.equal(blr?.name, "Bengaluru");

  const unknownLoc = TravelNormalizer.resolveLocation("Atlantis City");
  assert.equal(unknownLoc, null);
  console.log("   ✓ Locations and aliases correctly resolve to standard station/airport codes");

  // 2. Relative Date Normalization
  console.log("2. Testing Relative Date Normalization & Timezone Reference...");
  const fakeNow = new Date("2026-10-25T12:00:00Z").getTime(); // Sunday, Oct 25, 2026

  const today = TravelNormalizer.normalizeDate("I want to travel today", fakeNow);
  assert.equal(today, "2026-10-25");

  const tomorrow = TravelNormalizer.normalizeDate("Book for tomorrow morning", fakeNow);
  assert.equal(tomorrow, "2026-10-26");

  const dayAfter = TravelNormalizer.normalizeDate("leaving day after tomorrow", fakeNow);
  assert.equal(dayAfter, "2026-10-27");

  const inFiveDays = TravelNormalizer.normalizeDate("in 5 days", fakeNow);
  assert.equal(inFiveDays, "2026-10-30");

  const nextFriday = TravelNormalizer.normalizeDate("next Friday", fakeNow);
  assert.ok(nextFriday !== null);
  assert.match(nextFriday, /^\d{4}-\d{2}-\d{2}$/);
  console.log("   ✓ Relative dates normalized deterministically against reference timestamp");

  // 3. Time Window Normalization
  console.log("3. Testing Spoken Time Window Parsing...");
  const between7and10 = TravelNormalizer.extractTimeWindow("Anything between 7 and 10 AM");
  assert.equal(between7and10.start, "07:00");
  assert.equal(between7and10.end, "10:00");

  const after7 = TravelNormalizer.extractTimeWindow("I can look for options after 7 AM");
  assert.equal(after7.start, "07:00");
  assert.equal(after7.end, "23:59");

  const morning = TravelNormalizer.extractTimeWindow("prefer morning departure");
  assert.equal(morning.start, "06:00");
  assert.equal(morning.end, "12:00");

  const evening = TravelNormalizer.extractTimeWindow("travel in the evening");
  assert.equal(evening.start, "17:00");
  assert.equal(evening.end, "22:00");
  console.log("   ✓ Spoken time ranges and named parts of day parsed accurately");

  // 4. Transport Mode Extraction
  console.log("4. Testing Transport Mode Detection...");
  assert.equal(TravelNormalizer.extractTransportMode("Preferably a train"), "train");
  assert.equal(TravelNormalizer.extractTransportMode("Is there a Vande Bharat available?"), "train");
  assert.equal(TravelNormalizer.extractTransportMode("Book an IndiGo flight to Delhi"), "flight");
  assert.equal(TravelNormalizer.extractTransportMode("Look for Volvo sleeper bus"), "bus");
  assert.equal(TravelNormalizer.extractTransportMode("I need to go somewhere"), undefined);
  console.log("   ✓ Transport modes and vehicle brands recognized cleanly");

  // 5. Option Selection Extraction
  console.log("5. Testing Spoken Option Selection...");
  assert.equal(TravelNormalizer.extractOptionSelection("Choose the second one", 3), 1);
  assert.equal(TravelNormalizer.extractOptionSelection("Pick option 1", 3), 0);
  assert.equal(TravelNormalizer.extractOptionSelection("Book the third option please", 3), 2);
  assert.equal(TravelNormalizer.extractOptionSelection("Let's go with the first one", 3), 0);
  assert.equal(TravelNormalizer.extractOptionSelection("Tell me more about the weather", 3), null);
  console.log("   ✓ Spoken ordinals and numbers map accurately to 0-indexed options");

  // 6. Confirmation Intent Detection
  console.log("6. Testing Confirmation & Cancellation Intent...");
  assert.equal(TravelNormalizer.detectConfirmationIntent("Yes confirm booking"), "confirm");
  assert.equal(TravelNormalizer.detectConfirmationIntent("Proceed with the reservation"), "confirm");
  assert.equal(TravelNormalizer.detectConfirmationIntent("Looks good, go ahead"), "confirm");
  assert.equal(TravelNormalizer.detectConfirmationIntent("No, don't book"), "cancel");
  assert.equal(TravelNormalizer.detectConfirmationIntent("Cancel this trip"), "cancel");
  assert.equal(TravelNormalizer.detectConfirmationIntent("What is the seat number?"), "unknown");
  console.log("   ✓ Confirmation intent safely distinguishes agreement from cancellation and inquiries");

  // 7. Speech Corrections & Complex Utterances
  console.log("7. Testing Mid-Sentence Speech Corrections...");
  const corrected = TravelNormalizer.extractOriginAndDestination(
    "I need to travel from Nagpur to Mumbai—sorry, Pune tomorrow",
    {}
  );
  assert.equal(corrected.destination, "Pune");

  const standard = TravelNormalizer.extractOriginAndDestination(
    "Travel from Nagpur to Mumbai tomorrow morning",
    {}
  );
  assert.equal(standard.origin, "Nagpur");
  assert.equal(standard.destination, "Mumbai");
  console.log("   ✓ Mid-sentence speech corrections resolved to the user's intended final destination");

  console.log("\n=======================================================");
  console.log("✅ All Travel Normalizer & Slot Tests Passed (100%)!");
  console.log("=======================================================\n");
}

runTravelNormalizerTests().catch((err) => {
  console.error("❌ Travel Normalizer Tests Failed:", err);
  process.exit(1);
});
