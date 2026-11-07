import React, { useState, useEffect } from "react";
import { simulationScenarios } from "./data";

export const SimulatedEnvironment: React.FC = () => {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const scenario = simulationScenarios[selectedScenarioIndex];

  useEffect(() => {
    setActiveStage(0);
    setIsSimulating(true);

    const timer1 = setTimeout(() => setActiveStage(1), 500);
    const timer2 = setTimeout(() => setActiveStage(2), 1100);
    const timer3 = setTimeout(() => setActiveStage(3), 1700);
    const timer4 = setTimeout(() => setIsSimulating(false), 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [selectedScenarioIndex]);

  const handleReplay = () => {
    setActiveStage(0);
    setIsSimulating(true);
    setTimeout(() => setActiveStage(1), 500);
    setTimeout(() => setActiveStage(2), 1100);
    setTimeout(() => setActiveStage(3), 1700);
    setTimeout(() => setIsSimulating(false), 2400);
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-b from-[#13110e]/95 via-tertiary/90 to-[#0c0a08]/95 border border-gold/30 p-4 sm:p-7 shadow-[0_20px_60px_-15px_rgba(214,168,75,0.12)]">
      {/* Top Bar with Scenario Selectors */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gold"></span>
          </span>
          <span className="text-white font-mono text-xs font-bold uppercase tracking-wider">
            Interactive Runtime Simulation
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono rounded bg-white/[0.05] text-secondary border border-white/10">
            Convex Reactive Loop
          </span>
        </div>

        {/* Scenario Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-black-200/90 rounded-xl border border-white/[0.08]">
          {simulationScenarios.map((sc, idx) => {
            const isSelected = idx === selectedScenarioIndex;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedScenarioIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-gradient-to-r from-gold to-[#b9792e] text-[#17130e] font-semibold shadow-md"
                    : "text-secondary hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Simulated Customer Chat (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-black-100/90 rounded-xl border border-white/[0.08] p-4 sm:p-5">
          <div>
            {/* Chat Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gold/20 border border-gold/40 flex items-center justify-center text-gold text-xs font-bold">
                  A
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">Aivon Chat Widget</p>
                  <p className="text-[10px] font-mono text-secondary">
                    Tenant: <span className="text-[#f2dfbd]">{scenario.stats.tenant}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
                <button
                  onClick={handleReplay}
                  title="Replay Execution Pipeline"
                  className="p-1.5 rounded-md hover:bg-white/10 text-secondary hover:text-white transition-colors cursor-pointer text-xs font-mono"
                >
                  ↻ Replay
                </button>
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="mt-4 space-y-3.5 text-xs">
              {/* Customer Bubble */}
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-mono text-secondary mb-1">Customer • Just now</span>
                <div className="bg-gradient-to-r from-gold/20 to-[#b9792e]/20 border border-gold/40 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[90%] leading-relaxed">
                  {scenario.customerQuery}
                </div>
              </div>

              {/* AI Processing Bubble */}
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-mono text-gold mb-1 flex items-center gap-1">
                  Aivon AI Agent
                  {isSimulating && (
                    <span className="text-secondary italic">({scenario.pipeline[activeStage]?.stage}...)</span>
                  )}
                </span>

                <div className="bg-tertiary/90 border border-white/10 text-[#f2dfbd] rounded-2xl rounded-tl-sm px-3.5 py-3 max-w-[95%] leading-relaxed shadow-sm transition-all duration-300">
                  {activeStage < 3 ? (
                    <div className="flex items-center gap-2 text-secondary py-1">
                      <span className="w-2 h-2 rounded-full bg-gold animate-bounce" />
                      <span className="font-mono text-[11px]">
                        Executing {scenario.pipeline[activeStage]?.stage}: {scenario.pipeline[activeStage]?.title}...
                      </span>
                    </div>
                  ) : (
                    <p className="text-[12.5px] leading-relaxed text-white">
                      {scenario.aiResponse}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Source Attribution Footer */}
          <div className="mt-4 pt-3 border-t border-white/[0.06]">
            <div className="flex items-start gap-2 text-[11px] text-emerald-400/90 font-mono">
              <span className="text-emerald-400 font-bold">✓</span>
              <p className="leading-snug">{scenario.sourceNote}</p>
            </div>
            <p className="mt-1 text-[10px] font-mono text-secondary">
              Model: {scenario.stats.model} • Latency: {scenario.stats.latency} • Precision: {scenario.stats.precision}
            </p>
          </div>
        </div>

        {/* Right Column: Animated Internal Reasoning Pipeline (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-black-200/80 rounded-xl border border-white/[0.08] p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
              <div>
                <p className="text-xs font-mono font-bold text-gold uppercase tracking-wider">
                  System Pipeline Execution
                </p>
                <p className="text-secondary text-[11px]">
                  Internal production flow: RAG vector search to autonomous tool dispatch
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/30">
                Stage {activeStage + 1} of 4
              </span>
            </div>

            {/* Stages Stack */}
            <div className="mt-4 space-y-2.5">
              {scenario.pipeline.map((step, idx) => {
                const isActive = idx === activeStage;
                const isPassed = idx < activeStage;

                return (
                  <div
                    key={step.stage}
                    className={`p-3 rounded-lg border transition-all duration-300 ${
                      isActive
                        ? "bg-tertiary border-gold shadow-[0_0_15px_rgba(214,168,75,0.18)] scale-[1.01]"
                        : isPassed
                        ? "bg-tertiary/50 border-white/10 opacity-75"
                        : "bg-black-100/40 border-white/[0.04] opacity-35"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold ${
                            isActive
                              ? "bg-gold text-[#17130e]"
                              : isPassed
                              ? "bg-white/20 text-white"
                              : "bg-white/5 text-secondary"
                          }`}
                        >
                          {isPassed ? "✓" : idx + 1}
                        </span>
                        <span
                          className={`font-mono text-xs font-bold tracking-wider ${
                            isActive ? "text-gold" : "text-white"
                          }`}
                        >
                          {step.stage}
                        </span>
                        <span className="text-white/60 text-xs">—</span>
                        <span className="text-white text-xs font-medium">{step.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-secondary">{step.timing}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isActive
                              ? "bg-gold/20 text-gold-light border border-gold/40"
                              : "bg-white/5 text-secondary"
                          }`}
                        >
                          {step.status}
                        </span>
                      </div>
                    </div>

                    <p className="mt-2 text-secondary text-[11.5px] leading-relaxed pl-7">
                      {step.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Architectural Guarantee Banner */}
          <div className="mt-4 p-3 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-gold text-sm">⚡</span>
              <p className="text-[11px] text-[#f2dfbd] font-medium">
                Grounded in tenant knowledge. Zero hallucinated policy answers.
              </p>
            </div>
            <span className="text-[10px] font-mono text-gold uppercase tracking-wider font-bold">
              Production Constraint Satisfied
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

