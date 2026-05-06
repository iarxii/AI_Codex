import React from 'react';
import { config } from '../../config';

interface GraphViewProps {
  workspaceId?: string | number;
  isGlobal?: boolean;
}

const GraphView: React.FC<GraphViewProps> = ({ workspaceId, isGlobal = false }) => {
  // Construct the URL for the graph
  // If global, use the global mount point
  // If workspace-specific, use the dynamic mount point
  const graphUrl = isGlobal 
    ? `${config.API_BASE_URL}/admin/graph/graph.html`
    : `${config.API_BASE_URL}/graph/${workspaceId}/graph.html`;

  return (
    <div className="w-full h-full min-h-[400px] rounded-2xl overflow-hidden border border-black/[0.05] bg-white relative group">
      <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a 
          href={graphUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-white/80 backdrop-blur-md border border-black/[0.1] rounded-lg text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors shadow-sm"
        >
          Open in New Tab
        </a>
      </div>
      <iframe 
        src={graphUrl} 
        className="w-full h-full border-none"
        title="Knowledge Graph"
      />
    </div>
  );
};

export default GraphView;
