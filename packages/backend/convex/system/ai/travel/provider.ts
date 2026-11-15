import { Id } from "../../../_generated/dataModel";
import {
  BookingResult,
  Passenger,
  TravelOption,
  TravelProviderInterface,
  TravelSearchParams,
} from "./types";

export class DeterministicMockTravelProvider implements TravelProviderInterface {
  private static cachedBookings = new Map<string, BookingResult>();

  // Realistic mock schedule repository
  private static MOCK_SCHEDULES: Omit<TravelOption, "id">[] = [
    // Nagpur to Mumbai (Trains)
    {
      transportMode: "train",
      providerName: "Indian Railways",
      serviceNumber: "20912",
      serviceName: "Vande Bharat Express",
      origin: "Nagpur",
      originCode: "NGP",
      destination: "Mumbai",
      destinationCode: "CSMT",
      departureTime: "08:15",
      arrivalTime: "14:30",
      duration: "6h 15m",
      fare: 1540,
      currency: "INR",
      availableSeats: 42,
      seatClass: "CC (Chair Car)",
      stops: 3,
      isRecommended: true,
    },
    {
      transportMode: "train",
      providerName: "Indian Railways",
      serviceNumber: "12290",
      serviceName: "Duronto Express",
      origin: "Nagpur",
      originCode: "NGP",
      destination: "Mumbai",
      destinationCode: "CSMT",
      departureTime: "20:40",
      arrivalTime: "06:15",
      duration: "9h 35m",
      fare: 1890,
      currency: "INR",
      availableSeats: 18,
      seatClass: "3A (AC 3 Tier)",
      stops: 1,
    },
    {
      transportMode: "train",
      providerName: "Indian Railways",
      serviceNumber: "12106",
      serviceName: "Vidarbha Superfast Express",
      origin: "Nagpur",
      originCode: "NGP",
      destination: "Mumbai",
      destinationCode: "CSMT",
      departureTime: "17:00",
      arrivalTime: "07:00",
      duration: "14h 00m",
      fare: 1210,
      currency: "INR",
      availableSeats: 55,
      seatClass: "3A",
      stops: 12,
    },

    // Nagpur to Mumbai (Flights)
    {
      transportMode: "flight",
      providerName: "IndiGo",
      serviceNumber: "6E-412",
      serviceName: "Airbus A320neo",
      origin: "Nagpur",
      originCode: "NGP",
      destination: "Mumbai",
      destinationCode: "BOM",
      departureTime: "09:20",
      arrivalTime: "10:55",
      duration: "1h 35m",
      fare: 4850,
      currency: "INR",
      availableSeats: 9,
      seatClass: "Economy",
      stops: 0,
      isRecommended: true,
    },
    {
      transportMode: "flight",
      providerName: "Air India",
      serviceNumber: "AI-629",
      serviceName: "Boeing 737",
      origin: "Nagpur",
      originCode: "NGP",
      destination: "Mumbai",
      destinationCode: "BOM",
      departureTime: "18:30",
      arrivalTime: "20:05",
      duration: "1h 35m",
      fare: 5420,
      currency: "INR",
      availableSeats: 14,
      seatClass: "Economy",
      stops: 0,
    },

    // Nagpur to Mumbai (Buses)
    {
      transportMode: "bus",
      providerName: "IntrCity SmartBus",
      serviceNumber: "IC-812",
      serviceName: "Volvo Multi-Axle AC Sleeper",
      origin: "Nagpur",
      originCode: "NGP",
      destination: "Mumbai",
      destinationCode: "CSMT",
      departureTime: "18:30",
      arrivalTime: "08:00",
      duration: "13h 30m",
      fare: 1450,
      currency: "INR",
      availableSeats: 21,
      seatClass: "Sleeper AC",
      stops: 4,
    },

    // Mumbai to Pune (Trains & Buses)
    {
      transportMode: "train",
      providerName: "Indian Railways",
      serviceNumber: "12123",
      serviceName: "Deccan Queen Express",
      origin: "Mumbai",
      originCode: "CSMT",
      destination: "Pune",
      destinationCode: "PUNE",
      departureTime: "17:10",
      arrivalTime: "20:25",
      duration: "3h 15m",
      fare: 420,
      currency: "INR",
      availableSeats: 88,
      seatClass: "CC",
      stops: 2,
      isRecommended: true,
    },
    {
      transportMode: "bus",
      providerName: "MSRTC Shivneri",
      serviceNumber: "SH-90",
      serviceName: "Volvo AC Seater",
      origin: "Mumbai",
      originCode: "CSMT",
      destination: "Pune",
      destinationCode: "PUNE",
      departureTime: "07:30",
      arrivalTime: "11:00",
      duration: "3h 30m",
      fare: 510,
      currency: "INR",
      availableSeats: 32,
      seatClass: "Semi-Sleeper",
      stops: 2,
    },

    // Delhi to Mumbai (Flights & Trains)
    {
      transportMode: "flight",
      providerName: "IndiGo",
      serviceNumber: "6E-201",
      serviceName: "Airbus A321",
      origin: "New Delhi",
      originCode: "NDLS",
      destination: "Mumbai",
      destinationCode: "BOM",
      departureTime: "08:00",
      arrivalTime: "10:15",
      duration: "2h 15m",
      fare: 6200,
      currency: "INR",
      availableSeats: 12,
      seatClass: "Economy",
      stops: 0,
      isRecommended: true,
    },
    {
      transportMode: "train",
      providerName: "Indian Railways",
      serviceNumber: "12952",
      serviceName: "Mumbai Rajdhani Express",
      origin: "New Delhi",
      originCode: "NDLS",
      destination: "Mumbai",
      destinationCode: "CSMT",
      departureTime: "16:55",
      arrivalTime: "08:35",
      duration: "15h 40m",
      fare: 3150,
      currency: "INR",
      availableSeats: 24,
      seatClass: "2A",
      stops: 5,
    },
  ];

  public async search(params: TravelSearchParams): Promise<TravelOption[]> {
    const originLower = params.origin.toLowerCase();
    const destLower = params.destination.toLowerCase();

    const matches = DeterministicMockTravelProvider.MOCK_SCHEDULES.filter((item) => {
      // Origin match
      const originMatch =
        item.origin.toLowerCase().includes(originLower) ||
        originLower.includes(item.origin.toLowerCase()) ||
        item.originCode.toLowerCase() === originLower;

      // Destination match
      const destMatch =
        item.destination.toLowerCase().includes(destLower) ||
        destLower.includes(item.destination.toLowerCase()) ||
        item.destinationCode.toLowerCase() === destLower;

      if (!originMatch || !destMatch) return false;

      // Mode match
      if (params.transportMode && item.transportMode !== params.transportMode) {
        return false;
      }

      // Departure window filter
      if (params.departureWindowStart) {
        if (item.departureTime < params.departureWindowStart) return false;
      }
      if (params.departureWindowEnd) {
        if (item.departureTime > params.departureWindowEnd) return false;
      }

      return true;
    });

    return matches.map((item, idx) => ({
      ...item,
      id: `opt_${item.transportMode}_${item.serviceNumber}_${idx}`,
    }));
  }

  public async getOptionDetails(optionId: string): Promise<TravelOption | null> {
    for (let i = 0; i < DeterministicMockTravelProvider.MOCK_SCHEDULES.length; i++) {
      const item = DeterministicMockTravelProvider.MOCK_SCHEDULES[i]!;
      const id = `opt_${item.transportMode}_${item.serviceNumber}_${i}`;
      if (id === optionId || item.serviceNumber === optionId) {
        return { ...item, id };
      }
    }
    return null;
  }

  public async calculateFare(
    optionId: string,
    passengerCount: number
  ): Promise<{ baseFare: number; taxes: number; totalFare: number }> {
    const option = await this.getOptionDetails(optionId);
    const count = Math.max(1, passengerCount);
    const unitFare = option ? option.fare : 1000;
    const baseFare = unitFare * count;
    const taxes = Math.round(baseFare * 0.05); // 5% GST
    return {
      baseFare,
      taxes,
      totalFare: baseFare + taxes,
    };
  }

  public async initiateBooking(params: {
    organizationId: string;
    travelSessionId: Id<"travelSessions">;
    optionId: string;
    passengers: Passenger[];
    idempotencyKey: string;
    confirmedByCustomer: boolean;
  }): Promise<BookingResult> {
    // 1. Idempotency Check: Prevent duplicate bookings
    const existing = DeterministicMockTravelProvider.cachedBookings.get(params.idempotencyKey);
    if (existing) {
      return existing;
    }

    // 2. Consequential Guardrail: Customer MUST explicitly confirm before booking
    if (!params.confirmedByCustomer) {
      return {
        success: false,
        bookingReference: "",
        status: "failed",
        option: (await this.getOptionDetails(params.optionId)) as TravelOption,
        passengers: params.passengers,
        totalFare: 0,
        confirmedAt: 0,
        error: "Booking aborted: Explicit customer confirmation is strictly required prior to reservation.",
      };
    }

    // 3. Option Validation
    const option = await this.getOptionDetails(params.optionId);
    if (!option) {
      return {
        success: false,
        bookingReference: "",
        status: "failed",
        option: null as any,
        passengers: params.passengers,
        totalFare: 0,
        confirmedAt: 0,
        error: `Selected travel option ${params.optionId} is invalid or has expired.`,
      };
    }

    // 4. Passenger Validation
    if (!params.passengers || params.passengers.length === 0) {
      return {
        success: false,
        bookingReference: "",
        status: "failed",
        option,
        passengers: [],
        totalFare: 0,
        confirmedAt: 0,
        error: "At least one passenger with name and details is required to complete booking.",
      };
    }

    // 5. Generate deterministic booking reference (PNR / TKT)
    const prefix = option.transportMode === "train" ? "PNR" : option.transportMode === "flight" ? "FL" : "BUS";
    const refNum = Math.abs(
      params.idempotencyKey.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
    ) % 900000 + 100000;
    const bookingReference = `${prefix}-${option.originCode}-${refNum}`;

    const fareCalculation = await this.calculateFare(params.optionId, params.passengers.length);

    const bookingResult: BookingResult = {
      success: true,
      bookingReference,
      status: "confirmed",
      option,
      passengers: params.passengers.map((p, idx) => ({
        ...p,
        seatNumber: p.seatNumber || `${String.fromCharCode(65 + (idx % 6))}${idx + 12}`,
        status: "CONFIRMED",
      })),
      totalFare: fareCalculation.totalFare,
      confirmedAt: Date.now(),
    };

    DeterministicMockTravelProvider.cachedBookings.set(params.idempotencyKey, bookingResult);
    return bookingResult;
  }
}

export const travelProvider = new DeterministicMockTravelProvider();
