"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import {
  ArrowLeftIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  MessageSquareIcon,
} from "lucide-react";
import { useVapi, VoiceCallState, TranscriptMessage } from "@/modules/widget/hooks/use-vapi";
import { WidgetHeader } from "@/modules/widget/ui/components/widget-header";
import { useAtomValue, useSetAtom } from "jotai";
import { conversationIdAtom, screenAtom, widgetSettingsAtom } from "../../atoms/widget-atoms";
import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// State config — labels and colours for each call state
// ---------------------------------------------------------------------------

const STATE_CONFIG: Record<
  VoiceCallState,
  { label: string; subLabel?: string; color: string; pulse: boolean }
> = {
  idle: {
    label: "Ready",
    subLabel: "Press start to begin voice chat",
    color: "bg-muted-foreground/30",
    pulse: false,
  },
  "requesting-microphone": {
    label: "Requesting Microphone…",
    subLabel: "Please allow microphone access",
    color: "bg-amber-400",
    pulse: true,
  },
  connecting: {
    label: "Connecting…",
    subLabel: "Establishing secure connection",
    color: "bg-blue-400",
    pulse: true,
  },
  connected: {
    label: "Connected",
    subLabel: "Listening for your voice",
    color: "bg-green-500",
    pulse: false,
  },
  listening: {
    label: "Listening…",
    subLabel: "Speak now",
    color: "bg-green-500",
    pulse: true,
  },
  speaking: {
    label: "AI Speaking…",
    subLabel: "AI is responding",
    color: "bg-primary",
    pulse: true,
  },
  muted: {
    label: "Muted",
    subLabel: "Tap mic to unmute",
    color: "bg-amber-500",
    pulse: false,
  },
  ending: {
    label: "Ending Call…",
    subLabel: "",
    color: "bg-muted-foreground/30",
    pulse: false,
  },
  ended: {
    label: "Call Ended",
    subLabel: "Thank you for using voice support",
    color: "bg-muted-foreground/30",
    pulse: false,
  },
  error: {
    label: "Connection Error",
    subLabel: "",
    color: "bg-destructive",
    pulse: false,
  },
};

// ---------------------------------------------------------------------------
// AudioOrb — animated orb showing assistant audio level
// ---------------------------------------------------------------------------

function AudioOrb({
  volumeLevel,
  localVolumeLevel,
  callState,
}: {
  volumeLevel: number;
  localVolumeLevel: number;
  callState: VoiceCallState;
}) {
  const { color, pulse } = STATE_CONFIG[callState];
  const isActive = callState === "listening" || callState === "speaking" || callState === "muted" || callState === "connected";

  // Scale based on active audio level
  const activeLevel = callState === "speaking" ? volumeLevel : localVolumeLevel;
  const scale = isActive ? 1 + activeLevel * 0.4 : 1;
  const ringOpacity = isActive ? 0.15 + activeLevel * 0.35 : 0.1;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {/* Outer pulse ring — driven by audio level */}
      {isActive && (
        <>
          <div
            className={cn("absolute rounded-full transition-all duration-75", color)}
            style={{
              width: 120,
              height: 120,
              opacity: ringOpacity,
              transform: `scale(${scale})`,
            }}
          />
          <div
            className={cn("absolute rounded-full transition-all duration-150", color)}
            style={{
              width: 90,
              height: 90,
              opacity: ringOpacity * 1.5,
              transform: `scale(${1 + activeLevel * 0.25})`,
            }}
          />
        </>
      )}
      {/* Center orb */}
      <div
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          color,
          pulse && activeLevel === 0 && "animate-pulse"
        )}
      >
        {callState === "error" ? (
          <AlertCircleIcon className="h-7 w-7 text-white" />
        ) : callState === "muted" ? (
          <MicOffIcon className="h-7 w-7 text-white" />
        ) : callState === "ending" || callState === "ended" ? (
          <PhoneOffIcon className="h-7 w-7 text-white" />
        ) : callState === "idle" || callState === "requesting-microphone" ? (
          <MicIcon className="h-7 w-7 text-white" />
        ) : callState === "connecting" ? (
          <RefreshCwIcon className="h-7 w-7 animate-spin text-white" />
        ) : (
          <MicIcon className="h-7 w-7 text-white" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TranscriptList — shows voice conversation transcript
// ---------------------------------------------------------------------------

function TranscriptList({
  transcript,
  liveTranscript,
}: {
  transcript: TranscriptMessage[];
  liveTranscript: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, liveTranscript]);

  if (transcript.length === 0 && !liveTranscript) {
    return null;
  }

  return (
    <div className="flex max-h-48 w-full flex-col gap-y-2 overflow-y-auto px-4 py-2">
      {transcript.map((msg, i) => (
        <div
          key={`${msg.role}-${i}`}
          className={cn(
            "flex max-w-[80%] flex-col gap-y-0.5",
            msg.role === "user" ? "self-end items-end" : "self-start items-start"
          )}
        >
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {msg.role === "user" ? "You" : "AI"}
          </span>
          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-xs leading-relaxed",
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            )}
          >
            {msg.text}
          </div>
        </div>
      ))}
      {/* Live partial transcript */}
      {liveTranscript && (
        <div className="flex max-w-[80%] flex-col gap-y-0.5 self-end items-end">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            You
          </span>
          <div className="rounded-2xl rounded-br-sm bg-primary/60 px-3 py-2 text-xs text-primary-foreground italic leading-relaxed">
            {liveTranscript}…
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export const WidgetVoiceScreen = () => {
  const setScreen = useSetAtom(screenAtom);
  const conversationId = useAtomValue(conversationIdAtom);
  const widgetSettings = useAtomValue(widgetSettingsAtom);

  const {
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
  } = useVapi();

  const config = STATE_CONFIG[callState];
  const isInCall =
    callState === "connected" ||
    callState === "listening" ||
    callState === "speaking" ||
    callState === "muted";
  const isIdle = callState === "idle" || callState === "ended";
  const isLoading =
    callState === "requesting-microphone" ||
    callState === "connecting" ||
    callState === "ending";
  const hasTranscript = transcript.length > 0 || !!liveTranscript;

  const handleBack = () => {
    if (isInCall) {
      endCall();
    }
    // Navigate back to selection or chat
    if (conversationId) {
      setScreen("chat");
    } else {
      setScreen("selection");
    }
  };

  return (
    <>
      {/* Header */}
      <WidgetHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <Button
              variant="transparent"
              size="icon"
              onClick={handleBack}
              disabled={callState === "ending"}
              aria-label="Go back"
            >
              <ArrowLeftIcon />
            </Button>
            <p className="font-medium">
              {widgetSettings?.vapiSettings?.assistantId
                ? "Voice Support"
                : "Voice Chat"}
            </p>
          </div>
          {/* Switch to text chat */}
          {conversationId && (
            <Button
              variant="transparent"
              size="icon"
              onClick={() => {
                if (isInCall) endCall();
                setScreen("chat");
              }}
              aria-label="Switch to text chat"
              title="Switch to text chat"
            >
              <MessageSquareIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </WidgetHeader>

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-y-6 overflow-hidden px-4 py-6">
        {/* Animated audio orb */}
        <AudioOrb
          volumeLevel={volumeLevel}
          localVolumeLevel={localVolumeLevel}
          callState={callState}
        />

        {/* State labels */}
        <div className="flex flex-col items-center gap-y-1 text-center px-4">
          <p className="text-base font-semibold text-foreground">{config.label}</p>
          {callState === "error" ? (
            <p className="max-w-xs text-xs text-destructive leading-relaxed">
              {errorMessage ?? config.subLabel}
            </p>
          ) : (
            config.subLabel && (
              <p className="text-xs text-muted-foreground">{config.subLabel}</p>
            )
          )}
        </div>

        {/* Transcript */}
        {hasTranscript && (
          <div className="w-full rounded-xl border bg-background/80">
            <TranscriptList
              transcript={transcript}
              liveTranscript={liveTranscript}
            />
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="border-t bg-background px-4 py-4">
        <div className="flex flex-col gap-y-3">
          {/* In-call controls: Mute + End */}
          {isInCall && (
            <div className="flex items-center gap-x-3">
              {/* Mute toggle */}
              <Button
                variant={isMuted ? "destructive" : "outline"}
                size="icon"
                className="h-12 w-12 shrink-0 rounded-full"
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? (
                  <MicOffIcon className="h-5 w-5" />
                ) : (
                  <MicIcon className="h-5 w-5" />
                )}
              </Button>

              {/* End call */}
              <Button
                className="h-12 flex-1 rounded-full"
                size="lg"
                variant="destructive"
                onClick={endCall}
                aria-label="End call"
              >
                <PhoneOffIcon className="mr-2 h-5 w-5" />
                End Call
              </Button>
            </div>
          )}

          {/* Idle / ended: Start call */}
          {isIdle && (
            <Button
              className="h-12 w-full rounded-full"
              size="lg"
              onClick={startCall}
              aria-label="Start voice call"
            >
              <MicIcon className="mr-2 h-5 w-5" />
              Start Voice Call
            </Button>
          )}

          {/* Loading: disabled state */}
          {isLoading && (
            <Button
              className="h-12 w-full rounded-full"
              size="lg"
              disabled
              aria-label={config.label}
            >
              <RefreshCwIcon className="mr-2 h-5 w-5 animate-spin" />
              {config.label}
            </Button>
          )}

          {/* Error: Retry */}
          {callState === "error" && (
            <div className="flex flex-col gap-y-2">
              <Button
                className="h-12 w-full rounded-full"
                size="lg"
                onClick={retryCall}
                aria-label="Retry voice call"
              >
                <RefreshCwIcon className="mr-2 h-5 w-5" />
                Try Again
              </Button>
              <Button
                className="h-10 w-full rounded-full"
                size="sm"
                variant="ghost"
                onClick={() => setScreen(conversationId ? "chat" : "selection")}
                aria-label="Go back"
              >
                {conversationId ? "Back to Chat" : "Back to Options"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};