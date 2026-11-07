"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  FileTextIcon,
  LayersIcon,
  SparklesIcon,
  Volume2Icon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ActivityIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

interface Props {
  conversationId: Id<"conversations">;
}

export const ConversationSourceAttribution = ({ conversationId }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);

  const lineageRecords = useQuery(api.private.audit.getLineageByConversation, {
    conversationId,
  });

  const traceEvents = useQuery(
    api.private.audit.getAuditEventsByTrace,
    activeTraceId ? { traceId: activeTraceId } : "skip",
  );

  if (!lineageRecords || lineageRecords.length === 0) {
    return null;
  }

  const latestRecord = lineageRecords[0];
  const totalEvidenceItems = lineageRecords.reduce(
    (acc, r) => acc + (r.retrievedEvidence?.length || 0),
    0,
  );

  return (
    <div className="border-b bg-card/60 px-4 py-2.5 backdrop-blur-sm transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayersIcon className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                RAG Data Lineage & Citations
              </span>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-[10px] font-medium text-emerald-600 border-emerald-500/20"
              >
                <CheckCircle2Icon className="mr-1 size-3" />
                {totalEvidenceItems} Grounded Sources
              </Badge>
              {latestRecord?.channel === "voice" && (
                <Badge
                  variant="outline"
                  className="bg-cyan-500/10 text-[10px] text-cyan-600 border-cyan-500/20"
                >
                  <Volume2Icon className="mr-1 size-3" />
                  Voice + ElevenLabs
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Deterministic lineage linking AI generated answers to exact knowledge chunks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {latestRecord?.traceId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-muted-foreground/20"
              onClick={() => setActiveTraceId(latestRecord.traceId)}
            >
              <ActivityIcon className="size-3 text-primary" />
              Trace: {latestRecord.traceId.slice(0, 16)}...
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-muted-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                Hide Evidence <ChevronUpIcon className="size-3" />
              </>
            ) : (
              <>
                View Sources ({latestRecord?.retrievedEvidence?.length || 0}){" "}
                <ChevronDownIcon className="size-3" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Accordion of Evidence Lineage */}
      {isExpanded && latestRecord && (
        <div className="mt-3 space-y-2 border-t pt-2.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>
              Query: <strong className="text-foreground">"{latestRecord.userQuery}"</strong>
            </span>
            <span>
              Strategy: <Badge variant="secondary" className="text-[10px] font-mono">{latestRecord.effectiveStrategy}</Badge>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {latestRecord.retrievedEvidence.map((ev, idx) => (
              <div
                key={idx}
                className="rounded-lg border bg-background/80 p-2.5 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileTextIcon className="size-3.5 text-primary shrink-0" />
                    <span className="font-semibold truncate text-foreground">
                      {ev.documentName}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0 font-mono">
                    Score: {ev.score.toFixed(2)}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
                  {ev.pageNumber && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                      Page {ev.pageNumber}
                    </span>
                  )}
                  {ev.section && (
                    <span className="rounded bg-muted px-1.5 py-0.5 truncate max-w-[120px]">
                      {ev.section}
                    </span>
                  )}
                  {ev.chunkId && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground truncate max-w-[100px]">
                      {ev.chunkId}
                    </span>
                  )}
                  <span className="uppercase text-[9px] font-semibold text-primary/80">
                    {ev.contentType}
                  </span>
                </div>

                <p className="line-clamp-3 text-[11px] text-muted-foreground/90 italic bg-muted/30 p-1.5 rounded border border-muted/40">
                  "{ev.snippet}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trace Audit Trail Modal */}
      <Dialog
        open={Boolean(activeTraceId)}
        onOpenChange={(open) => {
          if (!open) setActiveTraceId(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheckIcon className="size-5 text-primary" />
              Centralized Audit Trail: {activeTraceId}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Correlated end-to-end processing stages, timestamps, token usage, and security evaluations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {traceEvents?.map((evt, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border bg-muted/20 p-2.5 text-xs"
              >
                <div
                  className={cn(
                    "mt-0.5 h-2 w-2 rounded-full",
                    evt.status === "success"
                      ? "bg-emerald-500"
                      : evt.status === "blocked"
                        ? "bg-red-500"
                        : "bg-amber-500",
                  )}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {evt.stage}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Type: {evt.eventType}</span>
                    <span>Channel: {evt.channel}</span>
                    {evt.latencyMs !== undefined && (
                      <span>Latency: {evt.latencyMs}ms</span>
                    )}
                    {evt.outputTokens !== undefined && (
                      <span>Tokens: {evt.outputTokens}</span>
                    )}
                  </div>
                  {evt.error && (
                    <p className="text-[11px] text-red-500 font-medium">
                      Error: {evt.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

