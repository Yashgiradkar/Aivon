import React from "react";
import { proofMetrics, engineerPillars } from "./data";

export const ProofAndMindsetSection: React.FC = () => {
  return (
    <div className="w-full space-y-16">
      {/* ── 1. NUMBERS / EVIDENCE SECTION ──────────────────────── */}
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
            <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
              Verification & Capabilities
            </span>
          </div>

          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            Measured outcomes.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
              Architectural proof.
            </span>
          </h3>

          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Distinguishing empirical benchmark evidence from structural system capabilities.
            No marketing vanity numbers.
          </p>
        </div>

        {/* 6 Proof Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {proofMetrics.map((metric) => (
            <div
              key={metric.label}
              className="p-4 rounded-xl bg-gradient-to-b from-tertiary to-black-100 border border-white/[0.08] hover:border-gold/40 transition-colors flex flex-col justify-between"
            >
              <div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-secondary block w-fit mb-2">
                  {metric.type}
                </span>
                <p className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-white">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs font-bold text-white">{metric.label}</p>
              </div>

              <p className="mt-3 pt-2 border-t border-white/[0.05] text-[10px] font-mono text-secondary leading-snug">
                {metric.sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. WHAT THIS SAYS ABOUT HOW I ENGINEER ─────────────── */}
      <div className="space-y-8 pt-10 border-t border-white/[0.08]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
            <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
              Engineering Mindset
            </span>
          </div>

          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            What Aivon says about{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
              how I engineer.
            </span>
          </h3>

          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Every layer in Aivon reflects how I approach real-world software engineering: prioritizing
            system cohesion, resilience, security boundaries, and user experience.
          </p>
        </div>

        {/* 6 Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {engineerPillars.map((pillar) => (
            <div
              key={pillar.num}
              className="p-5 rounded-xl bg-black-100/90 border border-white/[0.07] hover:border-gold/40 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <span className="font-mono text-xs font-bold text-gold">{pillar.num}</span>
                  <span className="text-[10px] font-mono text-secondary uppercase tracking-widest font-bold">
                    Pillar
                  </span>
                </div>

                <h4 className="mt-3 text-base font-bold text-white group-hover:text-[#f2dfbd] transition-colors">
                  {pillar.title}
                </h4>

                <p className="mt-1 text-xs text-gold/90 font-medium leading-snug">
                  "{pillar.summary}"
                </p>

                <p className="mt-3 text-secondary text-xs leading-relaxed font-mono">
                  {pillar.detail}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-secondary">
                <span>Verified in Production</span>
                <span className="text-gold">✦</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. FINAL STORY STATEMENT ────────────────────────────── */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-tertiary via-black-100 to-[#1c160e] border border-gold/50 shadow-[0_20px_80px_-20px_rgba(214,168,75,0.25)] relative overflow-hidden">
        <div className="relative z-10 max-w-4xl space-y-6">
          <span className="text-xs font-mono font-bold text-gold uppercase tracking-widest">
            The Production Thesis
          </span>

          <blockquote className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed tracking-tight">
            "Adding AI to an application is easy.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
              Engineering an application that can safely use AI, retrieve the right knowledge, take actions,
              involve humans, serve multiple organizations, protect customer data, handle real-time communication,
              and operate as a product —
            </span>
            <br />
            that's the engineering problem."
          </blockquote>

          <div className="pt-4 border-t border-white/[0.1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-lg sm:text-xl font-bold text-[#f2dfbd]">
                Aivon is my answer to that problem.
              </p>
              <p className="text-secondary text-xs font-mono mt-0.5">
                Full-stack, multi-tenant, real-time AI customer support platform.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://aivon-dashboard.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold to-[#b9792e] text-[#17130e] font-bold text-xs uppercase tracking-wider shadow-lg hover:opacity-90 active:scale-95 transition-all"
              >
                Launch Dashboard ↗
              </a>
              <a
                href="https://github.com/Yashgiradkar/Aivon"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-tertiary border border-gold/40 text-white font-medium text-xs hover:border-gold transition-colors"
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

