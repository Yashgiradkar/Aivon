import React, { useState } from "react";
import { techStackGrouped, engineeringDecisionsCards } from "./data";

export const DecisionsAndStackSection: React.FC = () => {
  const [activeStackIndex, setActiveStackIndex] = useState(0);
  const [selectedTech, setSelectedTech] = useState(techStackGrouped[0].items[0]);
  const [expandedDecisionId, setExpandedDecisionId] = useState(engineeringDecisionsCards[0].id);

  const activeGroup = techStackGrouped[activeStackIndex];

  return (
    <div className="w-full space-y-16">
      {/* ── 1. ENGINEERING DECISIONS ───────────────────────────── */}
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
              The architectural decisions behind it.
            </span>
          </h3>

          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Good engineering isn't about listing frameworks. It's about evaluating constraints, accepting trade-offs,
            and structuring systems that hold up under real-world usage.
          </p>
        </div>

        {/* 6 Interactive Decision Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {engineeringDecisionsCards.map((card) => {
            const isExpanded = expandedDecisionId === card.id;
            return (
              <div
                key={card.id}
                onClick={() => setExpandedDecisionId(card.id)}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-1 ${
                  isExpanded
                    ? "bg-tertiary border-gold shadow-[0_0_25px_rgba(214,168,75,0.2)]"
                    : "bg-black-100/90 border-white/[0.07] hover:border-gold/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                    <span className="text-[10px] font-mono font-bold text-gold">
                      {card.num}
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 text-secondary">
                      {card.tag}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-mono text-secondary uppercase font-semibold">Problem</p>
                    <p className="text-white text-xs sm:text-[13px] font-bold leading-snug">
                      "{card.problem}"
                    </p>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-mono text-gold uppercase font-semibold">Engineering Decision</p>
                    <p className="text-[#f2dfbd] text-xs leading-relaxed font-medium">
                      {card.decision}
                    </p>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-2 text-xs transition-all duration-300">
                      <p className="text-secondary text-[11.5px] leading-relaxed">
                        {card.explanation}
                      </p>
                      <div className="p-2 rounded bg-black-200/90 border border-gold/30">
                        <span className="text-[10px] font-mono text-gold font-bold uppercase block">Verified Impact</span>
                        <p className="text-[11px] text-white mt-0.5">{card.impact}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-secondary">
                    {isExpanded ? "Active Decision" : "Click to inspect rationale"}
                  </span>
                  <span className="text-gold text-xs">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2. TECH STACK BY RESPONSIBILITY ─────────────────────── */}
      <div className="space-y-8 pt-10 border-t border-white/[0.08]">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
            <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
              Component Registry
            </span>
          </div>

          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            The technology stack:{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
              grouped by engineering responsibility.
            </span>
          </h3>

          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Click any tool or framework to reveal the concrete architectural reason why it was selected
            over alternatives for this production system.
          </p>
        </div>

        {/* Stack Category Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-1.5 bg-black-200/90 rounded-2xl border border-white/[0.08]">
          {techStackGrouped.map((cat, idx) => {
            const isSelected = idx === activeStackIndex;
            return (
              <button
                key={cat.category}
                onClick={() => {
                  setActiveStackIndex(idx);
                  setSelectedTech(cat.items[0]);
                }}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-tertiary border border-gold/60 shadow-[0_4px_16px_rgba(214,168,75,0.15)]"
                    : "hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{cat.icon}</span>
                  <p className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-secondary"}`}>
                    {cat.category.split(" ")[0]}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Category Details & Interactive Tech Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 rounded-2xl bg-black-100/90 border border-white/[0.08]">
          {/* Tech Pills in this Category (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <p className="text-xs font-mono font-bold text-gold uppercase tracking-wider">
                  {activeGroup.category}
                </p>
                <p className="text-secondary text-xs mt-0.5">{activeGroup.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {activeGroup.items.map((tech) => {
                const isSelected = selectedTech?.name === tech.name;
                return (
                  <button
                    key={tech.name}
                    onClick={() => setSelectedTech(tech)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-gradient-to-r from-gold to-[#b9792e] text-[#17130e] font-bold border-gold shadow-md"
                        : "bg-tertiary/70 text-secondary border-white/10 hover:text-white hover:border-gold/40"
                    }`}
                  >
                    {tech.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* "What I Used It For" Inspector Panel (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-xl bg-black-200/90 border border-gold/30">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <span className="text-[10px] font-mono text-gold uppercase tracking-widest font-bold">
                  What I Used It For
                </span>
                <span className="text-white text-xs font-mono font-bold">{selectedTech?.name}</span>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-mono text-secondary uppercase">Production Purpose</p>
                <p className="text-[#f2dfbd] text-xs sm:text-[13px] leading-relaxed font-medium">
                  {selectedTech?.usedFor}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-secondary">
              <span>Status: Active in Monorepo</span>
              <span className="text-gold">No Superfluous Libs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

