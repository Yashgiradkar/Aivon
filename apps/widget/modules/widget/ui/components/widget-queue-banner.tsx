"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { useAtomValue, useSetAtom } from "jotai";
import {
  contactSessionIdAtomFamily,
  conversationIdAtom,
  organizationIdAtom,
  screenAtom,
} from "../../atoms/widget-atoms";
import { Button } from "@workspace/ui/components/button";
import { Loader2Icon, PhoneCallIcon, UserCheckIcon, UsersIcon, XIcon } from "lucide-react";
import { useEffect } from "react";

export const WidgetQueueBanner = () => {
  const conversationId = useAtomValue(conversationIdAtom);
  const organizationId = useAtomValue(organizationIdAtom);
  const setScreen = useSetAtom(screenAtom);
  const contactSessionId = useAtomValue(
    contactSessionIdAtomFamily(organizationId || "")
  );

  const queueStatus = useQuery(
    api.public.queue.getQueueStatus,
    conversationId && contactSessionId
      ? {
          conversationId,
          contactSessionId,
        }
      : "skip"
  );

  const leaveQueue = useMutation(api.public.queue.leave);
  const heartbeat = useMutation(api.public.queue.heartbeat);

  // Send periodic heartbeat every 30s while queued
  useEffect(() => {
    if (!queueStatus || !contactSessionId || queueStatus.status !== "waiting") {
      return;
    }

    const interval = setInterval(() => {
      heartbeat({
        queueEntryId: queueStatus._id,
        contactSessionId,
      }).catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [queueStatus, contactSessionId, heartbeat]);

  if (!queueStatus) return null;

  // Active states
  const isWaiting = queueStatus.status === "waiting";
  const isAccepted = queueStatus.status === "accepted" || queueStatus.status === "connecting";
  const isOffered = queueStatus.status === "offered";

  if (!isWaiting && !isAccepted && !isOffered) return null;

  const handleLeave = async () => {
    if (!contactSessionId) return;
    try {
      await leaveQueue({
        queueEntryId: queueStatus._id,
        contactSessionId,
      });
    } catch (err) {
      console.error("Failed to leave queue:", err);
    }
  };

  const waitMinutes = Math.max(1, Math.ceil(queueStatus.estimatedWaitSeconds / 60));

  return (
    <div className="border-b bg-primary/10 px-3 py-2 text-xs transition-all">
      {isWaiting && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
              <UsersIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                You&apos;re <span className="text-primary font-semibold">#{queueStatus.position}</span> in the support queue
              </p>
              <p className="text-[11px] text-muted-foreground">
                Est. wait: ~{waitMinutes} min • You can continue chatting below
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleLeave}
          >
            Leave
          </Button>
        </div>
      )}

      {(isAccepted || isOffered) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-600">
              <UserCheckIcon className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                Specialist {queueStatus.assignedAgentName || "Agent"} is ready!
              </p>
              <p className="text-[11px] text-muted-foreground">
                Tap to connect your voice call now
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 rounded-full bg-green-600 px-3 text-xs text-white hover:bg-green-700"
            onClick={() => setScreen("voice")}
          >
            <PhoneCallIcon className="h-3 w-3" />
            Connect Call
          </Button>
        </div>
      )}
    </div>
  );
};
