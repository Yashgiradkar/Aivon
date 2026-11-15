import React, { useState } from "react";
import { problemSolutionSteps } from "./data";

export const WhyStorySection: React.FC = () => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activeStep = problemSolutionSteps[activeStepIndex];

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md"
          style={{ background: "rgba(79,140,255,0.08)", border: "1px solid var(--accent-border)" }}
        >
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--accent-soft)" }}
          >
            Production Problem Space
          </span>
        </div>
        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          Support changed.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
            The architecture had to.
          </span>
        </h3>
        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Users expect instant, grounded answers. Businesses can't afford hallucinations, data leaks, weaponized uploads, or robotic dead ends. Each constraint shaped a decision.
        </p>
      </div>

      {/* Step Selector */}
      <div
        className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 rounded-2xl"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
      >
        {problemSolutionSteps.map((step, idx) => {
          const isSelected = idx === activeStepIndex;
          return (
            <button
              key={idx}
              onClick={() => setActiveStepIndex(idx)}
              className="p-3 rounded-xl text-left transition-all cursor-pointer card-toplight"
              style={
                isSelected
                  ? {
                      background: "var(--surface-card-alt)",
                      border: "1px solid var(--accent-border)",
                      boxShadow: "0 4px 20px rgba(79,140,255,0.10)",
                    }
                  : { border: "1px solid transparent" }
              }
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-[10px] font-bold"
                  style={{ color: isSelected ? "var(--accent-primary)" : "#8fa3b8" }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isSelected ? "animate-pulse" : "bg-white/20"}`}
                  style={isSelected ? { background: "var(--accent-primary)" } : {}}
                />
              </div>
              <p
                className="mt-1.5 text-xs font-semibold leading-tight"
                style={{ color: isSelected ? "#fff" : "#8fa3b8" }}
              >
                {step.problem.split(" ").slice(0, 4).join(" ")}...
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded Detail */}
      <div
        className="p-6 sm:p-8 rounded-2xl transition-all duration-300 card-toplight"
        style={{
          background: "linear-gradient(145deg, var(--surface-thesis-from), var(--surface-thesis-to))",
          border: "1px solid var(--accent-border)",
          boxShadow: "0 35px 120px -15px rgba(37,99,235,0.08)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Problem */}
          <div
            className="p-5 rounded-xl space-y-3 card-toplight"
            style={{ background: "rgba(6,10,17,0.7)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400">
              <span>✕</span>
              <span>PRODUCTION CONSTRAINT</span>
            </div>
            <p className="text-white text-sm font-bold leading-snug">{activeStep.problem}</p>
            <p className="text-secondary text-xs leading-relaxed">{activeStep.problemDetail}</p>
          </div>

          {/* Solution */}
          <div
            className="p-5 rounded-xl space-y-3 card-toplight"
            style={{
              background: "linear-gradient(135deg, rgba(79,140,255,0.08), transparent)",
              border: "1px solid var(--accent-border)",
            }}
          >
            <div
              className="flex items-center gap-2 text-xs font-mono font-bold"
              style={{ color: "var(--accent-primary)" }}
            >
              <span>✓</span>
              <span>AIVON ENGINEERING RESPONSE</span>
            </div>
            <p className="text-sm font-bold leading-snug" style={{ color: "var(--accent-primary)" }}>
              {activeStep.solution}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--accent-soft)" }}>
              {activeStep.solutionDetail}
            </p>
            <code className="block text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1.5 rounded mt-2">
              {activeStep.codeRef}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
