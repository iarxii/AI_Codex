import React, { useState } from 'react';
import type { Artifact } from '../../types/chat';

interface ModuleTreeProps {
  artifacts: Artifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface TreeNode {
  name: string;
  artifacts: Artifact[];
  children: Map<string, TreeNode>;
}

function buildTree(artifacts: Artifact[]): TreeNode {
  const root: TreeNode = { name: 'root', artifacts: [], children: new Map() };

  for (const art of artifacts) {
    const path = art.filePath || art.title;
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length <= 1) {
      // File at root level
      root.artifacts.push(art);
    } else {
      // Navigate/create directory nodes
      let current = root;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (!current.children.has(seg)) {
          current.children.set(seg, { name: seg, artifacts: [], children: new Map() });
        }
        current = current.children.get(seg)!;
      }
      current.artifacts.push(art);
    }
  }

  return root;
}

/** Language-specific colored badge for the file tree */
const FileTypeBadge: React.FC<{ language?: string; type: Artifact['type'] }> = ({ language, type }) => {
  const lang = (language || '').toLowerCase();
  
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    'python': { bg: 'bg-blue-500/15', text: 'text-blue-500', label: 'PY' },
    'py': { bg: 'bg-blue-500/15', text: 'text-blue-500', label: 'PY' },
    'javascript': { bg: 'bg-yellow-500/15', text: 'text-yellow-600', label: 'JS' },
    'js': { bg: 'bg-yellow-500/15', text: 'text-yellow-600', label: 'JS' },
    'typescript': { bg: 'bg-blue-400/15', text: 'text-blue-400', label: 'TS' },
    'ts': { bg: 'bg-blue-400/15', text: 'text-blue-400', label: 'TS' },
    'tsx': { bg: 'bg-cyan-500/15', text: 'text-cyan-500', label: 'TSX' },
    'jsx': { bg: 'bg-cyan-500/15', text: 'text-cyan-500', label: 'JSX' },
    'json': { bg: 'bg-orange-500/15', text: 'text-orange-500', label: 'JSON' },
    'bash': { bg: 'bg-green-500/15', text: 'text-green-500', label: 'SH' },
    'sh': { bg: 'bg-green-500/15', text: 'text-green-500', label: 'SH' },
    'shell': { bg: 'bg-green-500/15', text: 'text-green-500', label: 'SH' },
    'sql': { bg: 'bg-indigo-500/15', text: 'text-indigo-500', label: 'SQL' },
    'yaml': { bg: 'bg-rose-500/15', text: 'text-rose-500', label: 'YML' },
    'yml': { bg: 'bg-rose-500/15', text: 'text-rose-500', label: 'YML' },
    'html': { bg: 'bg-red-500/15', text: 'text-red-500', label: 'HTML' },
    'css': { bg: 'bg-purple-500/15', text: 'text-purple-500', label: 'CSS' },
    'rust': { bg: 'bg-orange-600/15', text: 'text-orange-600', label: 'RS' },
    'go': { bg: 'bg-teal-500/15', text: 'text-teal-500', label: 'GO' },
    'text': { bg: 'bg-slate-400/10', text: 'text-slate-400', label: 'TXT' },
  };

  const cfg = badges[lang] || (
    type === 'docs' ? { bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'DOC' } :
    type === 'research' ? { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'RES' } :
    { bg: 'bg-slate-400/10', text: 'text-slate-400', label: 'TXT' }
  );

  return (
    <div className={`${cfg.bg} ${cfg.text} w-6 h-6 rounded-md flex items-center justify-center text-[7px] font-black tracking-tight shrink-0`}>
      {cfg.label}
    </div>
  );
};

const DirNode: React.FC<{
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}> = ({ node, depth, selectedId, onSelect }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      {/* Directory header (skip for root) */}
      {depth > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 py-1 px-2 hover:bg-black/[0.03] rounded-lg transition-colors group"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <svg
            className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-3.5 h-3.5 text-yellow-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider truncate">
            {node.name}
          </span>
          <span className="text-[7px] text-[var(--text-muted)] font-mono ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
            {node.artifacts.length + node.children.size}
          </span>
        </button>
      )}

      {/* Children */}
      {(expanded || depth === 0) && (
        <div>
          {/* Subdirectories */}
          {Array.from(node.children.entries()).map(([name, child]) => (
            <DirNode
              key={name}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}

          {/* Files in this directory */}
          {node.artifacts.map(art => (
            <button
              key={art.id}
              onClick={() => onSelect(art.id)}
              className={`w-full flex items-center gap-2.5 py-1.5 px-2 rounded-xl transition-all text-left ${
                selectedId === art.id
                  ? 'bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/20 shadow-sm'
                  : 'hover:bg-black/[0.03]'
              }`}
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              <FileTypeBadge language={art.language} type={art.type} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-[9px] font-bold truncate ${selectedId === art.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{art.title}</span>
                <span className="text-[7px] text-[var(--text-muted)] font-mono uppercase tracking-tighter truncate">
                  {art.language || art.type}
                  {art.dependencies && art.dependencies.length > 0 && (
                    <span className="ml-1 text-[var(--accent)]">• {art.dependencies.length} dep{art.dependencies.length > 1 ? 's' : ''}</span>
                  )}
                </span>
              </div>
              {selectedId === art.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_rgba(255,102,0,0.5)] shrink-0"></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ModuleTree: React.FC<ModuleTreeProps> = ({ artifacts, selectedId, onSelect }) => {
  // Group by module first, then build trees within each module
  const modules = new Map<string, Artifact[]>();
  const ungrouped: Artifact[] = [];

  for (const art of artifacts) {
    if (art.module) {
      if (!modules.has(art.module)) modules.set(art.module, []);
      modules.get(art.module)!.push(art);
    } else {
      ungrouped.push(art);
    }
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Module groups */}
      {Array.from(modules.entries()).map(([moduleName, arts]) => {
        const tree = buildTree(arts);
        return (
          <div key={moduleName} className="mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--accent)]">
                {moduleName}
              </span>
              <span className="text-[7px] text-[var(--text-muted)] font-mono">
                ({arts.length} file{arts.length !== 1 ? 's' : ''})
              </span>
            </div>
            <DirNode node={tree} depth={0} selectedId={selectedId} onSelect={onSelect} />
          </div>
        );
      })}

      {/* Ungrouped files */}
      {ungrouped.length > 0 && (
        <div>
          {modules.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-40"></div>
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                Standalone
              </span>
            </div>
          )}
          {ungrouped.map(art => (
            <button
              key={art.id}
              onClick={() => onSelect(art.id)}
              className={`w-full flex items-center gap-2.5 py-1.5 px-4 rounded-xl transition-all text-left ${
                selectedId === art.id
                  ? 'bg-[var(--accent)]/8 ring-1 ring-[var(--accent)]/20 shadow-sm'
                  : 'hover:bg-black/[0.03]'
              }`}
            >
              <FileTypeBadge language={art.language} type={art.type} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className={`text-[9px] font-bold truncate ${selectedId === art.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{art.title}</span>
                <span className="text-[7px] text-[var(--text-muted)] font-mono uppercase">{art.language || art.type}</span>
              </div>
              {selectedId === art.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_rgba(255,102,0,0.5)] shrink-0"></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModuleTree;
