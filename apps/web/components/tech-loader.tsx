"use client";

import { useEffect, useState } from "react";
import { CpuIcon, SparklesIcon, LayersIcon, NetworkIcon, DatabaseIcon, TerminalIcon } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

export interface TechFact {
  category: "Distributed Systems" | "Next.js & React" | "Convex & Real-time" | "AI & Vector Search" | "Compilers & V8" | "Network & Protocols";
  fact: string;
  icon: typeof CpuIcon;
}

export const TECH_FACTS: TechFact[] = [
  {
    category: "Convex & Real-time",
    fact: "Convex maintains real-time reactivity via deterministic state machines and Raft consensus, pushing updates to active client WebSocket subscriptions in under 15ms.",
    icon: DatabaseIcon,
  },
  {
    category: "Next.js & React",
    fact: "React Server Components (RSC) serialize component trees into a compact wire stream, allowing data fetching without sending database drivers or secrets to the browser.",
    icon: LayersIcon,
  },
  {
    category: "AI & Vector Search",
    fact: "Dense vector embeddings project natural language into a 1536-dimensional manifold where cosine similarity mirrors semantic intent rather than literal keyword matching.",
    icon: SparklesIcon,
  },
  {
    category: "Network & Protocols",
    fact: "HTTP/3 operates over QUIC (UDP), eliminating TCP head-of-line blocking so lost packets on one stream never stall concurrent transfers on another.",
    icon: NetworkIcon,
  },
  {
    category: "Distributed Systems",
    fact: "The Raft consensus algorithm decomposes state machine replication into leader election, log replication, and safety guarantees, proving formal equivalence to Multi-Paxos.",
    icon: CpuIcon,
  },
  {
    category: "Compilers & V8",
    fact: "Modern V8 engines use the Ignition interpreter paired with the TurboFan JIT compiler to profile hot execution paths and compile bytecode directly into optimized machine code.",
    icon: TerminalIcon,
  },
  {
    category: "Next.js & React",
    fact: "Next.js App Router route transitions use React 19 concurrent transitions to decouple CPU reconciliation from UI paint, preventing input latency degradation.",
    icon: LayersIcon,
  },
  {
    category: "AI & Vector Search",
    fact: "Hybrid search combines dense vector cosine rankings with exact lexical keyword indexes (BM25) to simultaneously resolve fuzzy semantic queries and exact policy IDs.",
    icon: SparklesIcon,
  },
  {
    category: "Distributed Systems",
    fact: "Content-addressable storage keys assets by SHA-256 cryptographic hashes, enabling deterministic deduplication and immutable caching at edge CDNs worldwide.",
    icon: NetworkIcon,
  },
];

interface TechLoaderProps {
  /** Optional title to display above the loader */
  title?: string;
  /** Optional description */
  description?: string;
  /** Whether to render in compact mode (e.g. for cards, dialogs, or tables) */
  compact?: boolean;
  /** Milliseconds before showing loader to prevent flicker on instantaneous sub-100ms responses (default: 150) */
  delayMs?: number;
  /** How long each fact remains visible before rotating in milliseconds (default: 4000) */
  intervalMs?: number;
  /** Additional CSS class names */
  className?: string;
}

export const TechLoader = ({
  title = "Initializing Experience",
  description = "Synchronizing reactive state...",
  compact = false,
  delayMs = 150,
  intervalMs = 4200,
  className,
}: TechLoaderProps) => {
  const [shouldRender, setShouldRender] = useState(delayMs === 0);
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * TECH_FACTS.length));
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Debounce mounting to eliminate flicker on sub-100ms queries
  useEffect(() => {
    if (delayMs === 0) return;
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  // Rotate facts smoothly with transition using single interval timer
  useEffect(() => {
    if (!shouldRender) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setFactIndex((prev) => (prev + 1) % TECH_FACTS.length);
        setIsTransitioning(false);
      }, 250);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [shouldRender, intervalMs]);

  if (!shouldRender) {
    return null;
  }

  const currentFact: TechFact = TECH_FACTS[factIndex] ?? (TECH_FACTS[0] as TechFact);
  const IconComponent = currentFact.icon;

  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex flex-col items-center justify-center p-6 text-center text-muted-foreground",
          className
        )}
      >
        <div className="relative mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
          <div className="absolute inset-0 animate-ping rounded-xl bg-primary/10 opacity-75" />
          <IconComponent className="size-5 relative z-10" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {currentFact.category}
        </p>
        <p
          className={cn(
            "mt-1 max-w-sm text-xs text-muted-foreground transition-opacity duration-300",
            isTransitioning ? "opacity-0" : "opacity-100"
          )}
        >
          {currentFact.fact}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-[340px] w-full flex-1 flex-col items-center justify-center p-8",
        className
      )}
    >
      <div className="relative flex flex-col items-center max-w-md w-full rounded-2xl border border-border/60 bg-background/80 p-6 shadow-sm backdrop-blur-md">
        {/* Animated glowing chip icon */}
        <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent border border-primary/30 text-primary shadow-[0_0_20px_rgba(59,130,246,0.15)]">
          <div className="absolute inset-0 rounded-2xl animate-pulse bg-primary/5" />
          <IconComponent className="size-7 relative z-10 text-primary transition-transform duration-300" />
        </div>

        {/* Header Title & Subtitle */}
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>

        {/* Fact Card container */}
        <div className="mt-5 w-full rounded-xl border border-border/80 bg-muted/40 p-3.5 text-left relative overflow-hidden">
          {/* Hardware-accelerated CSS progress bar */}
          <div
            key={factIndex}
            className="absolute top-0 left-0 h-0.5 bg-primary/70 animate-tech-progress"
            style={{ animationDuration: `${intervalMs}ms` }}
          />

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <SparklesIcon className="size-3" />
            <span>TECH INSIGHT &bull; {currentFact.category.toUpperCase()}</span>
          </div>

          <p
            className={cn(
              "mt-1.5 text-xs text-foreground/80 leading-relaxed min-h-[48px] transition-all duration-300",
              isTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            )}
          >
            {currentFact.fact}
          </p>
        </div>

        {/* Minimal rotating dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {TECH_FACTS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === factIndex ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
