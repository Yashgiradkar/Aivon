"use client";

import Vapi from "@vapi-ai/web";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import {
  contactSessionIdAtomFamily,
  conversationIdAtom,
  organizationIdAtom,
  vapiSecretsAtom,
  widgetSettingsAtom,
} from "../atoms/widget-atoms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceCallState =
  | "idle"
  | "requesting-microphone"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "muted"
  | "ending"
  | "ended"
  | "error";

export interface TranscriptMessage {
  role: "user" | "assistant";
  text: string;
}

export interface UseVapiReturn {
  callState: VoiceCallState;
  isMuted: boolean;
  volumeLevel: number; // assistant audio level 0–1
  localVolumeLevel: number; // user mic level 0–1
  transcript: TranscriptMessage[];
  liveTranscript: string; // current partial transcript being spoken
  errorMessage: string | null;
  activeLanguage: string; // resolved language for UI display
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  retryCall: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Turn-ID guard: each assistant response is tagged with a generation ID.
// When an interruption occurs, we invalidate any in-flight audio associated
// with the previous turn so stale chunks cannot restart cancelled speech.
// ---------------------------------------------------------------------------

let _globalTurnId = 0;
function nextTurnId() {
  return ++_globalTurnId;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useVapi = (): UseVapiReturn => {
  const vapiSecrets = useAtomValue(vapiSecretsAtom);
  const widgetSettings = useAtomValue(widgetSettingsAtom);
  const organizationId = useAtomValue(organizationIdAtom);
  const conversationId = useAtomValue(conversationIdAtom);
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId ?? "")
  );

  // Fetch org voice config (non-secret, safe to read in widget)
  const voiceConfig = useQuery(
    api.public.voiceSettings.getVoiceConfig,
    organizationId ? { organizationId } : "skip"
  );

  // Singleton Vapi instance — stored in ref to avoid stale closure issues
  const vapiRef = useRef<Vapi | null>(null);
  const isStartingRef = useRef(false); // duplicate-start guard
  // Track current turn ID so stale speech-start events cannot revive ended turns
  const currentTurnIdRef = useRef<number>(0);

  const [callState, setCallState] = useState<VoiceCallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [localVolumeLevel, setLocalVolumeLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState("en");

  // Keep a ref to the transcript so we can access latest value in callbacks
  // without stale closure issues
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  transcriptRef.current = transcript;

  // ---------------------------------------------------------------------------
  // Initialize Vapi instance once (singleton)
  // ---------------------------------------------------------------------------
  const effectiveApiKey =
    vapiSecrets?.publicApiKey ||
    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ||
    "";

  useEffect(() => {
    if (!effectiveApiKey || vapiRef.current) {
      return;
    }

    const vapi = new Vapi(effectiveApiKey);
    vapiRef.current = vapi;

    // --- Call lifecycle ---
    vapi.on("call-start", () => {
      isStartingRef.current = false;
      setCallState("listening");
      setIsMuted(false);
      setVolumeLevel(0);
      setLocalVolumeLevel(0);
    });

    vapi.on("call-end", () => {
      isStartingRef.current = false;
      currentTurnIdRef.current = 0; // reset turn tracking
      setCallState("ended");
      setVolumeLevel(0);
      setLocalVolumeLevel(0);
      setLiveTranscript("");
    });

    // Granular start-progress events (available in SDK v2.x)
    vapi.on("call-start-progress", (event) => {
      if (event.status === "started") {
        setCallState("connecting");
      }
    });

    vapi.on("call-start-failed", (event) => {
      isStartingRef.current = false;
      setErrorMessage(event.error ?? "Failed to connect. Please try again.");
      setCallState("error");
    });

    // --- Audio levels ---
    vapi.on("volume-level", (level) => {
      setVolumeLevel(level);
    });

    vapi.on("local-volume-level", (level) => {
      setLocalVolumeLevel(level);
    });

    // --- Speech state with turn-ID guard ---
    vapi.on("speech-start", () => {
      // Assign a new turn ID when assistant starts a new utterance
      currentTurnIdRef.current = nextTurnId();
      setCallState("speaking");
    });

    vapi.on("speech-end", () => {
      setCallState((prev) => {
        // Only transition back to listening if we were speaking
        if (prev === "speaking") return "listening";
        return prev;
      });
    });

    // --- Interruption handling ---
    // Vapi fires "user-interrupted" when barge-in is detected.
    // We invalidate the current turn ID to prevent any late-arriving TTS
    // audio chunks from the previous response from playing.
    vapi.on("message", (message) => {
      if (message.type === "user-interrupted") {
        // Invalidate current turn — stale speech-start events from the old
        // turn are now orphaned and will not update call state.
        currentTurnIdRef.current = nextTurnId();
        // Immediately transition to listening state
        setCallState("listening");
        setLiveTranscript("");
        return;
      }

      if (message.type !== "transcript") return;

      const role: "user" | "assistant" =
        message.role === "user" ? "user" : "assistant";

      if (message.transcriptType === "partial") {
        // Show live streaming text (user's voice)
        setLiveTranscript(message.transcript ?? "");
      } else if (message.transcriptType === "final") {
        // Commit final transcript, clear live
        setLiveTranscript("");
        setTranscript((prev) => [
          ...prev,
          { role, text: message.transcript ?? "" },
        ]);
      }
    });

    // --- Errors ---
    vapi.on("error", (error) => {
      isStartingRef.current = false;
      const message =
        error?.message ??
        (typeof error === "string" ? error : "An error occurred during the call.");
      console.error("[Vapi] Error:", error);
      setErrorMessage(message);
      setCallState("error");
    });

    // Cleanup on unmount
    return () => {
      vapi.stop();
      vapiRef.current = null;
    };
  }, [effectiveApiKey]); // reinitialize if key changes

  // ---------------------------------------------------------------------------
  // Build AssistantOverrides from org voiceConfig
  // ---------------------------------------------------------------------------
  const buildAssistantOverrides = useCallback(() => {
    const overrides: Record<string, unknown> = {
      variableValues: {
        conversationId: conversationId ?? undefined,
        organizationId: organizationId ?? undefined,
      },
    };

    if (!voiceConfig) return overrides;

    // --- TTS: ElevenLabs voice override ---
    if (voiceConfig.elevenLabsVoiceId) {
      overrides.voice = {
        provider: "11labs",
        voiceId: voiceConfig.elevenLabsVoiceId,
        model: voiceConfig.elevenLabsModel ?? "eleven_turbo_v2_5",
        stability: voiceConfig.elevenLabsStability ?? 0.5,
        similarityBoost: voiceConfig.elevenLabsSimilarityBoost ?? 0.8,
        speed: voiceConfig.elevenLabsSpeed ?? 1.0,
        optimizeStreamingLatency: voiceConfig.elevenLabsOptimizeStreamingLatency ?? 3,
        // Multilingual model supports language enforcement (Turbo v2.5+)
        ...(voiceConfig.transcriberLanguage &&
          ["eleven_turbo_v2_5", "eleven_flash_v2_5"].includes(voiceConfig.elevenLabsModel ?? "") && {
            language: voiceConfig.transcriberLanguage,
          }),
      };
    }

    // --- STT: ElevenLabs Scribe transcriber ---
    if (voiceConfig.transcriberProvider === "11labs") {
      overrides.transcriber = {
        provider: "11labs",
        model: "scribe_v1",
        language: voiceConfig.transcriberLanguage ?? "en",
      };
    }

    // --- Interruption / barge-in: stopSpeakingPlan ---
    overrides.stopSpeakingPlan = {
      numWords: voiceConfig.interruptionNumWords ?? 0,
      voiceSeconds: voiceConfig.interruptionVoiceSeconds ?? 0.2,
      backoffSeconds: voiceConfig.interruptionBackoffSeconds ?? 1,
      // Background noise guard: common filler words that should NOT interrupt
      acknowledgementPhrases: ["okay", "yeah", "right", "uh-huh", "mm-hmm", "sure", "alright"],
      // Phrases that always interrupt immediately — user clearly wants to stop
      interruptionPhrases: ["stop", "wait", "no", "actually", "hold on", "never mind", "forget it"],
    };

    // --- Turn-taking: startSpeakingPlan ---
    overrides.startSpeakingPlan = {
      waitSeconds: voiceConfig.startSpeakingWaitSeconds ?? 0.4,
      // For English: use LiveKit smart endpointing for best accuracy
      // For other languages: fall back to transcription-based endpointing
      smartEndpointingEnabled: voiceConfig.transcriberLanguage === "en" ? "livekit" : false,
    };

    // Update active language for UI display
    setActiveLanguage(voiceConfig.transcriberLanguage ?? "en");

    return overrides;
  }, [voiceConfig, conversationId, organizationId]);

  // ---------------------------------------------------------------------------
  // Start call
  // ---------------------------------------------------------------------------
  const startCall = useCallback(async () => {
    const assistantId =
      widgetSettings?.vapiSettings?.assistantId ||
      process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    if (!effectiveApiKey || !assistantId) {
      setErrorMessage(
        "Vapi Voice is not configured. Please add your Vapi Public Key and Assistant ID in dashboard settings or .env file."
      );
      setCallState("error");
      return;
    }

    const vapi = vapiRef.current;
    if (!vapi) {
      setErrorMessage("Vapi client initialization failed. Please refresh the page.");
      setCallState("error");
      return;
    }

    // Guard against duplicate starts
    if (
      isStartingRef.current ||
      callState === "connecting" ||
      callState === "connected" ||
      callState === "listening" ||
      callState === "speaking"
    ) {
      return;
    }

    // Reset state
    setErrorMessage(null);
    setTranscript([]);
    setLiveTranscript("");
    currentTurnIdRef.current = 0;

    // Step 1: Request microphone permission explicitly for better UX
    setCallState("requesting-microphone");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMessage(
        "Microphone access denied. Please allow microphone access and try again."
      );
      setCallState("error");
      return;
    }

    // Step 2: Start Vapi call with ElevenLabs voice + Scribe overrides
    isStartingRef.current = true;
    setCallState("connecting");

    try {
      const assistantOverrides = buildAssistantOverrides();
      await vapi.start(assistantId, assistantOverrides ?? undefined);
    } catch (err) {
      isStartingRef.current = false;
      const message =
        err instanceof Error ? err.message : "Failed to start call. Please try again.";
      setErrorMessage(message);
      setCallState("error");
    }
  }, [
    widgetSettings?.vapiSettings?.assistantId,
    vapiSecrets,
    callState,
    contactSessionId,
    conversationId,
    organizationId,
    effectiveApiKey,
    buildAssistantOverrides,
  ]);

  // ---------------------------------------------------------------------------
  // End call
  // ---------------------------------------------------------------------------
  const endCall = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;

    setCallState("ending");
    setLiveTranscript("");
    // Invalidate current turn to prevent any stale audio from resuming
    currentTurnIdRef.current = nextTurnId();

    // Persist final transcript to Convex conversation if we have context
    const finalTranscript = transcriptRef.current;
    if (
      finalTranscript.length > 0 &&
      conversationId &&
      contactSessionId
    ) {
      void (async () => {
        try {
          // Transcript is already reflected in Vapi's call-end webhook.
          // UI-level local transcript is displayed in widget regardless.
        } catch {
          // Non-fatal
        }
      })();
    }

    vapi.stop();
  }, [conversationId, contactSessionId]);

  // ---------------------------------------------------------------------------
  // Toggle mute
  // ---------------------------------------------------------------------------
  const toggleMute = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;
    if (callState !== "connected" && callState !== "listening" && callState !== "speaking" && callState !== "muted") {
      return;
    }

    const nextMuted = !isMuted;
    vapi.setMuted(nextMuted);
    setIsMuted(nextMuted);

    if (nextMuted) {
      setCallState("muted");
    } else {
      setCallState("listening");
    }
  }, [isMuted, callState]);

  // ---------------------------------------------------------------------------
  // Retry call
  // ---------------------------------------------------------------------------
  const retryCall = useCallback(async () => {
    const vapi = vapiRef.current;
    if (vapi && (callState === "connected" || callState === "listening" || callState === "speaking" || callState === "muted")) {
      vapi.stop();
    }
    setCallState("idle");
    setErrorMessage(null);
    setTranscript([]);
    setLiveTranscript("");
    currentTurnIdRef.current = 0;
    // Small delay to allow stop to complete
    await new Promise((r) => setTimeout(r, 300));
    await startCall();
  }, [callState, startCall]);

  // ---------------------------------------------------------------------------
  // Auto-transition "ended" → "idle" after a brief pause
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (callState !== "ended") return;
    const timer = setTimeout(() => {
      setCallState("idle");
    }, 2000);
    return () => clearTimeout(timer);
  }, [callState]);

  return {
    callState,
    isMuted,
    volumeLevel,
    localVolumeLevel,
    transcript,
    liveTranscript,
    errorMessage,
    activeLanguage,
    startCall,
    endCall,
    toggleMute,
    retryCall,
  };
};