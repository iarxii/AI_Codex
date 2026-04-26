import React from 'react';
import { Link } from 'react-router-dom';

const Landing: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,102,0,0.05),transparent_60%)]"></div>
    
    <div className="relative z-10 bg-[var(--bg-surface)]/60 backdrop-blur-2xl rounded-2xl border border-black/[0.05] p-12 max-w-2xl w-full text-center shadow-2xl">
      <div className="w-20 h-20 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] rounded-3xl mx-auto mb-8 shadow-lg shadow-[var(--accent)]/20 flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </div>
      
      <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-[var(--text-primary)] to-[var(--accent)] bg-clip-text text-transparent">
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
);

export default Landing;
