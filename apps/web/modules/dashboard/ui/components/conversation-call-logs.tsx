"use client";

import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { PhoneCallIcon, ClockIcon, CheckCircle2Icon, PhoneOffIcon, FileTextIcon, RadioIcon } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface ConversationCallLogsProps {
  conversationId: Id<"conversations">;
}

export const ConversationCallLogs = ({ conversationId }: ConversationCallLogsProps) => {
  const callLogs = useQuery(api.private.queue.getCallLogs, { conversationId });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
            <RadioIcon className="size-3 animate-pulse text-emerald-500" />
            Live Call
          </span>
        );
      case "ended":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border">
            <CheckCircle2Icon className="size-3 text-muted-foreground" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-500 border border-rose-500/20">
            <PhoneOffIcon className="size-3 text-rose-500" />
            Missed / Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
            <PhoneCallIcon className="size-3 text-amber-500" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="my-3 space-y-2 px-4">
      {callLogs.map((call) => (
        <div
          key={call._id}
          className="rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-sm transition-all hover:border-border"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PhoneCallIcon className="size-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  Voice Support Session
                </span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {format(call.startedAt, "MMM d, h:mm a")}
                </span>
              </div>
            </div>
            {getStatusBadge(call.status)}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {call.durationSeconds !== undefined && call.durationSeconds > 0 && (
              <div className="flex items-center gap-1">
                <ClockIcon className="size-3" />
                <span>Duration: <strong className="font-medium text-foreground">{formatDuration(call.durationSeconds)}</strong></span>
              </div>
            )}
            {call.agentId && (
              <div>
                <span>Specialist: <strong className="font-medium text-foreground">{call.agentId}</strong></span>
              </div>
            )}
          </div>

          {call.transcriptSummary && (
            <div className="mt-2.5 rounded-lg bg-muted/60 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                <FileTextIcon className="size-3 text-primary" />
                <span>AI Call Summary</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {call.transcriptSummary}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
