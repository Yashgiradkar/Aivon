import React, { useState } from "react";
import { techStackGrouped, engineeringDecisionsCards } from "./data";

export const DecisionsAndStackSection: React.FC = () => {
  const [activeStackIndex, setActiveStackIndex] = useState(0);
  const [expandedDecisionIndex, setExpandedDecisionIndex] = useState(0);

  const activeGroup = techStackGrouped[activeStackIndex];

  return (
    <div className="w-full space-y-16">
      {/* ── 1. ENGINEERING DECISIONS ──────────────────────────── */}
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
            <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
              Engineering Judgment
            </span>
          </div>
          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            More than the stack.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
              The decisions behind it.
            </span>
          </h3>
          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Good engineering isn't about listing frameworks. It's about evaluating constraints and structuring systems that hold under real-world usage.
          </p>
        </div>

        {/* Decision Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {engineeringDecisionsCards.map((card, idx) => {
            const isExpanded = idx === expandedDecisionIndex;
            return (
              <div
                key={idx}
                onClick={() => setExpandedDecisionIndex(idx)}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-3 hover:-translate-y-1 ${
                  isExpanded
                    ? "bg-tertiary border-gold shadow-[0_0_25px_rgba(214,168,75,0.2)]"
                    : "bg-black-100/90 border-white/[0.07] hover:border-gold/40"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <span className="text-[10px] font-mono font-bold text-gold">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <code className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-500 border border-emerald-800/30 truncate max-w-[140px]">
                    {card.codeRef.split(" ")[0]}
                  </code>
                </div>

                <div className="space-y-1">
                  <p className="text-white text-xs sm:text-[13px] font-bold leading-snug">{card.title}</p>
                  <p className="text-xs font-mono text-secondary uppercase font-semibold">Challenge</p>
                  <p className="text-secondary text-xs leading-snug">{card.challenge}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-mono text-gold uppercase font-semibold">Decision</p>
                  <p className="text-[#f2dfbd] text-xs leading-relaxed">{card.decision}</p>
                </div>

                {isExpanded && (
                  <div className="pt-3 border-t border-white/[0.08] space-y-2.5 transition-all duration-300">
                    <p className="text-secondary text-[11.5px] leading-relaxed">{card.why}</p>
                    <code className="block text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1.5 rounded">
                      {card.codeRef}
                    </code>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. TECH STACK INSPECTOR ───────────────────────────── */}
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
            <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
              Technology Stack
            </span>
          </div>
          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            Chosen deliberately.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
              Not by default.
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Tabs */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            {techStackGrouped.map((group, idx) => {
              const isActive = idx === activeStackIndex;
              return (
                <button
                  key={group.category}
                  onClick={() => setActiveStackIndex(idx)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? "bg-tertiary border-gold shadow-[0_0_15px_rgba(214,168,75,0.12)]"
                      : "bg-black-100/80 border-white/[0.07] hover:border-gold/40"
                  }`}
                >
                  <span className="text-xl">{group.icon}</span>
                  <div>
                    <p className={`text-xs font-bold ${isActive ? "text-gold" : "text-white"}`}>{group.category}</p>
                    <p className="text-[10px] font-mono text-secondary">{group.items.length} technologies</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tech Items */}
          <div className="lg:col-span-2 bg-black-200/80 rounded-2xl border border-white/[0.08] p-5">
            <div className="flex items-center gap-2 pb-4 border-b border-white/[0.06] mb-4">
              <span className="text-2xl">{activeGroup.icon}</span>
              <div>
                <p className="text-white font-bold text-sm">{activeGroup.category}</p>
                <p className="text-secondary text-xs font-mono">{activeGroup.items.length} components</p>
              </div>
            </div>
            <div className="space-y-3">
              {activeGroup.items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-black-100/60 border border-white/[0.05] hover:border-gold/30 transition-colors">
                  <span className="text-gold font-mono text-xs font-bold mt-0.5 w-4 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-white text-xs font-bold">{item.name}</p>
                    <p className="text-secondary text-[11px] leading-relaxed mt-0.5">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
