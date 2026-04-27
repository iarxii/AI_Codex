import React, { useState } from 'react';

interface WorkspaceOnboardingModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSubmit: (data: { profile: string; goals: string }) => void;
}

const WorkspaceOnboardingModal: React.FC<WorkspaceOnboardingModalProps> = ({ isOpen, setIsOpen, onSubmit }) => {
  const [profile, setProfile] = useState('');
  const [goals, setGoals] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-black/[0.04] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-[#1A1D2E] tracking-tight">Workspace Initialization</h2>
          <button onClick={() => setIsOpen(false)} className="text-[#7A7D8E] hover:text-[#1A1D2E] transition-colors p-1 rounded-full hover:bg-black/5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <p className="text-sm text-[#4A4D5E] mb-6">
          Configure the core profile and objectives for this neural workspace. The AI Agent will use this context to ground its reasoning and tool executions.
        </p>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ profile, goals });
          setIsOpen(false);
        }} className="space-y-5">
          
          <div>
            <label className="block text-xs font-bold text-[#4A4D5E] uppercase tracking-widest mb-1.5">Workspace Profile (Context)</label>
            <textarea
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="e.g. A modern React frontend using Vite and TailwindCSS, communicating with a FastAPI backend..."
              className="w-full bg-[#E2E6EC]/50 border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF6600]/40 focus:ring-1 focus:ring-[#FF6600]/40 resize-none h-24"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4A4D5E] uppercase tracking-widest mb-1.5">Project Goals</label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="e.g. Build an onboarding wizard with animated transitions and secure data validation."
              className="w-full bg-[#E2E6EC]/50 border border-black/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF6600]/40 focus:ring-1 focus:ring-[#FF6600]/40 resize-none h-24"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-black/[0.04]">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#4A4D5E] hover:bg-black/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!profile.trim() || !goals.trim()}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#FF6600] hover:bg-[#E65C00] shadow-md shadow-[#FF6600]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Initialize Workspace
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkspaceOnboardingModal;
