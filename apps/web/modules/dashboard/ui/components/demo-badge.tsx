"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/backend/_generated/api";
import { SparklesIcon, ShieldAlertIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const DemoBadge = () => {
  const isDemo = useQuery(api.private.demo.isDemoOrganization);
  const initDemo = useMutation(api.private.demo.initDemoData);
  const [isResetting, setIsResetting] = useState(false);

  // Auto-seed synthetic data if this is a demo organization
  useEffect(() => {
    if (isDemo) {
      initDemo().catch(console.error);
    }
  }, [isDemo, initDemo]);

  if (!isDemo) return null;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await initDemo();
      toast.success("Demo data re-initialized!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reset demo data");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-300">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
        <span className="font-semibold tracking-wider uppercase">
          DEMO MODE · Synthetic Data
        </span>
        <span className="hidden md:inline text-muted-foreground">
          — Recruiter preview with isolated session and read-safe controls.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-2 text-[11px] text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
          onClick={handleReset}
          disabled={isResetting}
        >
          <RefreshCwIcon className={`h-3 w-3 ${isResetting ? "animate-spin" : ""}`} />
          Reset Demo Data
        </Button>
      </div>
    </div>
  );
};
