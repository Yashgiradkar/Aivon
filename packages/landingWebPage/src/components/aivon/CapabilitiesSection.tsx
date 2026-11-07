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
            Deep Architectural Capabilities
          </span>
        </div>

        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          Engineered for constraints:{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
            10 production pillars.
          </span>
        </h3>

        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Explore how each system layer was engineered to handle real-world scale, tenant isolation,
          security boundaries, and omnichannel communication.
        </p>
      </div>

      {/* Interactive Tabs Strip */}
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
                <span
                  className={`font-mono text-[10px] font-bold ${
                    isSelected ? "text-gold" : "text-secondary"
                  }`}
                >
                  {item.num}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? "bg-gold animate-pulse" : "bg-white/20"
                  }`}
                />
              </div>
              <p
                className={`mt-1 text-xs font-semibold truncate ${
                  isSelected ? "text-white" : "text-secondary"
                }`}
              >
                {item.title}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Capability Deep-Dive Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-tertiary via-black-100 to-tertiary/90 border border-gold/30 shadow-[0px_35px_120px_-15px_#251b0e] transition-all duration-300">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-gold uppercase tracking-widest font-bold">
                Capability {cap.num}
              </span>
              <span className="text-secondary text-xs">•</span>
              <span className="text-white text-xs font-mono">{cap.title}</span>
            </div>
            <h4 className="text-2xl sm:text-3xl font-black text-white">
              "{cap.heading}"
            </h4>
          </div>

          <div className="p-3 rounded-xl bg-black-200/90 border border-gold/40 self-start md:self-auto text-right">
            <span className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold to-white block">
              {cap.metric}
            </span>
            <span className="text-[10px] font-mono text-secondary">
              {cap.metricLabel}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <p className="mt-6 text-secondary text-sm sm:text-[15px] leading-relaxed max-w-4xl">
          {cap.explanation}
        </p>

        {/* Concrete Flow Diagram */}
        <div className="mt-6 p-4 sm:p-5 rounded-xl bg-black-200/80 border border-white/[0.06] space-y-3">
          <span className="text-[10px] font-mono text-gold uppercase tracking-widest font-bold block">
            Architectural Pipeline Flow
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {cap.flow.map((step, idx) => (
              <div
                key={step.name}
                className="p-3 rounded-lg bg-tertiary/70 border border-white/[0.05] flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-4 h-4 rounded bg-gold/20 text-gold text-[9px] font-mono flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <p className="text-white text-xs font-bold truncate">{step.name}</p>
                </div>
                <p className="text-secondary text-[11px] leading-snug">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Engineering Highlights Checklist */}
        <div className="mt-6 space-y-2.5">
          <span className="text-[10px] font-mono text-secondary uppercase tracking-widest font-bold block">
            Production Engineering Decisions & Safeguards
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {cap.highlights.map((highlight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <span className="text-gold text-xs font-bold mt-0.5">✦</span>
                <p className="text-[#f2dfbd] text-xs leading-relaxed font-medium">
                  {highlight}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

