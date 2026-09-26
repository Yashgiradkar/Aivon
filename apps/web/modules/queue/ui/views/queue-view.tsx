"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import {
  CheckCircle2Icon,
  ClockIcon,
  HeadsetIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  RadioIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

export const QueueView = () => {
  const queueEntries = useQuery(api.private.queue.getQueueList, { status: "all" });
  const agentPresence = useQuery(api.private.queue.getAgentPresence);
  const setPresence = useMutation(api.private.queue.setAgentPresence);
  const acceptEntry = useMutation(api.private.queue.acceptQueueEntry);
  const completeEntry = useMutation(api.private.queue.completeQueueEntry);

  const currentStatus = agentPresence?.status || "offline";

  const handlePresenceChange = async (status: "available" | "busy" | "offline") => {
    try {
      await setPresence({ status });
      toast.success(`Presence updated to ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update presence");
    }
  };

  const handleAccept = async (queueEntryId: any) => {
    try {
      await acceptEntry({ queueEntryId });
      toast.success("Customer accepted! Call initiated.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to accept customer");
    }
  };

  const handleComplete = async (queueEntryId: any) => {
    try {
      await completeEntry({ queueEntryId });
      toast.success("Call completed! Marked available for next customer.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete call");
    }
  };

  const waitingEntries = queueEntries?.filter((e) => e.status === "waiting") ?? [];
  const activeEntries =
    queueEntries?.filter(
      (e) =>
        e.status === "accepted" ||
        e.status === "connecting" ||
        e.status === "connected"
    ) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40 p-6 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Header & Operator Presence */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Support Queue</h1>
            <p className="text-sm text-muted-foreground">
              Manage live customer escalations, queue routing, and voice callbacks
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border bg-background p-2 shadow-sm">
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  currentStatus === "available"
                    ? "bg-green-500 animate-pulse"
                    : currentStatus === "busy" || currentStatus === "on_call"
                    ? "bg-amber-500"
                    : "bg-muted-foreground"
                }`}
              />
              <span className="text-xs font-medium text-muted-foreground">My Status:</span>
            </div>
            <Select
              value={currentStatus === "on_call" ? "busy" : currentStatus}
              onValueChange={(val) =>
                handlePresenceChange(val as "available" | "busy" | "offline")
              }
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">🟢 Available</SelectItem>
                <SelectItem value="busy">🟡 Busy</SelectItem>
                <SelectItem value="offline">⚪️ Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Waiting in Queue</CardTitle>
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{waitingEntries.length}</div>
              <p className="text-xs text-muted-foreground">Customers awaiting human assistance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Calls</CardTitle>
              <RadioIcon className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeEntries.length}</div>
              <p className="text-xs text-muted-foreground">Calls currently in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">~3 min</div>
              <p className="text-xs text-muted-foreground">Automated FIFO dispatch</p>
            </CardContent>
          </Card>
        </div>

        {/* Active / Assigned Calls */}
        {activeEntries.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PhoneCallIcon className="h-5 w-5 text-green-600" />
              Active Calls & Assigned Customers
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {activeEntries.map((entry) => (
                <Card key={entry._id} className="border-green-500/30 bg-green-500/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-green-600 text-green-700 bg-green-100">
                          {entry.status.toUpperCase()}
                        </Badge>
                        <span className="font-semibold text-sm">{entry.customerName}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Assigned to: {entry.assignedAgentName || "You"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {entry.aiSummary && (
                      <div className="rounded-md border bg-background p-2.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 font-medium text-foreground mb-1">
                          <SparklesIcon className="h-3 w-3 text-primary" />
                          AI Escalation Context:
                        </div>
                        {entry.aiSummary}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <Link
                        href={`/conversations/${entry.conversationId}`}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <MessageSquareIcon className="h-3.5 w-3.5" />
                        Open Conversation
                      </Link>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 text-xs gap-1"
                        onClick={() => handleComplete(entry._id)}
                      >
                        <CheckCircle2Icon className="h-3.5 w-3.5" />
                        Complete Call
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Waiting Queue List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            Waiting Customers ({waitingEntries.length})
          </h2>

          {waitingEntries.length === 0 ? (
            <Card className="py-12 text-center text-muted-foreground">
              <CheckCircle2Icon className="mx-auto h-8 w-8 text-green-500 mb-2" />
              <p className="font-medium text-foreground">Queue is clear!</p>
              <p className="text-xs">All customers are currently being served or resolved by AI.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {waitingEntries.map((entry, idx) => (
                <Card key={entry._id} className="transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-xs text-primary">
                          #{idx + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{entry.customerName}</span>
                            <span className="text-xs text-muted-foreground">({entry.customerEmail})</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase ${
                                entry.priority === "urgent"
                                  ? "border-red-500 text-red-600 bg-red-50"
                                  : entry.priority === "high"
                                  ? "border-amber-500 text-amber-600 bg-amber-50"
                                  : "border-muted text-muted-foreground"
                              }`}
                            >
                              {entry.priority}
                            </Badge>
                            {entry.isCallback && (
                              <Badge variant="secondary" className="text-[10px]">
                                Callback ({entry.callbackPhoneNumber})
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Waiting since {formatDistanceToNow(entry.joinedAt, { addSuffix: true })}
                          </p>

                          {entry.aiSummary && (
                            <div className="mt-2 rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground flex items-center gap-1">
                                <SparklesIcon className="h-3 w-3 text-primary inline" /> AI Summary:
                              </span>
                              {entry.aiSummary}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/conversations/${entry.conversationId}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                            <MessageSquareIcon className="h-3.5 w-3.5" />
                            View Chat
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 bg-primary text-primary-foreground"
                          onClick={() => handleAccept(entry._id)}
                        >
                          <HeadsetIcon className="h-3.5 w-3.5" />
                          Accept & Call
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
