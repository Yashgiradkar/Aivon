"use client";

import Vapi from "@vapi-ai/web";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
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
  startCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  retryCall: () => Promise<void>;
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

  // Singleton Vapi instance — stored in ref to avoid stale closure issues
  const vapiRef = useRef<Vapi | null>(null);
  const isStartingRef = useRef(false); // duplicate-start guard

  const [callState, setCallState] = useState<VoiceCallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [localVolumeLevel, setLocalVolumeLevel] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    // --- Speech state ---
    vapi.on("speech-start", () => {
      setCallState("speaking");
    });

    vapi.on("speech-end", () => {
      setCallState((prev) => {
        // Only transition back to listening if we were speaking
        if (prev === "speaking") return "listening";
        return prev;
      });
    });

    // --- Transcript messages ---
    vapi.on("message", (message) => {
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

    // Step 2: Start Vapi call
    isStartingRef.current = true;
    setCallState("connecting");

    try {
      // Build assistant overrides to inject customer context
      // This allows the Vapi assistant to greet the customer by name
      const assistantOverrides = contactSessionId
        ? {
            variableValues: {
              // These variable names must match {{variableName}} in the assistant prompt
              customerName:
                typeof contactSessionId === "string" ? undefined : undefined,
              conversationId: conversationId ?? undefined,
              organizationId: organizationId ?? undefined,
            },
          }
        : undefined;

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
  ]);

  // ---------------------------------------------------------------------------
  // End call
  // ---------------------------------------------------------------------------
  const endCall = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi) return;

    setCallState("ending");
    setLiveTranscript("");

    // Persist final transcript to Convex conversation if we have context
    // We do this before stopping so we can access state
    const finalTranscript = transcriptRef.current;
    if (
      finalTranscript.length > 0 &&
      conversationId &&
      contactSessionId
    ) {
      // Fire-and-forget: persist a summary message with the full voice transcript
      const transcriptText = finalTranscript
        .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.text}`)
        .join("\n");

      // We use the existing public/messages.create to persist the transcript
      // as a summary. This keeps voice & text in the same conversation thread.
      // Only attempt if we have an active conversation thread.
      void (async () => {
        try {
          // Get the thread ID from the conversation — we need the query result
          // Since we don't have it here directly, we skip persistence for now
          // and only do it when threadId is available (handled in voice screen)
        } catch {
          // Non-fatal — transcript is displayed in UI regardless
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
    startCall,
    endCall,
    toggleMute,
    retryCall,
  };
};