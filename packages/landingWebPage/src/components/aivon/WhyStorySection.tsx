import React, { useState } from "react";
import { problemSolutionSteps } from "./data";

export const WhyStorySection: React.FC = () => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activeStep = problemSolutionSteps[activeStepIndex];

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gold/10 border border-gold/30">
          <span className="text-gold font-mono text-[11px] font-bold uppercase tracking-wider">
            The Production Problem Space
          </span>
        </div>
        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          Customer support changed.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold via-gold-light to-white">
            The architecture had to change with it.
          </span>
        </h3>
        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Modern users expect immediate, grounded, conversational answers. But businesses can't afford hallucinations,
          data leaks, weaponized uploads, or robotic dead ends. Each constraint drove a specific engineering decision in Aivon.
        </p>
      </div>

      {/* Step Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-black-200/90 rounded-2xl border border-white/[0.08]">
        {problemSolutionSteps.map((step, idx) => {
          const isSelected = idx === activeStepIndex;
          return (
            <button
              key={idx}
              onClick={() => setActiveStepIndex(idx)}
              className={`p-3 rounded-xl text-left transition-all cursor-pointer ${
                isSelected
                  ? "bg-tertiary border border-gold/60 shadow-[0_4px_20px_rgba(214,168,75,0.15)]"
                  : "hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-mono text-[10px] font-bold ${isSelected ? "text-gold" : "text-secondary"}`}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-gold animate-pulse" : "bg-white/20"}`} />
              </div>
              <p className={`mt-1.5 text-xs font-semibold leading-tight ${isSelected ? "text-white" : "text-secondary"}`}>
                {step.problem.split(" ").slice(0, 4).join(" ")}...
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded Detail */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-tertiary via-black-100 to-tertiary/80 border border-gold/30 shadow-[0px_35px_120px_-15px_#251b0e] transition-all duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Problem */}
          <div className="p-5 rounded-xl bg-black-200/70 border border-red-500/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400">
              <span>✕</span>
              <span>PRODUCTION CONSTRAINT</span>
            </div>
            <p className="text-white text-sm font-bold leading-snug">{activeStep.problem}</p>
            <p className="text-secondary text-xs leading-relaxed">{activeStep.problemDetail}</p>
          </div>

          {/* Solution */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-gold/10 to-transparent border border-gold/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-gold">
              <span>✓</span>
              <span>AIVON ENGINEERING RESPONSE</span>
            </div>
            <p className="text-gold text-sm font-bold leading-snug">{activeStep.solution}</p>
            <p className="text-[#f2dfbd] text-xs leading-relaxed">{activeStep.solutionDetail}</p>
            <code className="block text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1.5 rounded mt-2">
              {activeStep.codeRef}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
