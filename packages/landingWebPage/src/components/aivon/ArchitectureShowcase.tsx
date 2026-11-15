import React, { useState } from "react";
import { architectureLayers } from "./data";

export const ArchitectureShowcase: React.FC = () => {
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(2);
  const activeLayer = architectureLayers[selectedLayerIndex];

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
            System Topology
          </span>
        </div>

        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          Five tiers.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
            Each one earns its place.
          </span>
        </h3>

        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Clients, orchestration, real-time persistence, and infrastructure, decoupled on purpose.
        </p>
      </div>

      {/* 5-Tier Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Layer Selector Left Rails (5 cols) */}
        <div className="lg:col-span-5 space-y-2.5">
          {architectureLayers.map((layer, idx) => {
            const isSelected = idx === selectedLayerIndex;
            return (
              <button
                key={layer.id}
                onClick={() => setSelectedLayerIndex(idx)}
                className="w-full p-4 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between card-toplight"
                style={
                  isSelected
                    ? {
                        background: "var(--surface-card-alt)",
                        border: "1px solid var(--accent-border)",
                        boxShadow: "0 0 20px rgba(79,140,255,0.10)",
                      }
                    : {
                        background: "var(--surface-card)",
                        border: "1px solid var(--border-neutral)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-border)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-card-alt)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-neutral)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-card)";
                  }
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[11px] font-bold"
                      style={{ color: isSelected ? "var(--accent-primary)" : "#8fa3b8" }}
                    >
                      LAYER 0{layer.layer}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-secondary">
                      {layer.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-white">{layer.name.replace(/^LAYER \d+: /, "")}</p>
                </div>

                <span
                  className="text-lg transition-transform"
                  style={{ color: isSelected ? "var(--accent-primary)" : "#8fa3b8",
                           transform: isSelected ? "translateX(4px)" : "none" }}
                >
                  →
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Layer In-Depth Components (7 cols) */}
        <div className="lg:col-span-7">
          <div
            className="h-full p-6 sm:p-7 rounded-2xl flex flex-col justify-between space-y-6 transition-all duration-300 card-toplight"
            style={{
              background: "linear-gradient(145deg, var(--surface-thesis-from), var(--surface-thesis-to))",
              border: "1px solid var(--accent-border)",
            }}
          >
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div>
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest font-bold"
                    style={{ color: "var(--accent-soft)" }}
                  >
                    Layer 0{activeLayer.layer} Blueprint
                  </span>
                  <h4 className="text-xl font-bold text-white mt-0.5">{activeLayer.name}</h4>
                </div>
                <span
                  className="px-2.5 py-1 text-xs font-mono rounded"
                  style={{
                    background: "rgba(79,140,255,0.12)",
                    color: "var(--accent-soft)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  {activeLayer.badge}
                </span>
              </div>

              <p className="mt-4 text-secondary text-sm leading-relaxed">
                {activeLayer.desc}
              </p>

              {/* Component Breakdown Cards */}
              <div className="mt-5 space-y-3">
                {activeLayer.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl transition-colors card-toplight"
                    style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-border)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-neutral)";
                    }}
                  >
                    <p className="text-white text-xs sm:text-sm font-bold flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--accent-primary)" }}
                      />
                      {item.title}
                    </p>
                    <p className="mt-1 text-secondary text-xs font-mono leading-relaxed pl-3.5">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Status footer */}
            <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-[11px] font-mono text-secondary">
              <span>Reactive Mutation Bus: Active</span>
              <span style={{ color: "var(--accent-primary)" }}>Zero Hardcoded Endpoints</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Model Architectural Flexibility Strip */}
      <div
        className="p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 card-toplight"
        style={{
          background: "linear-gradient(to right, var(--surface-card), var(--surface-card-alt), var(--surface-card))",
          border: "1px solid var(--border-neutral)",
        }}
      >
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--accent-primary)" }}
            >
              Multi-Model Neutrality
            </span>
            <span className="text-secondary text-xs">•</span>
            <span className="text-white text-xs font-mono">Architectural Agnosticism</span>
          </div>
          <p className="text-white font-bold text-base sm:text-lg">
            &ldquo;Model choice is an architectural concern, not a hardcoded dependency.&rdquo;
          </p>
          <p className="text-secondary text-xs sm:text-[13px] leading-relaxed">
            Prompts and tools are decoupled from provider SDKs. Swap models for cost, latency, or data governance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {[
            { name: "OpenAI", spec: "GPT-4o & text-embedding-3-small", pill: "Default Agent" },
            { name: "Anthropic", spec: "Claude 3.5 Sonnet", pill: "Complex Reasoning" },
            { name: "xAI Grok", spec: "Grok-Beta", pill: "Alternative Routing" },
          ].map((provider) => (
            <div
              key={provider.name}
              className="p-3 rounded-xl text-left min-w-[140px] card-toplight"
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--accent-border)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-white text-xs font-bold">{provider.name}</span>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ color: "var(--accent-soft)", background: "rgba(79,140,255,0.08)" }}
                >
                  {provider.pill}
                </span>
              </div>
              <p className="mt-1 text-[10px] font-mono text-secondary">{provider.spec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
