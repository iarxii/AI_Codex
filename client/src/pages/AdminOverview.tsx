import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GraphView from '../components/canvas/GraphView';
import { config } from '../config';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface WorkspaceSummary {
  id: string;
  fileCount: number;
}

interface AdminUser {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

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

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Failed to fetch users (${res.status})`);
      }
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setUsersError(e.message || 'Failed to load signup analytics');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    fetchUsers();
  }, [fetchWorkspaces, fetchUsers]);

  const analytics = useMemo(() => {
    const now = new Date();
    const msDay = 86400000;
    const weekAgo = new Date(now.getTime() - 7 * msDay);
    const monthAgo = new Date(now.getTime() - 30 * msDay);
    const active = users.filter(u => u.is_active).length;
    const last7 = users.filter(u => new Date(u.created_at) >= weekAgo).length;
    const last30 = users.filter(u => new Date(u.created_at) >= monthAgo).length;
    const lastSignup = users.length ? new Date(Math.max(...users.map(u => new Date(u.created_at).getTime()))) : null;
    const daysSinceLastSignup = lastSignup ? Math.floor((now.getTime() - lastSignup.getTime()) / msDay) : null;

    // Build last 30 days histogram for chart
    const buckets: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * msDay);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      buckets[key] = 0;
    }
    users.forEach(u => {
      const k = new Date(u.created_at).toISOString().slice(0, 10);
      if (k in buckets) buckets[k]++;
    });
    const chartData = Object.entries(buckets).map(([date, count]) => ({
      date: date.slice(5), // MM-DD
      count,
    }));
    const maxDaily = Math.max(1, ...Object.values(buckets));
    return { active, last7, last30, lastSignup, daysSinceLastSignup, chartData, maxDaily };
  }, [users]);

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
            onClick={() => { fetchWorkspaces(); fetchUsers(); }}
            className="px-3 py-1.5 rounded-full bg-white/50 border border-black/[0.05] text-[9px] font-bold text-[#4A4D5E] uppercase tracking-wider hover:bg-white/80 transition-all"
          >
            Refresh
          </button>
          <button
            onClick={() => navigate('/admin/users')}
            className="px-3 py-1.5 rounded-full bg-[#1A1D2E] text-white text-[9px] font-bold uppercase tracking-wider hover:bg-black transition-all"
          >
            Manage Users →
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="w-full flex flex-col space-y-6">
          {/* Signup Analytics */}
          <section className="shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1A1D2E]">Signup Analytics</h2>
              <span className="text-[9px] font-bold text-[#7A7D8E] uppercase tracking-widest">
                {loadingUsers ? 'Loading…' : usersError ? 'Error' : `${users.length} total architects`}
              </span>
            </div>
            {usersError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-xs font-medium">
                {usersError} — check <code className="bg-red-100 px-1 rounded">GET /api/admin/users</code> auth.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Architects', value: loadingUsers ? '…' : String(users.length), sub: `${analytics.active} active` },
                    { label: 'Last 7 Days', value: loadingUsers ? '…' : String(analytics.last7), sub: analytics.last7 === 0 ? 'No new signups 😢' : `${analytics.last7} new` },
                    { label: 'Last 30 Days', value: loadingUsers ? '…' : String(analytics.last30), sub: analytics.last30 === 0 ? 'Stalled' : `${analytics.last30} new` },
                    { label: 'Days Since Last Signup', value: loadingUsers ? '…' : analytics.daysSinceLastSignup === null ? '—' : String(analytics.daysSinceLastSignup), sub: analytics.lastSignup ? analytics.lastSignup.toLocaleDateString() : '—' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white/60 backdrop-blur-md border border-black/[0.04] rounded-2xl p-4 flex flex-col justify-center shadow-sm">
                      <div className="text-[8px] font-black uppercase tracking-widest text-[#7A7D8E] mb-1">{stat.label}</div>
                      <div className="text-2xl font-black text-[#1A1D2E] tracking-tight">{stat.value}</div>
                      <div className="text-[10px] font-bold text-[#fd3b12] mt-1">{stat.sub}</div>
                    </div>
                  ))}
                </div>
                {/* 30-day histogram */}
                <div className="mt-4 bg-white/60 backdrop-blur-md border border-black/[0.04] rounded-2xl p-4 shadow-sm">
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#7A7D8E] mb-2">Signups — Last 30 Days</div>
                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#7A7D8E' }} interval={4} />
                        <YAxis allowDecimals={false} domain={[0, analytics.maxDaily]} tick={{ fontSize: 9, fill: '#7A7D8E' }} width={20} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                        <Bar dataKey="count" fill="#fd3b12" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] font-bold text-[#7A7D8E] uppercase tracking-widest">Workspaces: {loadingWorkspaces ? '…' : workspaces.length} • Active: {analytics.active}/{users.length}</span>
                    <span className="text-[9px] font-bold text-[#fd3b12] uppercase tracking-widest">{analytics.last30 === 0 ? 'No growth — check landing CTA /register' : 'Live'}</span>
                  </div>
                  {/* Recent signups */}
                  <div className="mt-4 border-t border-black/[0.04] pt-3">
                    <div className="text-[8px] font-black uppercase tracking-widest text-[#7A7D8E] mb-2">Recent Signups</div>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {users.slice().sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0,5).map(u => (
                        <div key={u.id} className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 border border-black/[0.03]">
                          <span className="text-xs font-bold text-[#1A1D2E]">{u.username} <span className="text-[10px] font-medium text-[#7A7D8E]">({u.role})</span></span>
                          <span className="text-[10px] font-mono text-[#4A4D5E]">{new Date(u.created_at).toLocaleDateString()} {u.is_active ? '●' : '○'}</span>
                        </div>
                      ))}
                      {users.length === 0 && !loadingUsers && <div className="text-xs text-[#7A7D8E] font-medium">No users found.</div>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Global Knowledge Map */}
          <section className="flex flex-col min-h-[420px]">
            <h2 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1A1D2E] mb-3">Global Knowledge Map</h2>
            <div className="flex-1 min-h-[380px] rounded-2xl overflow-hidden border border-black/[0.06] bg-white/40">
              <GraphView isGlobal={true} />
            </div>
          </section>
          
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
