import React from 'react';
import type { CodexSpace } from '../contexts/AIContext';
import {
  ChartBarIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

interface SpaceCardProps {
  space: CodexSpace;
  onEnter: (space: CodexSpace) => void;
}

const getIcon = (iconName: string | null) => {
  switch (iconName) {
    case 'ChartBarIcon': return <ChartBarIcon className="w-8 h-8" />;
    case 'CodeBracketIcon': return <CodeBracketIcon className="w-8 h-8" />;
    case 'SparklesIcon': return <SparklesIcon className="w-8 h-8" />;
    default: return <GlobeAltIcon className="w-8 h-8" />;
  }
};

const SpaceCard: React.FC<SpaceCardProps> = ({ space, onEnter }) => {
  return (
    <div className="bg-[var(--bg-surface)]/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.02] hover:bg-white/5 cursor-pointer shadow-xl" onClick={() => onEnter(space)}>
      <div className={`p-4 rounded-2xl mb-4 text-white shadow-lg`} style={{ backgroundColor: space.color || 'var(--accent)' }}>
        {getIcon(space.icon)}
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
        {space.name}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mb-6 line-clamp-3">
        {space.description}
      </p>
      
      <div className="flex gap-2 mb-6">
        {space.is_public ? (
          <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider rounded border border-green-500/20">Public</span>
        ) : (
          <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wider rounded border border-purple-500/20">Restricted</span>
        )}
        <span className="px-2 py-1 bg-white/5 text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider rounded border border-white/10">
          Limit: {space.capacity}
        </span>
      </div>
      
      <button 
        className="w-full py-2.5 bg-white/5 hover:bg-[var(--accent)] hover:text-white text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-all"
        onClick={(e) => {
            e.stopPropagation();
            onEnter(space);
        }}
      >
        Enter Space
      </button>
    </div>
  );
};

export default SpaceCard;
