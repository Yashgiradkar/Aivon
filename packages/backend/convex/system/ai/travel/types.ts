import { Id } from "../../../_generated/dataModel";

export type TransportMode = "train" | "flight" | "bus";

export type TravelWorkflowState =
  | "GREETING"
  | "COLLECTING_REQUIREMENTS"
  | "CLARIFYING"
  | "SEARCHING"
  | "PRESENTING_OPTIONS"
  | "AWAITING_SELECTION"
  | "COLLECTING_PASSENGER_DETAILS"
  | "AWAITING_CONFIRMATION"
  | "EXECUTING_BOOKING"
  | "BOOKED"
  | "CANCELLED"
  | "FAILED";

export interface Passenger {
  name: string;
  age?: number;
  gender?: string;
  seatNumber?: string;
  status?: string;
}

export interface TravelSlots {
  transportMode?: TransportMode;
  origin?: string;
  originCode?: string;
  destination?: string;
  destinationCode?: string;
  travelDate?: string; // YYYY-MM-DD
  departureWindowStart?: string; // HH:MM
  departureWindowEnd?: string; // HH:MM
  passengerCount?: number;
  passengers?: Passenger[];
  selectedOptionId?: string;
  preference?: string;
}

export interface TravelOption {
  id: string;
  transportMode: TransportMode;
  providerName: string;
  serviceNumber: string;
  serviceName: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  departureTime: string; // HH:MM
  arrivalTime: string; // HH:MM
  duration: string;
  fare: number;
  currency: string;
  availableSeats: number;
  seatClass: string;
  stops: number;
  isRecommended?: boolean;
}

export interface TravelSearchParams {
  origin: string;
  destination: string;
  travelDate: string;
  transportMode?: TransportMode;
  departureWindowStart?: string;
  departureWindowEnd?: string;
  passengerCount?: number;
}

export interface BookingResult {
  success: boolean;
  bookingReference: string;
  status: "confirmed" | "pending" | "cancelled" | "failed";
  option: TravelOption;
  passengers: Passenger[];
  totalFare: number;
  confirmedAt: number;
  error?: string;
}

export interface TravelProviderInterface {
  search(params: TravelSearchParams): Promise<TravelOption[]>;
  getOptionDetails(optionId: string): Promise<TravelOption | null>;
  calculateFare(optionId: string, passengerCount: number): Promise<{ baseFare: number; taxes: number; totalFare: number }>;
  initiateBooking(params: {
    organizationId: string;
    travelSessionId: Id<"travelSessions">;
    optionId: string;
    passengers: Passenger[];
    idempotencyKey: string;
    confirmedByCustomer: boolean;
  }): Promise<BookingResult>;
}

export interface TravelTurnResult {
  spokenResponse: string;
  nextState: TravelWorkflowState;
  updatedSlots: TravelSlots;
  options?: TravelOption[];
  selectedOption?: TravelOption;
  confirmationRequired: boolean;
  bookingResult?: BookingResult;
  suggestedQuickReplies?: string[];
}
