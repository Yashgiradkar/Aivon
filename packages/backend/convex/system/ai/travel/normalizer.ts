import { TransportMode, TravelSlots } from "./types";

export interface StationLocation {
  name: string;
  code: string;
  aliases: string[];
  state: string;
}

export const SUPPORTED_LOCATIONS: Record<string, StationLocation> = {
  nagpur: { name: "Nagpur", code: "NGP", aliases: ["nagpur", "ngp"], state: "Maharashtra" },
  mumbai: { name: "Mumbai", code: "CSMT", aliases: ["mumbai", "bombay", "csmt", "cst", "mmct", "bom"], state: "Maharashtra" },
  pune: { name: "Pune", code: "PUNE", aliases: ["pune", "poona"], state: "Maharashtra" },
  delhi: { name: "New Delhi", code: "NDLS", aliases: ["delhi", "new delhi", "ndls", "dli"], state: "Delhi" },
  bangalore: { name: "Bengaluru", code: "SBC", aliases: ["bangalore", "bengaluru", "sbc", "blr"], state: "Karnataka" },
  chennai: { name: "Chennai", code: "MAS", aliases: ["chennai", "madras", "mas", "maa"], state: "Tamil Nadu" },
  hyderabad: { name: "Hyderabad", code: "HYB", aliases: ["hyderabad", "secunderabad", "sc", "hyb", "hyd"], state: "Telangana" },
  kolkata: { name: "Kolkata", code: "HWH", aliases: ["kolkata", "calcutta", "howrah", "hwh", "ccu"], state: "West Bengal" },
  ahmedabad: { name: "Ahmedabad", code: "ADI", aliases: ["ahmedabad", "amdavad", "adi", "amd"], state: "Gujarat" },
  goa: { name: "Goa (Madgaon)", code: "MAO", aliases: ["goa", "madgaon", "margao", "mao", "goi"], state: "Goa" },
};

export class TravelNormalizer {
  /**
   * Resolves a spoken or typed location name to canonical location metadata.
   */
  public static resolveLocation(raw: string): StationLocation | null {
    if (!raw) return null;
    const clean = raw.trim().toLowerCase().replace(/[.,!?;:]/g, "");

    for (const key of Object.keys(SUPPORTED_LOCATIONS)) {
      const loc = SUPPORTED_LOCATIONS[key]!;
      if (loc.aliases.some((alias) => clean === alias || clean.includes(alias))) {
        return loc;
      }
    }
    return null;
  }

  /**
   * Normalizes relative dates ("tomorrow", "day after tomorrow", "next Friday")
   * into ISO YYYY-MM-DD format using reference timestamp (default Date.now()).
   */
  public static normalizeDate(raw: string, referenceMs: number = Date.now()): string | null {
    if (!raw) return null;
    const text = raw.trim().toLowerCase();
    const ref = new Date(referenceMs);

    // Direct YYYY-MM-DD
    const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (isoMatch) return isoMatch[0]!;

    const addDays = (days: number): string => {
      const d = new Date(referenceMs);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0]!;
    };

    if (text.includes("today") || text.includes("tonight")) {
      return addDays(0);
    }

    if (text.includes("day after tomorrow")) {
      return addDays(2);
    }

    if (text.includes("tomorrow")) {
      return addDays(1);
    }

    const inDaysMatch = text.match(/in\s+(\d+)\s+days?/);
    if (inDaysMatch && inDaysMatch[1]) {
      return addDays(parseInt(inDaysMatch[1], 10));
    }

    // Days of the week (e.g. "next Friday", "this Saturday", "on Monday")
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let i = 0; i < daysOfWeek.length; i++) {
      const dayName = daysOfWeek[i]!;
      if (text.includes(dayName)) {
        const currentDay = ref.getDay();
        let diff = i - currentDay;
        if (diff <= 0) diff += 7;
        if (text.includes("next") && diff < 7) diff += 7;
        return addDays(diff);
      }
    }

    return null;
  }

  /**
   * Normalizes spoken time ranges and windows (e.g. "between 7 and 10", "after 7 AM", "morning", "evening").
   */
  public static extractTimeWindow(raw: string): { start?: string; end?: string } {
    const text = raw.toLowerCase();

    // "between 7 and 10", "7 to 10"
    const betweenMatch = text.match(/(?:between|from)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|and|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (betweenMatch) {
      let startH = parseInt(betweenMatch[1]!, 10);
      const startM = betweenMatch[2] || "00";
      const startMeridiem = betweenMatch[3]?.toLowerCase();

      let endH = parseInt(betweenMatch[4]!, 10);
      const endM = betweenMatch[5] || "00";
      const endMeridiem = betweenMatch[6]?.toLowerCase() || startMeridiem;

      if (startMeridiem === "pm" && startH < 12) startH += 12;
      if (endMeridiem === "pm" && endH < 12) endH += 12;

      return {
        start: `${String(startH).padStart(2, "0")}:${startM}`,
        end: `${String(endH).padStart(2, "0")}:${endM}`,
      };
    }

    // "after 7 AM", "after 7"
    const afterMatch = text.match(/(?:after|post|from)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (afterMatch) {
      let h = parseInt(afterMatch[1]!, 10);
      const m = afterMatch[2] || "00";
      if (afterMatch[3]?.toLowerCase() === "pm" && h < 12) h += 12;
      return {
        start: `${String(h).padStart(2, "0")}:${m}`,
        end: "23:59",
      };
    }

    // Named parts of day
    if (text.includes("morning")) {
      return { start: "06:00", end: "12:00" };
    }
    if (text.includes("afternoon")) {
      return { start: "12:00", end: "17:00" };
    }
    if (text.includes("evening")) {
      return { start: "17:00", end: "22:00" };
    }
    if (text.includes("night")) {
      return { start: "20:00", end: "23:59" };
    }

    return {};
  }

  /**
   * Detects preferred mode of transport.
   */
  public static extractTransportMode(raw: string): TransportMode | undefined {
    const text = raw.toLowerCase();
    if (/\b(train|railway|rail|express|vande bharat|tejas|rajdhani|duronto|irctc)\b/i.test(text)) {
      return "train";
    }
    if (/\b(flight|plane|air|airline|airways|indigo|air india|vistara)\b/i.test(text)) {
      return "flight";
    }
    if (/\b(bus|coach|volvo|sleeper bus|ksrtc|zingbus|intrCity)\b/i.test(text)) {
      return "bus";
    }
    return undefined;
  }

  /**
   * Detects spoken selection of a presented option (e.g. "choose the second one", "option 1", "first").
   */
  public static extractOptionSelection(raw: string, optionsCount: number): number | null {
    const text = raw.toLowerCase();

    // Ordinals & words
    const ordinals: Record<string, number> = {
      first: 0,
      "1st": 0,
      second: 1,
      "2nd": 1,
      third: 2,
      "3rd": 2,
      fourth: 3,
      "4th": 3,
      fifth: 4,
      "5th": 4,
    };

    for (const [word, idx] of Object.entries(ordinals)) {
      if (text.includes(word) && idx < optionsCount) {
        return idx;
      }
    }

    // Numbered patterns: "option 2", "number 1", "select 3"
    const numMatch = text.match(/(?:option|number|choice|select|choose|pick)\s*#?\s*(\d+)/i);
    if (numMatch && numMatch[1]) {
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx >= 0 && idx < optionsCount) {
        return idx;
      }
    }

    return null;
  }

  /**
   * Detects explicit confirmation or cancellation intent from user speech.
   */
  public static detectConfirmationIntent(raw: string): "confirm" | "cancel" | "unknown" {
    const text = raw.toLowerCase();
    if (
      /\b(yes|confirm|proceed|go ahead|book it|looks good|i confirm|that's right|correct|sure)\b/i.test(text) &&
      !/\b(no|don't|not|cancel|wait)\b/i.test(text)
    ) {
      return "confirm";
    }

    if (/\b(no|cancel|abort|stop|don't book|wait|hold on|change|back)\b/i.test(text)) {
      return "cancel";
    }

    return "unknown";
  }

  /**
   * Extracts journey origin, destination, and handles speech corrections (e.g. "Nagpur to Mumbai - sorry Pune").
   */
  public static extractOriginAndDestination(
    raw: string,
    existingSlots: TravelSlots = {}
  ): { origin?: string; originCode?: string; destination?: string; destinationCode?: string } {
    let cleanText = raw;

    // Handle speech correction: "Mumbai—sorry, Pune" or "to Mumbai no wait Pune"
    // Use two patterns: dash-based (—/-) and spoken keyword (sorry/no wait/actually)
    const dashCorrectionMatch = cleanText.match(/\bto\s+[a-zA-Z\s]+?(?:—|-)\s*(?:sorry[,\s]*|actually[,\s]*|wait[,\s]*)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    const spokenCorrectionMatch = cleanText.match(/\bto\s+[a-zA-Z\s]+?[,\s]+(?:sorry|no wait|actually|wait)[,\s]+(?:to\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    const correctionMatch = dashCorrectionMatch || spokenCorrectionMatch;
    if (correctionMatch && correctionMatch[1]) {
      const correctedLoc = this.resolveLocation(correctionMatch[1]);
      if (correctedLoc) {
        return {
          origin: existingSlots.origin,
          originCode: existingSlots.originCode,
          destination: correctedLoc.name,
          destinationCode: correctedLoc.code,
        };
      }
    }

    // Standard pattern: "from [Origin] to [Destination]"
    const fromToMatch = cleanText.match(/from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|on|at|by|in|prefer|between)|$|[.,!?])/i);
    if (fromToMatch && fromToMatch[1] && fromToMatch[2]) {
      const originLoc = this.resolveLocation(fromToMatch[1]);
      const destLoc = this.resolveLocation(fromToMatch[2]);
      return {
        origin: originLoc?.name || existingSlots.origin,
        originCode: originLoc?.code || existingSlots.originCode,
        destination: destLoc?.name || existingSlots.destination,
        destinationCode: destLoc?.code || existingSlots.destinationCode,
      };
    }

    // Standalone "to [Destination]"
    const toMatch = cleanText.match(/\bto\s+([a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|on|at|by|in|prefer|between)|$|[.,!?])/i);
    if (toMatch && toMatch[1]) {
      const destLoc = this.resolveLocation(toMatch[1]);
      if (destLoc) {
        return {
          origin: existingSlots.origin,
          originCode: existingSlots.originCode,
          destination: destLoc.name,
          destinationCode: destLoc.code,
        };
      }
    }

    // Standalone "from [Origin]"
    const fromMatch = cleanText.match(/\bfrom\s+([a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|on|at|by|in|prefer|between)|$|[.,!?])/i);
    if (fromMatch && fromMatch[1]) {
      const originLoc = this.resolveLocation(fromMatch[1]);
      if (originLoc) {
        return {
          origin: originLoc.name,
          originCode: originLoc.code,
          destination: existingSlots.destination,
          destinationCode: existingSlots.destinationCode,
        };
      }
    }

    return {
      origin: existingSlots.origin,
      originCode: existingSlots.originCode,
      destination: existingSlots.destination,
      destinationCode: existingSlots.destinationCode,
    };
  }

  /**
   * Main slot extraction function: merges newly spoken entities into existing conversation slots.
   */
  public static extractAndMergeSlots(
    spokenText: string,
    existingSlots: TravelSlots = {},
    referenceMs: number = Date.now()
  ): TravelSlots {
    const merged: TravelSlots = { ...existingSlots };

    // 1. Origin and Destination
    const locs = this.extractOriginAndDestination(spokenText, existingSlots);
    if (locs.origin) {
      merged.origin = locs.origin;
      merged.originCode = locs.originCode;
    }
    if (locs.destination) {
      merged.destination = locs.destination;
      merged.destinationCode = locs.destinationCode;
    }

    // 2. Transport Mode
    const mode = this.extractTransportMode(spokenText);
    if (mode) {
      merged.transportMode = mode;
    }

    // 3. Travel Date
    const date = this.normalizeDate(spokenText, referenceMs);
    if (date) {
      merged.travelDate = date;
    }

    // 4. Departure Time Window
    const timeWin = this.extractTimeWindow(spokenText);
    if (timeWin.start) {
      merged.departureWindowStart = timeWin.start;
    }
    if (timeWin.end) {
      merged.departureWindowEnd = timeWin.end;
    }

    // 5. Passenger count
    const paxMatch = spokenText.match(/\b(\d+)\s*(?:passengers?|people|tickets?|seats?|pax)\b/i);
    if (paxMatch && paxMatch[1]) {
      merged.passengerCount = parseInt(paxMatch[1], 10);
    } else if (!merged.passengerCount) {
      merged.passengerCount = 1; // Default 1 passenger
    }

    return merged;
  }
}
