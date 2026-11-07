"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { Id } from "@workspace/backend/_generated/dataModel";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  FileTextIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

interface Props {
  conversationId: Id<"conversations">;
  contactSessionId: Id<"contactSessions">;
}

export const WidgetSourceAttribution = ({
  conversationId,
  contactSessionId,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const lineageRecords = useQuery(api.public.audit.getLineageForConversation, {
    conversationId,
    contactSessionId,
  });

  if (!lineageRecords || lineageRecords.length === 0) {
    return null;
  }

  const latestRecord = lineageRecords[0];
  if (!latestRecord || !latestRecord.hasEvidence || !latestRecord.retrievedEvidence?.length) {
    return null;
  }

  return (
    <div className="border-b bg-card/40 px-3 py-1.5 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle2Icon className="size-3.5 text-emerald-500" />
          <span className="text-[11px] font-medium text-foreground">
            Verified Source Attribution ({latestRecord.retrievedEvidence.length})
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px] text-muted-foreground"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <>
              Hide <ChevronUpIcon className="ml-1 size-3" />
            </>
          ) : (
            <>
              View Sources <ChevronDownIcon className="ml-1 size-3" />
            </>
          )}
        </Button>
      </div>

      {isOpen && (
        <div className="mt-2 space-y-1.5 border-t pt-2">
          {latestRecord.retrievedEvidence.map((ev, idx) => (
            <div
              key={idx}
              className="rounded-md border bg-background/90 p-2 text-[11px]"
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-semibold text-foreground flex items-center gap-1 truncate">
                  <FileTextIcon className="size-3 text-primary shrink-0" />
                  {ev.documentName}
                </span>
                {ev.pageNumber && (
                  <Badge variant="outline" className="text-[9px] shrink-0 font-medium">
                    Page {ev.pageNumber}
                  </Badge>
                )}
              </div>
              <p className="line-clamp-2 text-[10px] text-muted-foreground italic bg-muted/40 p-1 rounded">
                "{ev.snippet}"
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

