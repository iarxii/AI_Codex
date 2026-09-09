import React, { useState, useMemo } from 'react';
import type { Artifact } from '../../types/chat';

interface ModuleTreeProps {
  artifacts: Artifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateFile?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onDelete?: (path: string) => void;
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
      root.artifacts.push(art);
    } else {
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
    'python': { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'PY' },
    'py': { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'PY' },
    'javascript': { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'JS' },
    'js': { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'JS' },
    'typescript': { bg: 'bg-blue-400/15', text: 'text-blue-400', label: 'TS' },
    'ts': { bg: 'bg-blue-400/15', text: 'text-blue-400', label: 'TS' },
    'tsx': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'TSX' },
    'jsx': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', label: 'JSX' },
    'json': { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'JSON' },
    'bash': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'SH' },
    'sh': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'SH' },
    'shell': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'SH' },
    'sql': { bg: 'bg-indigo-500/15', text: 'text-indigo-400', label: 'SQL' },
    'yaml': { bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'YML' },
    'yml': { bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'YML' },
    'html': { bg: 'bg-red-500/15', text: 'text-red-400', label: 'HTML' },
    'css': { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'CSS' },
    'rust': { bg: 'bg-orange-600/15', text: 'text-orange-400', label: 'RS' },
    'go': { bg: 'bg-teal-500/15', text: 'text-teal-400', label: 'GO' },
    'text': { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'TXT' },
  };

  const cfg = badges[lang] || (
    type === 'docs' ? { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'DOC' } :
    type === 'research' ? { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'RES' } :
    { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'TXT' }
  );

  return (
    <div className={`${cfg.bg} ${cfg.text} w-5 h-5 rounded flex items-center justify-center text-[7px] font-black tracking-tight shrink-0 font-mono`}>
      {cfg.label}
    </div>
  );
};

const DirNode: React.FC<{
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateFile?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onDelete?: (path: string) => void;
  parentPath?: string;
}> = ({ node, depth, selectedId, onSelect, onCreateFile, onCreateFolder, onDelete, parentPath = '' }) => {
  const [expanded, setExpanded] = useState(true);
  const currentPath = depth === 0 ? '' : parentPath ? `${parentPath}/${node.name}` : node.name;

  return (
    <div>
      {/* Directory header (skip for root) */}
      {depth > 0 && (
        <div
          className="w-full flex items-center gap-1.5 py-1 px-2 hover:bg-white/[0.04] rounded-lg transition-colors group cursor-pointer text-slate-300"
          style={{ paddingLeft: `${depth * 10 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            className={`w-3 h-3 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="text-[10px] font-semibold text-slate-300 truncate">
            {node.name}
          </span>
          
          {/* Action buttons on hover */}
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity" onClick={e => e.stopPropagation()}>
            {onCreateFile && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const name = prompt('File name (e.g. script.py):');
                  if (name) onCreateFile(`${currentPath}/${name}`);
                }}
                className="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-white"
                title="New File in folder"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
              </button>
            )}
            {onCreateFolder && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const name = prompt('Folder name:');
                  if (name) onCreateFolder(`${currentPath}/${name}`);
                }}
                className="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-amber-400"
                title="New Subfolder"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              </button>
            )}
            {onDelete && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete folder ${node.name}?`)) onDelete(currentPath);
                }}
                className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400"
                title="Delete Folder"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            )}
          </div>
        </div>
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
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onDelete={onDelete}
              parentPath={currentPath}
            />
          ))}

          {/* Files in this directory */}
          {node.artifacts.map(art => {
            const isSelected = selectedId === art.id;
            const displayName = art.filePath ? art.filePath.split('/').pop() || art.title : art.title;

            return (
              <div
                key={art.id}
                onClick={() => onSelect(art.id)}
                className={`w-full flex items-center gap-2 py-1 px-2 rounded-md transition-all text-left group cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600/20 text-white border border-blue-500/30'
                    : 'hover:bg-white/[0.04] text-slate-300'
                }`}
                style={{ paddingLeft: `${(depth + 1) * 10 + 4}px` }}
              >
                <FileTypeBadge language={art.language} type={art.type} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className={`text-[10px] font-mono truncate ${isSelected ? 'text-white font-bold' : 'text-slate-300'}`}>
                    {displayName}
                  </span>
                </div>
                
                {onDelete && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete file ${art.title}?`)) onDelete(art.filePath || art.title);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400 transition-opacity shrink-0"
                    title="Delete File"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                )}

                {isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)] shrink-0 ml-1"></div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ModuleTree: React.FC<ModuleTreeProps> = ({
  artifacts,
  selectedId,
  onSelect,
  onCreateFile,
  onCreateFolder,
  onDelete,
}) => {
  const [search, setSearch] = useState('');

  const filteredArtifacts = useMemo(() => {
    if (!search.trim()) return artifacts;
    const q = search.toLowerCase();
    return artifacts.filter(a =>
      (a.filePath && a.filePath.toLowerCase().includes(q)) ||
      a.title.toLowerCase().includes(q)
    );
  }, [artifacts, search]);

  const tree = useMemo(() => buildTree(filteredArtifacts), [filteredArtifacts]);

  return (
    <div className="flex flex-col h-full bg-[#111620] select-none text-slate-300">
      {/* Search & Actions Bar */}
      <div className="p-2 border-b border-white/[0.06] space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
            Explorer ({artifacts.length})
          </span>
          <div className="flex items-center gap-1">
            {onCreateFile && (
              <button
                onClick={() => {
                  const name = prompt('File name (e.g. main.py):');
                  if (name) onCreateFile(name);
                }}
                className="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-white transition-colors"
                title="New File at root"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
            {onCreateFolder && (
              <button
                onClick={() => {
                  const name = prompt('Folder name:');
                  if (name) onCreateFolder(name);
                }}
                className="p-1 hover:bg-white/[0.08] rounded text-slate-400 hover:text-amber-400 transition-colors"
                title="New Folder at root"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-[#18202f] border border-white/[0.06] rounded px-2 py-1 text-[10px] font-mono text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-[10px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        {artifacts.length === 0 ? (
          <div className="p-4 text-center text-slate-500 font-mono text-[10px]">
            No files in workspace yet.
          </div>
        ) : filteredArtifacts.length === 0 ? (
          <div className="p-4 text-center text-slate-500 font-mono text-[10px]">
            No matching files found.
          </div>
        ) : (
          <DirNode
            node={tree}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            onCreateFile={onCreateFile}
            onCreateFolder={onCreateFolder}
            onDelete={onDelete}
          />
        )}
      </div>
    </div>
  );
};

export default ModuleTree;
