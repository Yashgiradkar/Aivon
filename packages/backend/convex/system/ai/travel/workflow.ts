import { TravelNormalizer } from "./normalizer";
import { travelProvider } from "./provider";
import {
  Passenger,
  TravelOption,
  TravelSlots,
  TravelTurnResult,
  TravelWorkflowState,
} from "./types";

export class TravelWorkflowManager {
  /**
   * Main multi-turn conversation turn processor.
   * Transforms spoken input into structured state transitions, tool invocations, and spoken output.
   */
  public static async processTurn(params: {
    spokenText: string;
    currentState: TravelWorkflowState;
    currentSlots: TravelSlots;
    availableOptions?: TravelOption[];
    selectedOption?: TravelOption;
    referenceMs?: number;
  }): Promise<TravelTurnResult> {
    const text = params.spokenText.trim();
    const referenceMs = params.referenceMs || Date.now();

    // 0. Cancellation / Reset Check
    if (/\b(cancel booking|start over|reset conversation|new search|clear)\b/i.test(text)) {
      return {
        spokenResponse: "I have reset your journey details. Where would you like to travel?",
        nextState: "COLLECTING_REQUIREMENTS",
        updatedSlots: {},
        options: [],
        confirmationRequired: false,
        suggestedQuickReplies: ["Nagpur to Mumbai tomorrow", "Delhi to Mumbai flights", "Mumbai to Pune train"],
      };
    }

    // 1. Merge spoken slots
    const slots = TravelNormalizer.extractAndMergeSlots(text, params.currentSlots, referenceMs);

    // 2. Handle state transitions
    switch (params.currentState) {
      case "GREETING":
      case "COLLECTING_REQUIREMENTS":
      case "CLARIFYING": {
        // Check for missing mandatory travel requirements
        if (!slots.origin || !slots.destination) {
          return {
            spokenResponse: "Certainly! Where are you travelling from, and what is your destination?",
            nextState: "COLLECTING_REQUIREMENTS",
            updatedSlots: slots,
            confirmationRequired: false,
            suggestedQuickReplies: ["From Nagpur to Mumbai", "From Delhi to Mumbai", "From Mumbai to Pune"],
          };
        }

        if (!slots.travelDate) {
          return {
            spokenResponse: `Got it, travel from ${slots.origin} to ${slots.destination}. When would you like to travel? For example, tomorrow morning or next Friday?`,
            nextState: "COLLECTING_REQUIREMENTS",
            updatedSlots: slots,
            confirmationRequired: false,
            suggestedQuickReplies: ["Tomorrow morning", "Today evening", "Next Monday"],
          };
        }

        if (!slots.transportMode) {
          return {
            spokenResponse: `Certainly. For your trip from ${slots.origin} to ${slots.destination} on ${slots.travelDate}, are you looking for a train, a flight, or a bus?`,
            nextState: "CLARIFYING",
            updatedSlots: slots,
            confirmationRequired: false,
            suggestedQuickReplies: ["Preferably a train", "Search for flights", "Check buses"],
          };
        }

        if (!slots.departureWindowStart && !slots.departureWindowEnd && !text.includes("any time")) {
          return {
            spokenResponse: "What time would you like to depart? I can search for options in the morning, afternoon, or evening.",
            nextState: "CLARIFYING",
            updatedSlots: slots,
            confirmationRequired: false,
            suggestedQuickReplies: ["Between 7 and 10 AM", "Morning after 7 AM", "Any time"],
          };
        }

        // All requirements satisfied -> Search options
        const searchResults = await travelProvider.search({
          origin: slots.origin,
          destination: slots.destination,
          travelDate: slots.travelDate,
          transportMode: slots.transportMode,
          departureWindowStart: slots.departureWindowStart,
          departureWindowEnd: slots.departureWindowEnd,
          passengerCount: slots.passengerCount || 1,
        });

        if (searchResults.length === 0) {
          return {
            spokenResponse: `I could not find any ${slots.transportMode} services from ${slots.origin} to ${slots.destination} matching your timing. Would you like to check flights or another departure time?`,
            nextState: "CLARIFYING",
            updatedSlots: slots,
            options: [],
            confirmationRequired: false,
            suggestedQuickReplies: ["Show all trains", "Check flights instead", "Change departure time"],
          };
        }

        // Format spoken summary of options
        const topOption = searchResults[0]!;
        const secondOption = searchResults[1];
        let spoken = `I found ${searchResults.length} ${slots.transportMode} options. The top choice is the ${topOption.departureTime} ${topOption.serviceName} arriving at ${topOption.arrivalTime} for ₹${topOption.fare}.`;
        if (secondOption) {
          spoken += ` We also have the ${secondOption.departureTime} ${secondOption.serviceName} for ₹${secondOption.fare}.`;
        }
        spoken += " Which one would you prefer to book?";

        return {
          spokenResponse: spoken,
          nextState: "AWAITING_SELECTION",
          updatedSlots: slots,
          options: searchResults,
          confirmationRequired: false,
          suggestedQuickReplies: ["Choose the first one", "Choose the second one", "Check flight options"],
        };
      }

      case "SEARCHING":
      case "PRESENTING_OPTIONS":
      case "AWAITING_SELECTION": {
        const available = params.availableOptions || [];

        // Check if user is selecting an option
        const selectedIndex = TravelNormalizer.extractOptionSelection(text, available.length);

        if (selectedIndex !== null && available[selectedIndex]) {
          const chosen = available[selectedIndex]!;
          slots.selectedOptionId = chosen.id;

          const defaultPassengers: Passenger[] = [
            {
              name: "Primary Passenger",
              age: 30,
              gender: "Not specified",
            },
          ];
          slots.passengers = defaultPassengers;

          const spoken = `You selected the ${chosen.departureTime} ${chosen.serviceName} from ${chosen.origin} to ${chosen.destination}. Total fare is ₹${chosen.fare} for ${slots.passengerCount || 1} passenger. Would you like me to confirm and proceed with this booking?`;

          return {
            spokenResponse: spoken,
            nextState: "AWAITING_CONFIRMATION",
            updatedSlots: slots,
            options: available,
            selectedOption: chosen,
            confirmationRequired: true,
            suggestedQuickReplies: ["Yes, confirm booking", "No, choose another option", "Cancel"],
          };
        }

        // If user provided a different filter or mode
        if (TravelNormalizer.extractTransportMode(text) || TravelNormalizer.extractTimeWindow(text).start) {
          const reSearchResults = await travelProvider.search({
            origin: slots.origin || "Nagpur",
            destination: slots.destination || "Mumbai",
            travelDate: slots.travelDate || new Date(referenceMs + 86400000).toISOString().split("T")[0]!,
            transportMode: slots.transportMode,
            departureWindowStart: slots.departureWindowStart,
            departureWindowEnd: slots.departureWindowEnd,
            passengerCount: slots.passengerCount || 1,
          });

          return {
            spokenResponse: `I updated your search. I found ${reSearchResults.length} available services. Which one would you like to select?`,
            nextState: "AWAITING_SELECTION",
            updatedSlots: slots,
            options: reSearchResults,
            confirmationRequired: false,
            suggestedQuickReplies: ["Choose the first one", "Choose the second one"],
          };
        }

        return {
          spokenResponse: "Please specify which option you would like to select, for example 'the first one' or 'the 8:15 service'.",
          nextState: "AWAITING_SELECTION",
          updatedSlots: slots,
          options: available,
          confirmationRequired: false,
          suggestedQuickReplies: ["Choose the first one", "Choose the second one"],
        };
      }

      case "AWAITING_CONFIRMATION": {
        const decision = TravelNormalizer.detectConfirmationIntent(text);

        if (decision === "confirm") {
          const chosen = params.selectedOption;
          if (!chosen) {
            return {
              spokenResponse: "I could not find the selected option. Please choose a travel option to proceed.",
              nextState: "AWAITING_SELECTION",
              updatedSlots: slots,
              confirmationRequired: false,
            };
          }

          // Consequential Action is executed through the authorized travel provider
          const bookingResult = await travelProvider.initiateBooking({
            organizationId: "org_travel",
            travelSessionId: "session_mock" as any,
            optionId: chosen.id,
            passengers: slots.passengers || [{ name: "Primary Passenger", age: 30, gender: "Adult" }],
            idempotencyKey: `book_${chosen.id}_${slots.travelDate}_${referenceMs}`,
            confirmedByCustomer: true,
          });

          if (bookingResult.success) {
            return {
              spokenResponse: `Your booking is confirmed! Your reference is ${bookingResult.bookingReference} on the ${chosen.serviceName} departing at ${chosen.departureTime} on ${slots.travelDate}. Have a wonderful journey!`,
              nextState: "BOOKED",
              updatedSlots: slots,
              selectedOption: chosen,
              confirmationRequired: false,
              bookingResult,
              suggestedQuickReplies: ["Start a new trip", "View booking details"],
            };
          } else {
            return {
              spokenResponse: `Booking could not be completed: ${bookingResult.error || "Provider error"}. Would you like to try another option?`,
              nextState: "AWAITING_SELECTION",
              updatedSlots: slots,
              confirmationRequired: false,
            };
          }
        }

        if (decision === "cancel") {
          return {
            spokenResponse: "Booking cancelled as requested. You can choose another option or modify your search anytime.",
            nextState: "AWAITING_SELECTION",
            updatedSlots: slots,
            options: params.availableOptions,
            confirmationRequired: false,
            suggestedQuickReplies: ["Choose another option", "New search"],
          };
        }

        return {
          spokenResponse: "Please confirm whether you would like to proceed with this booking by saying 'yes confirm' or 'cancel'.",
          nextState: "AWAITING_CONFIRMATION",
          updatedSlots: slots,
          selectedOption: params.selectedOption,
          confirmationRequired: true,
          suggestedQuickReplies: ["Yes, confirm booking", "No, cancel"],
        };
      }

      case "BOOKED": {
        return {
          spokenResponse: "Your trip is already booked and confirmed! Would you like to plan another journey?",
          nextState: "COLLECTING_REQUIREMENTS",
          updatedSlots: {},
          options: [],
          confirmationRequired: false,
          suggestedQuickReplies: ["Book another trip", "Done"],
        };
      }

      default: {
        return {
          spokenResponse: "Hello! I am your AI travel agent. Where would you like to travel today?",
          nextState: "COLLECTING_REQUIREMENTS",
          updatedSlots: {},
          options: [],
          confirmationRequired: false,
          suggestedQuickReplies: ["Nagpur to Mumbai tomorrow", "Delhi to Mumbai flights"],
        };
      }
    }
  }
}
