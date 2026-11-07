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
          Modern users expect immediate, conversational answers. But businesses cannot afford
          ungrounded LLM hallucinations, data leaks across tenants, or robotic dead ends when a customer needs
          human empathy. I designed Aivon around these exact production trade-offs.
        </p>
      </div>

      {/* Interactive Problem → Solution Progression Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1.5 bg-black-200/90 rounded-2xl border border-white/[0.08]">
        {problemSolutionSteps.map((step, idx) => {
          const isSelected = idx === activeStepIndex;
          return (
            <button
              key={step.tag}
              onClick={() => setActiveStepIndex(idx)}
              className={`p-3 rounded-xl text-left transition-all cursor-pointer ${
                isSelected
                  ? "bg-tertiary border border-gold/60 shadow-[0_4px_20px_rgba(214,168,75,0.15)]"
                  : "hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-[10px] font-bold ${
                    isSelected ? "text-gold" : "text-secondary"
                  }`}
                >
                  {step.step}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? "bg-gold animate-pulse" : "bg-white/20"
                  }`}
                />
              </div>
              <p
                className={`mt-1.5 text-xs font-semibold leading-tight ${
                  isSelected ? "text-white" : "text-secondary"
                }`}
              >
                {step.tag}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded Transition Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-tertiary via-black-100 to-tertiary/80 border border-gold/30 shadow-[0px_35px_120px_-15px_#251b0e] transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-gold uppercase tracking-widest font-bold">
              Stage {activeStep.step} Architecture Transition
            </span>
            <h4 className="text-xl sm:text-2xl font-bold text-white">
              {activeStep.tag}
            </h4>
          </div>

          <span className="self-start md:self-auto px-3 py-1 text-xs font-mono rounded-full bg-gold/15 text-[#f2dfbd] border border-gold/40">
            {activeStep.badge}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* The Real-World Friction */}
          <div className="p-5 rounded-xl bg-black-200/70 border border-red-500/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400">
              <span>✕</span>
              <span>PRODUCTION CONSTRAINT / TRADEOFF</span>
            </div>
            <p className="text-secondary text-sm leading-relaxed">
              {activeStep.problem}
            </p>
          </div>

          {/* Aivon's Architectural Solution */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-gold/10 to-transparent border border-gold/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-gold">
              <span>✓</span>
              <span>HOW I ENGINEERED IT IN AIVON</span>
            </div>
            <p className="text-[#f2dfbd] text-sm leading-relaxed font-medium">
              {activeStep.solution}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

