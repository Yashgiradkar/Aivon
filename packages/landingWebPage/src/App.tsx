import React from "react";
import { AivonFlagship } from "./components/AivonFlagship";

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#05070d] text-[#f7f1e6]">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-[#05070d]/80 border-b border-white/[0.08] px-4 sm:px-8 py-3.5 flex items-center justify-between card-toplight">
        <div className="flex items-center gap-3">
          {/* Logo tile: blue gradient, white letter */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#4F8CFF] to-[#2563EB] flex items-center justify-center text-white font-black font-mono text-sm shadow-md">
            A
          </div>
          <span className="font-bold text-white text-base tracking-tight">
            Aivon{" "}
            <span
              className="font-normal text-xs font-mono ml-1.5 px-2 py-0.5 rounded"
              style={{
                color: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                background: "rgba(79,140,255,0.06)",
              }}
            >
              Flagship Showcase
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://aivon-dashboard.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
          >
            Live App ↗
          </a>
          <a
            href="https://github.com/Yashgiradkar/Aivon"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-3.5 py-1.5 rounded-lg font-mono text-xs transition-all"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
        <AivonFlagship />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-8 text-center text-xs font-mono text-secondary">
        <p>Aivon AI Customer Support Platform — Engineering Portfolio Flagship</p>
      </footer>
    </div>
  );
};

export default App;

