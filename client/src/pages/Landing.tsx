import React from 'react';
import { Link } from 'react-router-dom';

const Landing: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F172A] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)]"></div>
    
    <div className="relative z-10 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 max-w-2xl w-full text-center shadow-2xl">
      <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-3xl mx-auto mb-8 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </div>
      
      <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
        AICodex
      </h1>
      <p className="text-xl text-slate-400 mb-10 font-medium">
        Advanced Agentic Intelligence for Developers and Architects.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link 
          to="/login" 
          className="bg-indigo-600 text-white py-4 px-8 rounded-xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/20"
        >
          Sign In
        </Link>
        <Link 
          to="/register" 
          className="bg-white/5 border border-white/10 text-white py-4 px-8 rounded-xl font-bold hover:bg-white/10 transition-all backdrop-blur-sm"
        >
          Create Account
        </Link>
      </div>
      
      <div className="mt-12 pt-8 border-t border-white/5 text-slate-500 text-sm flex justify-center gap-6">
        <span className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
          Skill-Based Tools
        </span>
        <span className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div>
          RAG-Grounded Reasoning
        </span>
      </div>
    </div>
  </div>
);

export default Landing;
