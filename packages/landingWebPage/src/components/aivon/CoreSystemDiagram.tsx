import React, { useState } from "react";
import { architectureNodes, infrastructureRails } from "./data";

export const CoreSystemDiagram: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState(architectureNodes[3].id);
  const selectedNode = architectureNodes.find((n) => n.id === selectedNodeId) || architectureNodes[0];

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
            Living Architecture Flow
          </span>
        </div>

        <h3 className="text-white font-black text-2xl sm:text-3xl lg:text-4xl leading-tight">
          How Aivon works:{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4F8CFF] via-[#7FB2FF] to-white">
            from client input to system action.
          </span>
        </h3>

        <p className="text-secondary text-sm sm:text-[15px] max-w-3xl leading-relaxed">
          Explore the lifecycle of a conversation. Click on any pipeline node to inspect the engineering decisions,
          reactive mutations, and security boundaries guarding each step.
        </p>
      </div>

      {/* Interactive Main Pipeline Flow */}
      <div
        className="p-6 rounded-2xl space-y-6 card-toplight"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border-neutral)" }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <span className="text-xs font-mono font-bold text-secondary uppercase tracking-widest">
            Primary Execution Loop (Click any node)
          </span>
          <span className="text-[11px] font-mono" style={{ color: "var(--accent-primary)" }}>
            Sub-250ms Target E2E
          </span>
        </div>

        {/* Horizontal Pipeline Steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {architectureNodes.map((node, idx) => {
            const isSelected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className="p-3.5 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between h-[130px] relative group card-toplight"
                style={
                  isSelected
                    ? {
                        background: "var(--surface-card-alt)",
                        border: "1px solid var(--accent-border)",
                        boxShadow: "0 0 20px rgba(79,140,255,0.15)",
                        transform: "scale(1.02)",
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
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: "var(--accent-soft)" }}
                    >
                      0{idx + 1}
                    </span>
                    <span className="text-[9px] font-mono text-secondary px-1 py-0.5 rounded bg-white/5">
                      {node.category}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-white leading-snug">
                    {node.title}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <p className="text-[10px] font-mono text-secondary truncate">
                    {node.tech}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Node Technical Breakdown Drawer */}
        <div
          className="p-5 sm:p-6 rounded-xl transition-all duration-300 card-toplight"
          style={{
            background: "linear-gradient(to right, var(--surface-card-alt), var(--surface-card), var(--surface-card-alt))",
            border: "1px solid var(--accent-border)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
            <div>
              <span
                className="text-[10px] font-mono uppercase tracking-widest font-bold"
                style={{ color: "var(--accent-soft)" }}
              >
                {selectedNode.category} • Technical Inspection
              </span>
              <h4 className="text-lg font-bold text-white mt-0.5">
                {selectedNode.title}{" "}
                <span className="text-secondary text-sm font-normal">— {selectedNode.subtitle}</span>
              </h4>
            </div>
            <span
              className="px-2.5 py-1 text-xs font-mono rounded self-start sm:self-auto"
              style={{
                background: "rgba(79,140,255,0.12)",
                color: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
              }}
            >
              {selectedNode.tech}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-1">
              <p className="text-xs font-mono text-secondary uppercase font-semibold">Architectural Role</p>
              <p className="text-white text-xs sm:text-[13px] leading-relaxed">{selectedNode.description}</p>
            </div>

            <div className="space-y-1">
              <p
                className="text-xs font-mono uppercase font-semibold"
                style={{ color: "var(--accent-primary)" }}
              >
                Implementation Detail
              </p>
              <p
                className="text-xs sm:text-[13px] leading-relaxed font-mono"
                style={{ color: "var(--accent-soft)" }}
              >
                {selectedNode.details}
              </p>
            </div>
          </div>
        </div>

        {/* Behind the System: Foundation & Security Rails */}
        <div className="pt-4 border-t border-white/[0.06] space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono font-bold uppercase tracking-wider"
              style={{ color: "var(--accent-primary)" }}
            >
              Underlying System Rails &amp; Production Guards
            </span>
            <div className="flex-1 h-[1px] bg-white/[0.08]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {infrastructureRails.map((rail) => (
              <div
                key={rail.title}
                className="p-3.5 rounded-xl space-y-1.5 transition-colors card-toplight"
                style={{
                  background: "var(--surface-card-alt)",
                  border: "1px solid var(--border-neutral)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-border)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-neutral)";
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-white text-xs font-bold">{rail.title}</p>
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: "rgba(79,140,255,0.08)",
                      color: "var(--accent-soft)",
                      border: "1px solid var(--accent-border)",
                    }}
                  >
                    {rail.badge}
                  </span>
                </div>
                <p className="text-secondary text-[11.5px] leading-relaxed">{rail.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
