import React, { useState } from "react";
import { tenCapabilities } from "./data";

export const CapabilitiesSection: React.FC = () => {
  const [selectedCapIndex, setSelectedCapIndex] = useState(0);
  const cap = tenCapabilities[selectedCapIndex];

  return (
    <div className="w-full space-y-8">
      {/* Section Header */}
      <div className="space-y-3">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md"
          style={{ background: "rgba(79,140,255,0.08)", border: "1px solid var(--accent-border)" }}
        >
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--accent-soft)" }}
          >
            Deep System Capabilities
          </span>
        </div>
        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          Engineered for constraints:{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
            10 production pillars.
          </span>
        </h3>
        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Every capability maps to real production code. Click to explore the engineering decisions behind each system layer.
        </p>
      </div>

      {/* Tabs Grid — 5 per row */}
      <div
        className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 rounded-2xl"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
      >
        {tenCapabilities.map((item, idx) => {
          const isSelected = idx === selectedCapIndex;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedCapIndex(idx)}
              className="p-3 rounded-xl text-left transition-all cursor-pointer card-toplight"
              style={
                isSelected
                  ? {
                      background: "var(--surface-card-alt)",
                      border: "1px solid var(--accent-border)",
                      boxShadow: "0 4px 16px rgba(79,140,255,0.10)",
                    }
                  : { border: "1px solid transparent" }
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">{item.icon}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isSelected ? "animate-pulse" : "bg-white/20"}`}
                  style={isSelected ? { background: "var(--accent-primary)" } : {}}
                />
              </div>
              <p
                className="mt-1 text-xs font-semibold truncate"
                style={{ color: isSelected ? "var(--accent-primary)" : "#8fa3b8" }}
              >
                {item.heading.split(" ").slice(0, 3).join(" ")}
              </p>
            </button>
          );
        })}
      </div>

      {/* Detail Panel */}
      <div
        className="rounded-2xl p-6 sm:p-8 space-y-6 transition-all duration-300 card-toplight"
        style={{
          background: "linear-gradient(145deg, var(--surface-thesis-from), var(--surface-thesis-to))",
          border: "1px solid var(--accent-border)",
        }}
      >
        {/* Cap Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <span className="text-4xl">{cap.icon}</span>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-white font-black text-xl sm:text-2xl">{cap.heading}</h4>
              {cap.badge && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
                  style={{
                    background: "rgba(79,140,255,0.12)",
                    color: "var(--accent-soft)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  {cap.badge}
                </span>
              )}
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--accent-primary)" }}>
              {cap.subheading}
            </p>
          </div>
        </div>

        {/* Punchline */}
        <div
          className="p-4 rounded-xl flex items-start gap-3"
          style={{
            background: "rgba(79,140,255,0.06)",
            border: "1px solid var(--accent-border)",
          }}
        >
          <span className="text-lg mt-0.5">💡</span>
          <p
            className="text-sm font-semibold italic leading-relaxed"
            style={{ color: "var(--accent-soft)" }}
          >
            &ldquo;{cap.punchline}&rdquo;
          </p>
        </div>

        {/* Body */}
        <p className="text-secondary text-sm leading-relaxed">{cap.body}</p>

        {/* Tech Details */}
        <div>
          <p
            className="text-xs font-mono font-bold uppercase tracking-wider mb-3"
            style={{ color: "var(--accent-primary)" }}
          >
            Engineering Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cap.techDetails.map((detail, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2.5 rounded-lg card-toplight"
                style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
              >
                <span
                  className="text-xs mt-0.5 font-bold flex-shrink-0"
                  style={{ color: "var(--accent-primary)" }}
                >
                  ▸
                </span>
                <span className="text-secondary text-xs leading-relaxed">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code Reference */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
          <span className="text-xs font-mono text-secondary">Code ref:</span>
          <code className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded">
            {cap.realCodeNote}
          </code>
        </div>
      </div>
    </div>
  );
};
