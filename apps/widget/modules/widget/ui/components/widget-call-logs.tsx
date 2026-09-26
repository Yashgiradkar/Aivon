"use client";

import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { PhoneCallIcon, ClockIcon, CheckCircle2Icon, PhoneOffIcon, RadioIcon, SparklesIcon } from "lucide-react";
import { format } from "date-fns";

interface WidgetCallLogsProps {
  conversationId: Id<"conversations">;
  contactSessionId: Id<"contactSessions">;
}

export const WidgetCallLogs = ({ conversationId, contactSessionId }: WidgetCallLogsProps) => {
  const callLogs = useQuery(api.public.queue.getCallLogs, {
    conversationId,
    contactSessionId,
  });

  if (!callLogs || callLogs.length === 0) {
    return null;
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="my-2 space-y-2 px-3">
      {callLogs.map((call) => (
        <div
          key={call._id}
          className="rounded-xl border border-border/80 bg-background/95 p-3 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <PhoneCallIcon className="size-3" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">
                  Voice Support Call
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(call.startedAt, "MMM d, h:mm a")}
                </p>
              </div>
            </div>
            {call.status === "ended" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <CheckCircle2Icon className="size-3 text-muted-foreground" />
                Completed
              </span>
            ) : call.status === "in_progress" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
                <RadioIcon className="size-3 animate-pulse text-emerald-500" />
                Live Call
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-500 border border-rose-500/20">
                <PhoneOffIcon className="size-3 text-rose-500" />
                {call.status}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            {call.durationSeconds !== undefined && call.durationSeconds > 0 && (
              <div className="flex items-center gap-1">
                <ClockIcon className="size-3 text-muted-foreground" />
                <span>Duration: <strong className="font-medium text-foreground">{formatDuration(call.durationSeconds)}</strong></span>
              </div>
            )}
          </div>

          {call.transcriptSummary && (
            <div className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">
              <div className="flex items-center gap-1 font-medium text-foreground mb-0.5">
                <SparklesIcon className="size-3 text-primary" />
                <span className="text-[11px]">Call Summary</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {call.transcriptSummary}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
