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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-gold/20 to-[#b9792e]/10 border border-gold/50">
            <span className="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
            <span className="text-[#f2dfbd] font-mono text-xs font-bold uppercase tracking-[0.18em]">
              FLAGSHIP PROJECT / AI SYSTEM
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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
              Engineering it for the real world is the hard part.
            </span>
          </h2>

          <p className="text-white text-lg sm:text-xl font-medium leading-relaxed max-w-4xl">
            <strong>Aivon</strong> is a multi-tenant AI customer support platform built to turn company knowledge
            into real-time customer conversations.
          </p>

          <p className="text-secondary text-sm sm:text-base leading-relaxed max-w-3xl">
            It combines RAG-powered knowledge retrieval, tool-using AI agents, real-time chat, voice support,
            human handoff, secure tenant isolation, billing, and an embeddable developer experience into one system.
          </p>
        </div>

        {/* Quick Launch & Verification Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-gold/20 via-tertiary to-black-100 border border-gold/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm sm:text-base">Aivon Production Deployment</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gold/15 text-gold border border-gold/40">
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
              className="bg-gradient-to-r from-gold to-[#b9792e] hover:opacity-90 text-[#17130e] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-gold/25 flex items-center gap-2 transition-all active:scale-95 flex-shrink-0"
            >
              Launch Dashboard ↗
            </a>
            <a
              href="https://github.com/Yashgiradkar/Aivon"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-tertiary/90 hover:bg-tertiary border border-white/10 hover:border-gold/40 text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors flex-shrink-0"
            >
              GitHub Source ↗
            </a>
          </div>
        </div>

        {/* ── 2. HERO INTERACTION (Simulated Live Environment) ─────── */}
        <div className="pt-4">
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

