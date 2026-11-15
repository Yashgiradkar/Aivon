import React, { useState, useEffect } from "react";
import { simulationScenarios } from "./data";

export const SimulatedEnvironment: React.FC = () => {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const [activeStage, setActiveStage] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const scenario = simulationScenarios[selectedScenarioIndex];

  useEffect(() => {
    setActiveStage(0);
    setIsSimulating(true);
    setShowAudit(false);

    const timer1 = setTimeout(() => setActiveStage(1), 600);
    const timer2 = setTimeout(() => setActiveStage(2), 1300);
    const timer3 = setTimeout(() => setActiveStage(3), 2000);
    const timer4 = setTimeout(() => { setIsSimulating(false); setShowAudit(true); }, 2800);

    return () => {
      clearTimeout(timer1); clearTimeout(timer2);
      clearTimeout(timer3); clearTimeout(timer4);
    };
  }, [selectedScenarioIndex]);

  const handleReplay = () => {
    setActiveStage(0);
    setIsSimulating(true);
    setShowAudit(false);
    setTimeout(() => setActiveStage(1), 600);
    setTimeout(() => setActiveStage(2), 1300);
    setTimeout(() => setActiveStage(3), 2000);
    setTimeout(() => { setIsSimulating(false); setShowAudit(true); }, 2800);
  };

  return (
    <div
      className="w-full rounded-2xl p-4 sm:p-7 card-toplight"
      style={{
        background: "linear-gradient(to bottom, var(--surface-card), var(--surface-card-alt))",
        border: "1px solid var(--accent-border)",
        boxShadow: "0 20px 60px -15px rgba(79,140,255,0.08)",
      }}
    >
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "var(--accent-primary)" }}
            />
            <span
              className="relative inline-flex rounded-full h-3 w-3"
              style={{ background: "var(--accent-primary)" }}
            />
          </span>
          <span className="text-white font-mono text-xs font-bold uppercase tracking-wider">
            Interactive Runtime Simulation
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono rounded bg-white/[0.05] text-secondary border border-white/10">
            Convex Reactive Loop
          </span>
        </div>

        {/* Scenario Selector Pills */}
        <div
          className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
        >
          {simulationScenarios.map((sc, idx) => {
            const isSelected = idx === selectedScenarioIndex;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedScenarioIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer`}
                style={
                  isSelected
                    ? {
                        background: "linear-gradient(135deg, #4F8CFF, #2563EB)",
                        color: "#fff",
                        fontWeight: 600,
                        boxShadow: "0 2px 8px rgba(79,140,255,0.25)",
                      }
                    : {}
                }
              >
                {isSelected ? sc.label : <span className="text-secondary hover:text-white transition-colors">{sc.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* LEFT: Chat Simulation */}
        <div
          className="lg:col-span-5 flex flex-col rounded-xl p-4 sm:p-5 card-toplight"
          style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, #4F8CFF, #2563EB)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                A
              </div>
              <div>
                <p className="text-white text-xs font-semibold">Aivon Chat Widget</p>
                <p className="text-[10px] font-mono text-secondary">
                  Tenant: <span style={{ color: "var(--accent-soft)" }}>{scenario.stats.tenant}</span>
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
                className="p-1.5 rounded-md hover:bg-white/10 text-secondary hover:text-white transition-colors cursor-pointer text-xs font-mono"
              >
                ↻ Replay
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 mt-4 space-y-3.5 text-xs">
            {/* Customer */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono text-secondary mb-1">Customer • Just now</span>
              <div
                className="text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[90%] leading-relaxed"
                style={{
                  background: "rgba(79,140,255,0.12)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                {scenario.customerQuery}
              </div>
            </div>

            {/* AI Response */}
            <div className="flex flex-col items-start">
              <span
                className="text-[10px] font-mono mb-1 flex items-center gap-1"
                style={{ color: "var(--accent-primary)" }}
              >
                Aivon AI Agent
                {isSimulating && (
                  <span className="text-secondary italic">({scenario.pipeline[activeStage]?.stage}...)</span>
                )}
              </span>
              <div
                className="rounded-2xl rounded-tl-sm px-3.5 py-3 max-w-[95%] leading-relaxed shadow-sm transition-all duration-300 card-toplight"
                style={{
                  background: "var(--surface-card-alt)",
                  border: "1px solid var(--border-neutral)",
                  color: "var(--accent-soft)",
                }}
              >
                {activeStage < 3 ? (
                  <div className="flex items-center gap-2 text-secondary py-1">
                    <span
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: "var(--accent-primary)" }}
                    />
                    <span className="font-mono text-[11px]">
                      {scenario.pipeline[activeStage]?.stage}: {scenario.pipeline[activeStage]?.title}...
                    </span>
                  </div>
                ) : (
                  <p className="text-[12.5px] leading-relaxed text-white">{scenario.aiResponse}</p>
                )}
              </div>
            </div>
          </div>

          {/* Source footer */}
          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1">
            <div className="flex items-start gap-2 text-[11px] text-emerald-400/90 font-mono">
              <span className="text-emerald-400 font-bold">✓</span>
              <p className="leading-snug">{scenario.sourceNote}</p>
            </div>
            <p className="text-[10px] font-mono text-secondary">
              Model: {scenario.stats.model} • Latency: {scenario.stats.latency} • Precision: {scenario.stats.precision}
            </p>
          </div>
        </div>

        {/* RIGHT: Pipeline + Audit Trail */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Pipeline */}
          <div
            className="flex-1 rounded-xl p-4 sm:p-5 card-toplight"
            style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
              <div>
                <p
                  className="text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: "var(--accent-primary)" }}
                >
                  System Pipeline
                </p>
                <p className="text-secondary text-[11px]">{scenario.category}</p>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{
                  background: "rgba(79,140,255,0.10)",
                  color: "var(--accent-soft)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                Stage {Math.min(activeStage + 1, scenario.pipeline.length)} / {scenario.pipeline.length}
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {scenario.pipeline.map((step, idx) => {
                const isActive = idx === activeStage;
                const isPassed = idx < activeStage;
                return (
                  <div
                    key={step.stage}
                    className="p-3 rounded-lg border transition-all duration-300"
                    style={
                      isActive
                        ? {
                            background: "var(--surface-card-alt)",
                            border: "1px solid var(--accent-border)",
                            boxShadow: "0 0 15px rgba(79,140,255,0.12)",
                            transform: "scale(1.01)",
                          }
                        : isPassed
                        ? { background: "rgba(8,12,20,0.5)", border: "1px solid var(--border-neutral)", opacity: 0.8 }
                        : { background: "rgba(6,10,17,0.4)", border: "1px solid rgba(255,255,255,0.03)", opacity: 0.35 }
                    }
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold"
                          style={
                            isActive
                              ? { background: "var(--accent-primary)", color: "#fff" }
                              : isPassed
                              ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                              : { background: "rgba(255,255,255,0.05)", color: "#8fa3b8" }
                          }
                        >
                          {isPassed ? "✓" : idx + 1}
                        </span>
                        <span
                          className="font-mono text-xs font-bold tracking-wider"
                          style={{ color: isActive ? "var(--accent-primary)" : "#fff" }}
                        >
                          {step.stage}
                        </span>
                        <span className="text-white/60 text-xs">—</span>
                        <span className="text-white text-xs font-medium">{step.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-secondary">{step.timing}</span>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={
                            isActive
                              ? {
                                  background: "rgba(79,140,255,0.15)",
                                  color: "var(--accent-soft)",
                                  border: "1px solid var(--accent-border)",
                                }
                              : { background: "rgba(255,255,255,0.05)", color: "#8fa3b8" }
                          }
                        >
                          {step.status}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-secondary text-[11px] leading-relaxed pl-7">{step.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Trail Panel */}
          <div
            className={`rounded-xl border transition-all duration-500 p-4 ${
              showAudit ? "opacity-100" : "opacity-30"
            }`}
            style={{
              background: "#0d1a0d80",
              border: showAudit ? "1px solid rgba(52,211,153,0.4)" : "1px solid var(--border-neutral)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${showAudit ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">Audit Trail Written</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-600">aiAuditEvents + ragLineageRecords</span>
            </div>
            <p className="text-[11px] font-mono text-emerald-300/80 leading-relaxed">
              {showAudit
                ? scenario.auditNote || `Audit trail: traceId=tr_${Math.random().toString(36).slice(2,8)} • stage=completed • latency=${scenario.stats.latency} • hasEvidence=true • lineage stored`
                : "Waiting for pipeline completion..."}
            </p>
            {showAudit && (
              <p className="mt-1.5 text-[10px] font-mono text-emerald-600 italic">
                ↳ Don't wonder where the answer came from. We log every piece of evidence.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
