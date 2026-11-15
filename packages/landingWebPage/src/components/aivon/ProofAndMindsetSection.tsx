import React from "react";
import { proofMetrics, engineerPillars } from "./data";

export const ProofAndMindsetSection: React.FC = () => {
  return (
    <div className="w-full space-y-16">
      {/* ── 1. NUMBERS / EVIDENCE SECTION ──────────────────────── */}
      <div className="space-y-8">
        <div className="space-y-3">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-md"
            style={{ background: "rgba(79,140,255,0.08)", border: "1px solid var(--accent-border)" }}
          >
            <span
              className="font-mono text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--accent-soft)" }}
            >
              Verification &amp; Capabilities
            </span>
          </div>

          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            Measured outcomes.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
              Architectural proof.
            </span>
          </h3>

          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Benchmarks and structural facts, labeled as such. No vanity numbers.
          </p>
        </div>

        {/* 6 Proof Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {proofMetrics.map((metric) => (
            <div
              key={metric.label}
              className="p-4 rounded-xl flex flex-col justify-between transition-colors card-toplight"
              style={{
                background: "linear-gradient(to bottom, var(--surface-card-alt), var(--surface-card))",
                border: "1px solid var(--border-neutral)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-border)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-neutral)";
              }}
            >
              <div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-secondary block w-fit mb-2">
                  {metric.type}
                </span>
                <p className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] to-white">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs font-bold text-white">{metric.label}</p>
              </div>

              <p
                className="mt-3 pt-2 text-[10px] font-mono text-secondary leading-snug"
                style={{ borderTop: "1px solid var(--border-neutral)" }}
              >
                {metric.sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. WHAT THIS SAYS ABOUT HOW I ENGINEER ─────────────── */}
      <div className="space-y-8 pt-10 border-t border-white/[0.08]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md"
              style={{ background: "rgba(79,140,255,0.08)", border: "1px solid var(--accent-border)" }}
            >
              <span
                className="font-mono text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--accent-soft)" }}
              >
                Engineering Mindset
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-secondary border border-white/10">
              Verified in Production
            </span>
          </div>

          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            How I engineer.
          </h3>

          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Cohesion, resilience, security boundaries, and user experience. In every layer.
          </p>
        </div>

        {/* 6 Pillar Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {engineerPillars.map((pillar) => (
            <div
              key={pillar.num}
              className="p-5 rounded-xl flex flex-col justify-between group transition-all card-toplight"
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-neutral)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-border)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-neutral)";
              }}
            >
              <div>
                <div
                  className="flex items-center justify-between pb-3"
                  style={{ borderBottom: "1px solid var(--border-neutral)" }}
                >
                  {/* Pillar number — accent-soft */}
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: "var(--accent-soft)" }}
                  >
                    {pillar.num}
                  </span>
                  {/* "PILLAR" label — accent-soft */}
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest font-bold"
                    style={{ color: "var(--accent-soft)", opacity: 0.6 }}
                  >
                    Pillar
                  </span>
                </div>

                <h4 className="mt-3 text-base font-bold text-white group-hover:text-[#7FB2FF] transition-colors">
                  {pillar.title}
                </h4>

                {/* Quote line — accent-primary at ~90% opacity */}
                <p
                  className="mt-1 text-xs font-medium leading-snug"
                  style={{ color: "rgba(79,140,255,0.9)" }}
                >
                  &ldquo;{pillar.summary}&rdquo;
                </p>

                <p className="mt-3 text-secondary text-xs leading-relaxed font-mono">
                  {pillar.detail}
                </p>
              </div>

              <div
                className="mt-4 pt-3 flex items-center justify-between text-[10px] font-mono"
                style={{ borderTop: "1px solid var(--border-neutral)" }}
              >
                {/* Micro-label per pillar */}
                <span style={{ color: "var(--accent-soft)", opacity: 0.6 }}>{pillar.microLabel}</span>
                {/* ✦ icon — accent-soft low opacity */}
                <span style={{ color: "var(--accent-soft)", opacity: 0.5 }}>✦</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. FINAL STORY STATEMENT ────────────────────────────── */}
      <div
        className="p-8 sm:p-12 rounded-3xl relative overflow-hidden card-toplight"
        style={{
          background: "linear-gradient(145deg, var(--surface-thesis-from), var(--surface-thesis-to))",
          border: "1px solid var(--accent-border)",
          boxShadow: "0 20px 80px -20px rgba(37,99,235,0.15)",
        }}
      >
        {/* Subtle radial blue glow top-right */}
        <div
          className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
          style={{
            background: "radial-gradient(circle at top right, rgba(79,140,255,0.08), transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-4xl space-y-6">
          {/* "THE PRODUCTION THESIS" label — accent-soft */}
          <span
            className="text-xs font-mono font-bold uppercase tracking-widest"
            style={{ color: "var(--accent-soft)" }}
          >
            The Production Thesis
          </span>

          <blockquote className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed tracking-tight">
            &ldquo;Adding AI to an app is easy.
            <br />
            {/* Gradient text from #7FB2FF to #4F8CFF */}
            <span className="text-gradient-blue">
              Engineering one that can safely use AI, retrieve the right knowledge, take actions, involve humans, serve many organizations, protect customer data, run in real time, and operate as a product,
            </span>
            <br />
            that&apos;s the engineering problem.&rdquo;
          </blockquote>

          <div
            className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{ borderTop: "1px solid var(--border-neutral)" }}
          >
            <div>
              <p
                className="text-lg sm:text-xl font-bold"
                style={{ color: "var(--accent-soft)" }}
              >
                Aivon is my answer to that problem.
              </p>
              <p className="text-secondary text-xs font-mono mt-0.5">
                Full-stack. Multi-tenant. Real-time. AI customer support.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://aivon-dashboard.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider"
              >
                Launch Dashboard ↗
              </a>
              <a
                href="https://github.com/Yashgiradkar/Aivon"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-5 py-2.5 rounded-xl font-medium text-xs"
              >
                Inspect Code on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
