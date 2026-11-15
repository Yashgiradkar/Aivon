import React, { useState } from "react";
import { tenCapabilities } from "./data";

export const CapabilitiesSection: React.FC = () => {
  const [selectedCapIndex, setSelectedCapIndex] = useState(0);
  const cap = tenCapabilities[selectedCapIndex];

  return (
    <div className="w-full space-y-8">
      {/* Section Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
          <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
            Deep System Capabilities
          </span>
        </div>
        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          Engineered for constraints:{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
            10 production pillars.
          </span>
        </h3>
        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Every capability maps to real production code. Click to explore the engineering decisions behind each system layer.
        </p>
      </div>

      {/* Tabs Grid — 5 per row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-black-200/90 rounded-2xl border border-white/[0.08]">
        {tenCapabilities.map((item, idx) => {
          const isSelected = idx === selectedCapIndex;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedCapIndex(idx)}
              className={`p-3 rounded-xl text-left transition-all cursor-pointer ${
                isSelected
                  ? "bg-tertiary border border-gold/60 shadow-[0_4px_16px_rgba(214,168,75,0.15)]"
                  : "hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">{item.icon}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-gold animate-pulse" : "bg-white/20"}`} />
              </div>
              <p className={`mt-1 text-xs font-semibold truncate ${isSelected ? "text-gold" : "text-secondary"}`}>
                {item.heading.split(" ").slice(0, 3).join(" ")}
              </p>
            </button>
          );
        })}
      </div>

      {/* Detail Panel */}
      <div className="rounded-2xl bg-gradient-to-br from-tertiary/80 via-[#13110e] to-black-200/90 border border-white/[0.1] p-6 sm:p-8 space-y-6 transition-all duration-300">
        {/* Cap Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <span className="text-4xl">{cap.icon}</span>
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-white font-black text-xl sm:text-2xl">{cap.heading}</h4>
              {cap.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/15 text-gold border border-gold/40">
                  {cap.badge}
                </span>
              )}
            </div>
            <p className="text-gold text-sm font-medium">{cap.subheading}</p>
          </div>
        </div>

        {/* Punchline */}
        <div className="p-4 rounded-xl bg-gold/8 border border-gold/25 flex items-start gap-3">
          <span className="text-gold text-lg mt-0.5">💡</span>
          <p className="text-[#f2dfbd] text-sm font-semibold italic leading-relaxed">"{cap.punchline}"</p>
        </div>

        {/* Body */}
        <p className="text-secondary text-sm leading-relaxed">{cap.body}</p>

        {/* Tech Details */}
        <div>
          <p className="text-xs font-mono font-bold text-gold uppercase tracking-wider mb-3">Engineering Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {cap.techDetails.map((detail, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-black-100/60 border border-white/[0.06]">
                <span className="text-gold text-xs mt-0.5 font-bold flex-shrink-0">▸</span>
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
