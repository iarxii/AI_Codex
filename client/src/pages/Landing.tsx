import React from "react";
import { Link } from "react-router-dom";
import ExternalNavbar from "../components/layout/ExternalNavbar";
import ExternalFooter from "../components/layout/ExternalFooter";

const Landing: React.FC = () => (
  <div className="flex flex-col min-h-screen bg-transparent text-[var(--text-primary)] relative z-10">
    <ExternalNavbar />

    <div className="flex-1 flex items-center justify-center p-6 mt-20">
      <div className="relative z-10 bg-[var(--bg-surface)]/60 backdrop-blur-2xl rounded-2xl border border-black/[0.05] p-12 max-w-2xl w-full text-center shadow-2xl">
        <div className="w-24 h-24 mx-auto mb-8 flex items-center justify-center drop-shadow-2xl">
          <img
            src="/media/aicodex_logo_2_transp.png"
            alt="AICodex Logo"
            className="w-full h-full object-contain rounded-3xl border-2 border-[var(--accent)]"
          />
        </div>

        <h1 className="text-5xl font-extrabold mb-4 text-[var(--text-primary)]">
          AI<span className="text-[var(--accent)]">Codex</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 font-medium">
          Advanced Agentic Intelligence for Developers and Architects.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Link
            to="/login"
            className="bg-[var(--accent)] text-white py-4 px-8 rounded-xl font-bold hover:bg-[var(--accent-hover)] transition-all shadow-lg shadow-[var(--accent)]/20"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="bg-black/[0.04] border border-black/[0.08] text-[var(--text-primary)] py-4 px-8 rounded-xl font-bold hover:bg-black/[0.08] transition-all backdrop-blur-sm"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-black/[0.05] text-[var(--text-muted)] text-sm flex justify-center gap-6 font-medium">
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></div>
            Skill-Based Tools
          </span>
          <span className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--status-online)]"></div>
            RAG-Grounded Reasoning
          </span>
        </div>
      </div>
    </div>
    <ExternalFooter />
  </div>
);

export default Landing;
