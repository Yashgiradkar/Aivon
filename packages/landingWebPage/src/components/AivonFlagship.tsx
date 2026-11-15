import React from "react";
import { SimulatedEnvironment } from "./aivon/SimulatedEnvironment";
import { WhyStorySection } from "./aivon/WhyStorySection";
import { CoreSystemDiagram } from "./aivon/CoreSystemDiagram";
import { CapabilitiesSection } from "./aivon/CapabilitiesSection";
import { ArchitectureShowcase } from "./aivon/ArchitectureShowcase";
import { DecisionsAndStackSection } from "./aivon/DecisionsAndStackSection";
import { ProofAndMindsetSection } from "./aivon/ProofAndMindsetSection";

export const AivonFlagship: React.FC = () => {
  return (
    <section id="aivon-flagship" className="w-full space-y-24 pt-6 pb-12">
      {/* ── 1. THE OPENING / HERO ────────────────────────────────── */}
      <div className="space-y-8">
        {/* Eyebrow & Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary eyebrow — blue accent */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full"
            style={{
              background: "rgba(79,140,255,0.08)",
              border: "1px solid var(--accent-border)",
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: "var(--accent-primary)" }}
            />
            <span
              className="font-mono text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--accent-soft)" }}
            >
              FLAGSHIP / PRODUCTION AI SYSTEM
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-secondary text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            BUILT FROM THE GROUND UP
          </div>
        </div>

        {/* Large Dramatic Heading */}
        <div className="space-y-4 max-w-5xl">
          <h2 className="text-white font-black text-3xl sm:text-5xl lg:text-[56px] leading-[1.1] tracking-tight">
            AI is easy to demo.{" "}
            <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
              Production is the hard part.
            </span>
          </h2>

          <p className="text-white text-lg sm:text-xl font-medium leading-relaxed max-w-4xl">
            <strong>Aivon</strong> is a multi-tenant AI support platform that turns company knowledge into real-time, auditable customer conversations.
          </p>

          <p
            className="text-sm sm:text-base font-semibold leading-relaxed max-w-3xl"
            style={{ color: "var(--accent-soft)" }}
          >
            Every reply is traced to the PDF, table, chart, or image behind it. The hard cases go to a human.
          </p>
          <p className="text-secondary text-sm sm:text-base leading-relaxed max-w-3xl">
            Hybrid RAG, multimodal ingestion, a human queue, and OWASP-aligned controls. Already running in production code.
          </p>
        </div>

        {/* Quick Launch & Verification Strip */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl card-toplight"
          style={{
            background: "linear-gradient(135deg, var(--surface-card), var(--surface-card-alt))",
            border: "1px solid var(--accent-border)",
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm sm:text-base">Aivon Production Deployment</span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{
                  background: "rgba(79,140,255,0.12)",
                  color: "var(--accent-soft)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                Live on Vercel
              </span>
            </div>
            <p className="text-secondary text-xs font-mono">
              Dashboard: aivon-dashboard.vercel.app • Widget: aivon-chat.vercel.app
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
            <a
              href="https://aivon-dashboard.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0"
            >
              Launch Dashboard ↗
            </a>
            <a
              href="https://github.com/Yashgiradkar/Aivon"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 flex-shrink-0"
            >
              GitHub Source ↗
            </a>
          </div>
        </div>

        {/* ── INVESTOR SNAPSHOT BAND ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
          <div
            className="p-4 rounded-xl card-toplight space-y-1.5"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-neutral)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-secondary">
                The Problem
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            </div>
            <p className="text-white text-xs sm:text-sm font-bold">
              AI support fails in production.
            </p>
            <p className="text-secondary text-[11.5px] leading-relaxed">
              Hallucinations, data leaks, and dead-end bots.
            </p>
          </div>

          <div
            className="p-4 rounded-xl card-toplight space-y-1.5"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--accent-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-mono font-bold uppercase tracking-wider"
                style={{ color: "var(--accent-soft)" }}
              >
                The Platform
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--accent-primary)" }}
              />
            </div>
            <p className="text-white text-xs sm:text-sm font-bold">
              Grounded, multi-tenant, real-time.
            </p>
            <p className="text-secondary text-[11.5px] leading-relaxed">
              Answers from your knowledge, with a human on standby.
            </p>
          </div>

          <div
            className="p-4 rounded-xl card-toplight space-y-1.5"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-neutral)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-secondary">
                The Moat
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <p className="text-white text-xs sm:text-sm font-bold">
              Trust built into the architecture.
            </p>
            <p className="text-secondary text-[11.5px] leading-relaxed">
              Audit lineage, defense-in-depth, and tenant isolation, not bolted on.
            </p>
          </div>
        </div>

        {/* ── 2. HERO INTERACTION (Simulated Live Environment) ─────── */}
        <div className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg sm:text-xl tracking-tight">
              One question. One grounded answer. Full receipts.
            </h3>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{
                color: "var(--accent-soft)",
                background: "rgba(79,140,255,0.08)",
                border: "1px solid var(--accent-border)",
              }}
            >
              Interactive Runtime
            </span>
          </div>
          <SimulatedEnvironment />
        </div>
      </div>

      {/* ── 3. THE "WHY THIS EXISTS" STORY ──────────────────────── */}
      <WhyStorySection />

      {/* ── 4. CORE SYSTEM EXPERIENCE (Living Architecture) ─────── */}
      <CoreSystemDiagram />

      {/* ── 5. CAPABILITIES 01 - 10 ─────────────────────────────── */}
      <CapabilitiesSection />

      {/* ── 6. ARCHITECTURE SHOWCASE (5 Layers + Multi-Model) ───── */}
      <ArchitectureShowcase />

      {/* ── 7. ENGINEERING DECISIONS & TECH STACK ───────────────── */}
      <DecisionsAndStackSection />

      {/* ── 8. NUMBERS / PROOF, MINDSET & FINAL STORY ───────────── */}
      <ProofAndMindsetSection />
    </section>
  );
};

export default AivonFlagship;
export { AivonFlagship as landingWebPage };
