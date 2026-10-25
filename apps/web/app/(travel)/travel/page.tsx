"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Train,
  Plane,
  Bus,
  Clock,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Send,
  Square,
  ShieldCheck,
  Luggage,
  Users,
  Compass,
} from "lucide-react";

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "muted" | "error";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

export default function TravelVoiceAgentPage() {
  // Convex mutations & queries
  const createOrGetSession = useMutation(api.public.travel.createOrGetSession);
  const processSpokenTurn = useMutation(api.public.travel.processSpokenTurn);
  const confirmBookingMutation = useMutation(api.public.travel.confirmBooking);
  const cancelSessionMutation = useMutation(api.public.travel.cancelSession);
  const availableLocations = useQuery(api.public.travel.getAvailableLocations);

  // Session state
  const [sessionToken, setSessionToken] = useState<string>("");
  const [workflowState, setWorkflowState] = useState<string>("GREETING");
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>("");

  // Travel Data
  const [options, setOptions] = useState<any[]>([]);
  const [selectedOption, setSelectedOption] = useState<any | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState<boolean>(false);
  const [bookingConfirmed, setBookingConfirmed] = useState<any | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([
    "Travel from Nagpur to Mumbai tomorrow morning",
    "Find trains to Pune",
    "Flights to Delhi",
  ]);

  // Audio & Speech references
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Initialize travel session on mount
  useEffect(() => {
    let token = localStorage.getItem("aivon_travel_session");
    if (!token) {
      token = `ts_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem("aivon_travel_session", token);
    }
    setSessionToken(token);

    createOrGetSession({
      organizationId: "org_travel_demo",
      sessionToken: token,
    })
      .then((session) => {
        if (session) {
          setWorkflowState(session.status);
          if (session.searchResults) {
            setOptions(JSON.parse(session.searchResults));
          }
          if (session.selectedOption) {
            setSelectedOption(JSON.parse(session.selectedOption));
          }
        }
      })
      .catch((err) => console.warn("Failed to load initial session:", err));

    // Initialize speech synthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }

    // Initial assistant welcome greeting
    setMessages([
      {
        id: "msg_welcome",
        role: "assistant",
        text: "Namaste! I am your AI Travel Agent. Where would you like to travel today? You can speak naturally, for example 'I need to travel from Nagpur to Mumbai tomorrow morning'.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [createOrGetSession]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [messages, liveTranscript]);

  // Spoken Output Generator using Web Speech API with cancellation & Indian English natural voice
  const speakAgentResponse = useCallback((text: string, onEnd?: () => void) => {
    if (!synthRef.current) return;

    // Barge-in: cancel any active speech playback
    synthRef.current.cancel();

    const cleanSpoken = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/(\*\*|\*|__|_)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpoken);
    utterance.rate = 1.0;
    utterance.pitch = 1.02;

    // Pick English (India) or pleasant default voice if available
    const voices = synthRef.current.getVoices();
    const inVoice = voices.find((v) => v.lang.includes("en-IN") || v.name.includes("India"));
    if (inVoice) {
      utterance.voice = inVoice;
    }

    utterance.onstart = () => {
      setVoiceState("speaking");
    };

    utterance.onend = () => {
      setVoiceState("idle");
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error or interrupt:", e);
      setVoiceState("idle");
    };

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, []);

  // Barge-in Interruption: Stop agent speaking instantly
  const interruptAgent = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setVoiceState("idle");
  }, []);

  // Turn submission handler
  const handleUserTurn = useCallback(
    async (spokenInput: string) => {
      if (!spokenInput || !spokenInput.trim()) return;

      const trimmed = spokenInput.trim();
      interruptAgent(); // Stop any pending speech

      // Append user message to transcript
      const userMsg: Message = {
        id: `msg_user_${Date.now()}`,
        role: "user",
        text: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLiveTranscript("");
      setVoiceState("processing");

      try {
        const result = await processSpokenTurn({
          sessionToken: sessionToken || "ts_default",
          spokenText: trimmed,
        });

        // Append assistant response to transcript
        const assistantMsg: Message = {
          id: `msg_asst_${Date.now()}`,
          role: "assistant",
          text: result.spokenResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setWorkflowState(result.nextState);

        if (result.options) setOptions(result.options);
        if (result.selectedOption) setSelectedOption(result.selectedOption);
        setConfirmationRequired(result.confirmationRequired);
        if (result.suggestedQuickReplies) setQuickReplies(result.suggestedQuickReplies);
        if (result.bookingResult?.success) setBookingConfirmed(result.bookingResult);

        // Speak response out loud
        speakAgentResponse(result.spokenResponse);
      } catch (err: any) {
        console.error("Failed to process spoken turn:", err);
        setVoiceState("error");
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_err_${Date.now()}`,
            role: "assistant",
            text: "I am having trouble connecting to travel inventory right now. Please try again.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    },
    [sessionToken, processSpokenTurn, interruptAgent, speakAgentResponse]
  );

  // Browser Web Speech Recognition Start
  const startListening = useCallback(() => {
    interruptAgent();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser. You can type in the box below!");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Default to Indian English recognition

      recognition.onstart = () => {
        setVoiceState("listening");
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setLiveTranscript(interim);
        }

        if (final) {
          setLiveTranscript(final);
          recognition.stop();
          handleUserTurn(final);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setVoiceState("idle");
      };

      recognition.onend = () => {
        if (voiceState === "listening") {
          setVoiceState("idle");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setVoiceState("idle");
    }
  }, [interruptAgent, voiceState, handleUserTurn]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceState("idle");
  }, []);

  // Confirm Booking Action (Consequential Safeguard)
  const handleConfirmBooking = async () => {
    if (!selectedOption) return;
    setVoiceState("processing");

    try {
      const res = await confirmBookingMutation({
        sessionToken,
        confirmedByCustomer: true,
        passengers: [
          {
            name: "Yash Giradkar",
            age: 28,
            gender: "Male",
          },
        ],
        idempotencyKey: `idemp_${selectedOption.id}_${Date.now()}`,
      });

      setBookingConfirmed(res);
      setConfirmationRequired(false);
      setWorkflowState("BOOKED");

      const spoken = `Congratulations! Your ticket is confirmed with booking reference ${res.bookingReference} on the ${selectedOption.serviceName}. Have a safe journey!`;
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_conf_${Date.now()}`,
          role: "assistant",
          text: spoken,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      speakAgentResponse(spoken);
    } catch (err: any) {
      alert(`Booking execution error: ${err.message}`);
      setVoiceState("idle");
    }
  };

  // Reset conversation
  const handleResetConversation = async () => {
    interruptAgent();
    await cancelSessionMutation({ sessionToken });
    setWorkflowState("COLLECTING_REQUIREMENTS");
    setOptions([]);
    setSelectedOption(null);
    setBookingConfirmed(null);
    setConfirmationRequired(false);
    setMessages([
      {
        id: `msg_new_${Date.now()}`,
        role: "assistant",
        text: "I have started a new search session. Where would you like to travel?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Compass className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">Aivon Voice Travel</h1>
              <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-wider">
                Voice First AI
              </span>
            </div>
            <p className="text-xs text-slate-400">Natural voice assistant for trains, flights & buses</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetConversation}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-all bg-slate-900/50"
            title="Reset conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Trip
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Verified Live Inventory
          </div>
        </div>
      </header>

      {/* Main Grid: Left = Visualizer & Controls, Right = Transcript & Travel Cards */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Voice Interaction Orb & Controls */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800/80 p-8 flex flex-col items-center justify-center min-h-[380px] shadow-2xl backdrop-blur-xl">
            {/* Background Glow Orbs */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Status Badge */}
            <div className="mb-6 z-10">
              <span
                className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium tracking-wide uppercase border ${
                  voiceState === "listening"
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 animate-pulse"
                    : voiceState === "speaking"
                      ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 animate-pulse"
                      : voiceState === "processing"
                        ? "bg-purple-500/10 text-purple-300 border-purple-500/30 animate-pulse"
                        : "bg-slate-800/60 text-slate-400 border-slate-700/60"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    voiceState === "listening"
                      ? "bg-emerald-400"
                      : voiceState === "speaking"
                        ? "bg-cyan-400"
                        : voiceState === "processing"
                          ? "bg-purple-400"
                          : "bg-slate-500"
                  }`}
                />
                {voiceState === "listening"
                  ? "Listening to you..."
                  : voiceState === "speaking"
                    ? "Agent Speaking"
                    : voiceState === "processing"
                      ? "Searching & Planning..."
                      : "Ready to Speak"}
              </span>
            </div>

            {/* Central Animated Voice Orb */}
            <div className="relative my-4 flex items-center justify-center">
              {/* Outer pulsing rings when active */}
              {voiceState === "listening" && (
                <div className="absolute h-48 w-48 rounded-full border border-emerald-500/30 animate-ping pointer-events-none" />
              )}
              {voiceState === "speaking" && (
                <div className="absolute h-48 w-48 rounded-full border border-cyan-500/30 animate-pulse pointer-events-none" />
              )}

              {/* Main Button / Voice Sphere */}
              <button
                onClick={voiceState === "listening" ? stopListening : startListening}
                className={`h-36 w-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-2xl ${
                  voiceState === "listening"
                    ? "bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-emerald-500/40 ring-4 ring-emerald-500/20"
                    : voiceState === "speaking"
                      ? "bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-500 shadow-cyan-500/40 ring-4 ring-cyan-500/20"
                      : "bg-gradient-to-tr from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 shadow-blue-600/30"
                }`}
                aria-label={voiceState === "listening" ? "Stop microphone" : "Start speaking"}
              >
                {voiceState === "listening" ? (
                  <Square className="h-10 w-10 text-white fill-white" />
                ) : voiceState === "speaking" ? (
                  <Volume2 className="h-10 w-10 text-white animate-bounce" />
                ) : (
                  <Mic className="h-10 w-10 text-white" />
                )}
                <span className="text-[11px] font-semibold text-white/90 mt-1 uppercase tracking-wider">
                  {voiceState === "listening" ? "Tap to Stop" : "Tap to Speak"}
                </span>
              </button>
            </div>

            {/* Dynamic Waveform Simulation */}
            <div className="flex items-center gap-1.5 h-8 my-3">
              {[4, 8, 14, 22, 12, 18, 28, 16, 24, 10, 6].map((height, i) => (
                <div
                  key={i}
                  style={{
                    height:
                      voiceState === "listening" || voiceState === "speaking"
                        ? `${Math.max(6, (height * Math.random() * 1.5).toFixed(0))}px`
                        : "4px",
                  }}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    voiceState === "listening"
                      ? "bg-emerald-400"
                      : voiceState === "speaking"
                        ? "bg-cyan-400"
                        : "bg-slate-700"
                  }`}
                />
              ))}
            </div>

            {/* Interrupt Barge-In Control */}
            {voiceState === "speaking" && (
              <button
                onClick={interruptAgent}
                className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium transition-all"
              >
                <Square className="h-3 w-3 fill-red-400" />
                Interrupt Agent (Barge-in)
              </button>
            )}

            {/* Live spoken preview transcript */}
            {liveTranscript && (
              <div className="w-full mt-4 px-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-center text-sm text-cyan-300 italic animate-pulse">
                “{liveTranscript}”
              </div>
            )}
          </div>

          {/* Quick Spoken Prompts */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 backdrop-blur-xl">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Suggested Spoken Requests
            </h2>
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleUserTurn(prompt)}
                  className="text-xs bg-slate-800/60 hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-slate-700/60 hover:border-blue-500/30 px-3 py-1.5 rounded-lg transition-all text-left"
                >
                  “{prompt}”
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Conversation Transcript & Real-Time Options Cards */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          {/* Confirmed Booking Banner (When Consequential Action has executed) */}
          {bookingConfirmed && (
            <div className="rounded-2xl bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border border-emerald-500/40 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      Booking Confirmed
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      Reference: {bookingConfirmed.bookingReference}
                    </h3>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-emerald-400">
                    ₹{bookingConfirmed.totalFare}
                  </div>
                  <span className="text-xs text-slate-400">Paid & Confirmed</span>
                </div>
              </div>

              {selectedOption && (
                <div className="mt-4 pt-4 border-t border-emerald-500/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Service</span>
                    <p className="font-semibold text-white">{selectedOption.serviceName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Departure</span>
                    <p className="font-semibold text-white">
                      {selectedOption.departureTime} ({selectedOption.originCode})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Arrival</span>
                    <p className="font-semibold text-white">
                      {selectedOption.arrivalTime} ({selectedOption.destinationCode})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Class & Seat</span>
                    <p className="font-semibold text-white">
                      {selectedOption.seatClass} (Seat 12A)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Travel Option Cards (Visual grounding for speech) */}
          {options.length > 0 && !bookingConfirmed && (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Luggage className="h-4 w-4 text-blue-400" />
                  Available Travel Options ({options.length})
                </h3>
                <span className="text-xs text-slate-400">
                  Say “Choose the second one” or tap below
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {options.map((opt: any, index: number) => {
                  const isSelected = selectedOption?.id === opt.id;
                  return (
                    <div
                      key={opt.id || index}
                      onClick={() => handleUserTurn(`Select option ${index + 1}`)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 relative ${
                        isSelected
                          ? "bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10"
                          : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                      }`}
                    >
                      {opt.isRecommended && (
                        <span className="absolute -top-2.5 right-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
                          Top Pick
                        </span>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {opt.transportMode === "train" && (
                            <Train className="h-4 w-4 text-emerald-400" />
                          )}
                          {opt.transportMode === "flight" && (
                            <Plane className="h-4 w-4 text-blue-400" />
                          )}
                          {opt.transportMode === "bus" && (
                            <Bus className="h-4 w-4 text-amber-400" />
                          )}
                          <span className="text-xs font-semibold text-white">
                            Option {index + 1}: {opt.serviceName}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-emerald-400">₹{opt.fare}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-300 my-2">
                        <div>
                          <p className="text-base font-bold text-white">{opt.departureTime}</p>
                          <p className="text-[11px] text-slate-400">{opt.originCode}</p>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-400">{opt.duration}</span>
                          <div className="w-16 h-[2px] bg-slate-700 relative my-1">
                            <div className="absolute left-1/2 -top-1 -translate-x-1/2 h-2 w-2 rounded-full bg-blue-400" />
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {opt.stops === 0 ? "Non-stop" : `${opt.stops} stops`}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-white">{opt.arrivalTime}</p>
                          <p className="text-[11px] text-slate-400">{opt.destinationCode}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Class: {opt.seatClass}</span>
                        <span className="text-emerald-400 font-medium">
                          {opt.availableSeats} seats left
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Explicit Booking Confirmation Gate */}
              {confirmationRequired && selectedOption && (
                <div className="mt-4 p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                      Ready to confirm booking
                    </h4>
                    <p className="text-sm text-slate-200">
                      Confirm {selectedOption.serviceName} ({selectedOption.departureTime}) for ₹
                      {selectedOption.fare}?
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUserTurn("cancel")}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Confirm & Book
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transcript Log Container */}
          <div className="flex-1 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 flex flex-col h-[400px] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Live Conversation Transcript
              </span>
              <span className="text-xs text-slate-500">Continuous Multi-turn Memory</span>
            </div>

            <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-xs shadow-md"
                        : "bg-slate-800/90 text-slate-100 rounded-bl-xs border border-slate-700/60 shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}
            </div>

            {/* Optional Keyboard Fallback Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (textInput.trim()) {
                  handleUserTurn(textInput);
                  setTextInput("");
                }
              }}
              className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Speak or type your request (e.g. Nagpur to Mumbai train)..."
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="h-9 px-3.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
