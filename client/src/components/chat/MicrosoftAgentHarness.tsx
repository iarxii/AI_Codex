import React, { useState } from 'react';
import { Network, Calendar, FolderOpen, Zap, Cloud, Activity, CheckCircle2, Server, FileText, Database } from 'lucide-react';

export const MicrosoftAgentHarness: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mcp' | 'outlook' | 'onedrive' | 'power'>('mcp');

  return (
    <div className="flex-1 p-4 flex flex-col items-center justify-start overflow-y-auto space-y-5 w-full scrollbar-hide">
      
      {/* HEADER CARD */}
      <div className="w-full bg-[#161922]/60 rounded-xl p-4 border border-white/5 flex items-center gap-3 shadow-lg">
        <div className="w-10 h-10 border border-[#0078D4]/30 rounded-xl bg-[#0078D4]/5 flex items-center justify-center relative shrink-0">
          <div className="w-2 h-2 rounded-full bg-[#0078D4] animate-ping absolute"></div>
          <Cloud className="w-5 h-5 text-[#0078D4]" />
        </div>
        <div className="text-left flex flex-col gap-1 w-full">
          <div className="flex justify-between items-start w-full">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Office Knowledge Stack</h4>
            <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
              <Activity className="w-2.5 h-2.5" /> SYNCED
            </span>
          </div>
          <span className="self-start px-1.5 py-0.5 rounded bg-[#0078D4]/10 text-[7px] font-bold text-[#0078D4] border border-[#0078D4]/20 uppercase tracking-wider">
            Microsoft Graph Architecture
          </span>
        </div>
      </div>

      {/* TABS CONTROLLER */}
      <div className="w-full bg-[#0F111A] rounded-xl border border-white/5 overflow-hidden flex flex-col shadow-xl">
        <div className="flex border-b border-white/5 bg-black/20 flex-wrap">
          <button 
            onClick={() => setActiveTab('mcp')}
            className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-w-[50%] border-b border-white/5 ${activeTab === 'mcp' ? 'bg-white/[0.03] text-[#0078D4] border-b-2 !border-b-[#0078D4]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Network className="w-3 h-3" /> MCP
          </button>
          <button 
            onClick={() => setActiveTab('outlook')}
            className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-w-[50%] border-b border-white/5 ${activeTab === 'outlook' ? 'bg-white/[0.03] text-[#0078D4] border-b-2 !border-b-[#0078D4]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Calendar className="w-3 h-3" /> Outlook
          </button>
          <button 
            onClick={() => setActiveTab('onedrive')}
            className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-w-[50%] ${activeTab === 'onedrive' ? 'bg-white/[0.03] text-[#0078D4] border-b-2 !border-b-[#0078D4]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <FolderOpen className="w-3 h-3" /> OneDrive
          </button>
          <button 
            onClick={() => setActiveTab('power')}
            className={`flex-1 py-2.5 text-[8px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 min-w-[50%] ${activeTab === 'power' ? 'bg-white/[0.03] text-[#0078D4] border-b-2 !border-b-[#0078D4]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Zap className="w-3 h-3" /> Power Platform
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          
          {/* TAB 1: MCP INTEGRATIONS */}
          {activeTab === 'mcp' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2 items-start">
                <Network className="w-4 h-4 text-[#0078D4] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#0078D4] uppercase tracking-wider">Active MCP Connections</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Model Context Protocol is actively synchronizing local filesystems with enterprise directory knowledge.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    <div>
                      <div className="text-[9px] font-bold text-white uppercase tracking-wider">Enterprise Graph</div>
                      <div className="text-[8px] text-gray-500 font-mono">mcp://graph.microsoft.com</div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                
                <div className="p-2.5 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <div>
                      <div className="text-[9px] font-bold text-white uppercase tracking-wider">Local Workspaces</div>
                      <div className="text-[8px] text-gray-500 font-mono">mcp://localhost:8080/fs</div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OUTLOOK */}
          {activeTab === 'outlook' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2 items-start">
                <Calendar className="w-4 h-4 text-[#0078D4] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#0078D4] uppercase tracking-wider">Daily Schedule</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Agent context is aware of your meetings and schedule for optimal task execution timing.
                  </p>
                </div>
              </div>

              <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                {[
                  { time: '09:00 AM', title: 'Daily Standup', type: 'Teams Meeting' },
                  { time: '11:30 AM', title: 'Architecture Review', type: 'Teams Meeting' },
                  { time: '02:00 PM', title: 'Deep Work: Agent Tools', type: 'Focus Time' }
                ].map((mtg, index) => (
                  <div key={index} className="relative flex items-center py-2.5">
                    <div className="w-10 h-10 rounded-full border-4 border-[#0F111A] bg-[#161922] flex items-center justify-center shrink-0 z-10 text-gray-500">
                      <div className="w-2 h-2 rounded-full bg-[#0078D4]"></div>
                    </div>
                    <div className="ml-3 w-full p-2.5 rounded-lg bg-[#161922]/80 border border-white/5 shadow-sm">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-white tracking-wide">{mtg.title}</span>
                        <time className="text-[8px] font-mono text-[#0078D4]">{mtg.time}</time>
                      </div>
                      <div className="text-[8px] text-gray-500 font-sans uppercase tracking-wider">
                        {mtg.type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ONEDRIVE */}
          {activeTab === 'onedrive' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#0078D4]" />
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider">Recent Documents</span>
                </div>
                <button className="text-[8px] uppercase tracking-wider text-[#0078D4] hover:text-white transition-colors">
                  Sync Now
                </button>
              </div>

              <div className="space-y-1.5">
                {[
                  { name: 'Q3_Architecture_Review.docx', date: '2 hrs ago', size: '2.4 MB' },
                  { name: 'Deployment_Config_v2.xlsx', date: 'Yesterday', size: '1.1 MB' },
                  { name: 'API_Spec_Draft.pdf', date: 'Oct 12', size: '4.8 MB' }
                ].map((doc, idx) => (
                  <div key={idx} className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-[#0078D4]/10 rounded text-[#0078D4]">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-300 font-medium group-hover:text-[#0078D4] transition-colors">{doc.name}</div>
                        <div className="text-[8px] text-gray-600 font-mono">{doc.size}</div>
                      </div>
                    </div>
                    <span className="text-[8px] text-gray-500">{doc.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: POWER PLATFORM */}
          {activeTab === 'power' && (
            <div className="space-y-4 text-left animate-in fade-in duration-300">
              <div className="bg-[#161922]/40 rounded-lg p-3 border border-white/5 flex gap-2 items-start">
                <Zap className="w-4 h-4 text-[#0078D4] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-[#0078D4] uppercase tracking-wider">Power Automate Deployer</span>
                  <p className="text-[9px] text-gray-400 leading-relaxed">
                    Agent has access to tenant environment variables and can trigger Flow webhooks or draft PowerApps manifests.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-black/40 border border-white/5 rounded-lg text-center cursor-pointer hover:border-[#0078D4]/50 transition-colors group">
                  <div className="mx-auto w-8 h-8 rounded-full bg-[#0078D4]/10 flex items-center justify-center mb-2 group-hover:bg-[#0078D4]/20">
                    <Zap className="w-4 h-4 text-[#0078D4]" />
                  </div>
                  <div className="text-[9px] font-bold text-white uppercase tracking-wider">Trigger Flow</div>
                  <div className="text-[8px] text-gray-500 mt-0.5">Webhook Active</div>
                </div>
                
                <div className="p-3 bg-black/40 border border-white/5 rounded-lg text-center cursor-pointer hover:border-purple-500/50 transition-colors group">
                  <div className="mx-auto w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mb-2 group-hover:bg-purple-500/20">
                    <Server className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-[9px] font-bold text-white uppercase tracking-wider">Power Apps</div>
                  <div className="text-[8px] text-gray-500 mt-0.5">Draft Manifest</div>
                </div>
              </div>

              <div className="space-y-1.5 mt-2">
                <span className="text-[8px] uppercase text-gray-500 font-mono">Recent Deployment Logs</span>
                <div className="min-h-[80px] bg-black/60 rounded-lg border border-white/5 p-2 space-y-1.5">
                  <div className="text-[8px] font-mono text-gray-400 flex items-center justify-between">
                    <span>[SYS] Flow 'Invoice_Approval' Executed</span>
                    <span className="text-emerald-400">SUCCESS</span>
                  </div>
                  <div className="text-[8px] font-mono text-gray-400 flex items-center justify-between">
                    <span>[SYS] Graph API token refreshed</span>
                    <span className="text-emerald-400">OK</span>
                  </div>
                  <div className="text-[8px] font-mono text-gray-400 flex items-center justify-between">
                    <span>[AGENT] Analyzed data from SharePoint</span>
                    <span className="text-emerald-400">OK</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
