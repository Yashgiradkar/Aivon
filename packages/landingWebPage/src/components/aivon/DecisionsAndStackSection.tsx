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
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-md"
            style={{ background: "rgba(79,140,255,0.08)", border: "1px solid var(--accent-border)" }}
          >
            <span
              className="font-mono text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--accent-soft)" }}
            >
              Engineering Judgment
            </span>
          </div>
          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            More than the stack.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
              The decisions behind it.
            </span>
          </h3>
          <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
            Good engineering isn&apos;t about listing frameworks. It&apos;s about evaluating constraints and structuring systems that hold under real-world usage.
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
                className="p-5 rounded-2xl transition-all duration-200 cursor-pointer flex flex-col gap-3 hover:-translate-y-1 card-toplight"
                style={
                  isExpanded
                    ? {
                        background: "var(--surface-card-alt)",
                        border: "1px solid var(--accent-border)",
                        boxShadow: "0 0 25px rgba(79,140,255,0.12)",
                      }
                    : {
                        background: "var(--surface-card)",
                        border: "1px solid var(--border-neutral)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isExpanded) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-border)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-neutral)";
                  }
                }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{ color: "var(--accent-soft)" }}
                  >
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
                  <p
                    className="text-xs font-mono uppercase font-semibold"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    Decision
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--accent-soft)" }}>
                    {card.decision}
                  </p>
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
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-md"
            style={{ background: "rgba(79,140,255,0.08)", border: "1px solid var(--accent-border)" }}
          >
            <span
              className="font-mono text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--accent-soft)" }}
            >
              Technology Stack
            </span>
          </div>
          <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
            Chosen deliberately.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
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
                  className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all cursor-pointer card-toplight"
                  style={
                    isActive
                      ? {
                          background: "var(--surface-card-alt)",
                          border: "1px solid var(--accent-border)",
                          boxShadow: "0 0 15px rgba(79,140,255,0.08)",
                        }
                      : {
                          background: "var(--surface-card)",
                          border: "1px solid var(--border-neutral)",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-border)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-neutral)";
                    }
                  }}
                >
                  <span className="text-xl">{group.icon}</span>
                  <div>
                    <p
                      className="text-xs font-bold"
                      style={{ color: isActive ? "var(--accent-primary)" : "#fff" }}
                    >
                      {group.category}
                    </p>
                    <p className="text-[10px] font-mono text-secondary">{group.items.length} technologies</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tech Items */}
          <div
            className="lg:col-span-2 rounded-2xl p-5 card-toplight"
            style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
          >
            <div className="flex items-center gap-2 pb-4 border-b border-white/[0.06] mb-4">
              <span className="text-2xl">{activeGroup.icon}</span>
              <div>
                <p className="text-white font-bold text-sm">{activeGroup.category}</p>
                <p className="text-secondary text-xs font-mono">{activeGroup.items.length} components</p>
              </div>
            </div>
            <div className="space-y-3">
              {activeGroup.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg transition-colors card-toplight"
                  style={{ background: "var(--surface-card-alt)", border: "1px solid var(--border-neutral)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-border)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-neutral)";
                  }}
                >
                  <span
                    className="font-mono text-xs font-bold mt-0.5 w-4 flex-shrink-0"
                    style={{ color: "var(--accent-soft)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
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
