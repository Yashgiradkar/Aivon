import React, { useState } from "react";
import { architectureLayers } from "./data";

export const ArchitectureShowcase: React.FC = () => {
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(2);
  const activeLayer = architectureLayers[selectedLayerIndex];

  return (
    <div className="w-full space-y-8">
      {/* Section Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
          <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
            System Topology
          </span>
        </div>

        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          Enterprise architecture:{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
            the 5-tier system blueprint.
          </span>
        </h3>

        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Production AI systems require decoupling client interfaces from orchestration, real-time data persistence,
          and external infrastructure rails.
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
                className={`w-full p-4 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? "bg-tertiary border-gold shadow-[0_0_20px_rgba(214,168,75,0.2)]"
                    : "bg-black-100/80 border-white/[0.06] hover:border-gold/30 hover:bg-tertiary/40"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        isSelected ? "text-gold" : "text-secondary"
                      }`}
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
                  className={`text-lg transition-transform ${
                    isSelected ? "text-gold translate-x-1" : "text-secondary"
                  }`}
                >
                  →
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Layer In-Depth Components (7 cols) */}
        <div className="lg:col-span-7">
          <div className="h-full p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-tertiary via-black-200 to-tertiary border border-gold/40 flex flex-col justify-between space-y-6 transition-all duration-300">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div>
                  <span className="text-[10px] font-mono text-gold uppercase tracking-widest font-bold">
                    Layer 0{activeLayer.layer} Blueprint
                  </span>
                  <h4 className="text-xl font-bold text-white mt-0.5">{activeLayer.name}</h4>
                </div>
                <span className="px-2.5 py-1 text-xs font-mono rounded bg-gold/15 text-gold border border-gold/40">
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
                    className="p-3.5 rounded-xl bg-black-100/90 border border-white/[0.05] hover:border-gold/30 transition-colors"
                  >
                    <p className="text-white text-xs sm:text-sm font-bold flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold" />
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
              <span className="text-gold">Zero Hardcoded Endpoints</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Model Architectural Flexibility Strip */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-black-200 via-tertiary to-black-200 border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-gold font-mono text-xs font-bold uppercase tracking-wider">
              Multi-Model Neutrality
            </span>
            <span className="text-secondary text-xs">•</span>
            <span className="text-white text-xs font-mono">Architectural Agnosticism</span>
          </div>
          <p className="text-white font-bold text-base sm:text-lg">
            "Model choice is an architectural concern, not a hardcoded dependency."
          </p>
          <p className="text-secondary text-xs sm:text-[13px] leading-relaxed">
            The agent runtime decouples prompt templates and tool definitions from provider SDKs. Teams can hot-swap
            models based on cost, latency, or data governance requirements.
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
              className="p-3 rounded-xl bg-black-100/90 border border-gold/30 text-left min-w-[140px]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-white text-xs font-bold">{provider.name}</span>
                <span className="text-[9px] font-mono text-gold px-1.5 py-0.5 rounded bg-gold/10">
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

