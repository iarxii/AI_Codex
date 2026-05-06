import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GraphView from '../components/canvas/GraphView';
import { config } from '../config';

interface WorkspaceSummary {
  id: string;
  fileCount: number;
}

const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/conversations/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // data is expected to be an array of conversations
        const summaries: WorkspaceSummary[] = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: String(c.id),
          fileCount: 0, // will be enriched once graph data exists
        }));
        setWorkspaces(summaries);
      }
    } catch {
      // fail silently — workspaces list is informational
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <div className="w-full h-screen bg-[#D8DCE4] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 bg-[#D8DCE4]/60 backdrop-blur-xl border-b border-black/[0.06] z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/chat')}
            className="p-2 hover:bg-black/5 rounded-lg text-[#4A4D5E] hover:text-[#fd3b12] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex flex-col">
            <h1 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1D2E]">Super-Admin Overview</h1>
            <p className="text-[9px] font-bold text-[#fd3b12] uppercase tracking-widest opacity-60">Global Knowledge Map</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWorkspaces}
            className="px-3 py-1.5 rounded-full bg-white/50 border border-black/[0.05] text-[9px] font-bold text-[#4A4D5E] uppercase tracking-wider hover:bg-white/80 transition-all"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-hidden">
        <div className="w-full h-full flex flex-col space-y-6">
          <div className="flex-1 min-h-0">
            <GraphView isGlobal={true} />
          </div>
          
          {/* Stats Bar */}
          <div className="h-20 shrink-0 grid grid-cols-4 gap-6">
            {[
              { label: 'Workspaces', value: loadingWorkspaces ? '…' : String(workspaces.length), trend: loadingWorkspaces ? 'Loading' : 'Live' },
              { label: 'Active Clusters', value: '—', trend: 'Awaiting graph' },
              { label: 'Cross-Project Links', value: '—', trend: 'Awaiting graph' },
              { label: 'Global Memory', value: '—', trend: 'Awaiting graph' }
            ].map((stat, i) => (
              <div key={i} className="bg-white/40 backdrop-blur-md border border-black/[0.03] rounded-2xl p-4 flex flex-col justify-center">
                <div className="text-[8px] font-black uppercase tracking-widest text-[#7A7D8E] mb-1">{stat.label}</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-xl font-black text-[#1A1D2E] tracking-tight">{stat.value}</div>
                  <div className="text-[7px] font-bold text-[#fd3b12] uppercase tracking-tighter">{stat.trend}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminOverview;
