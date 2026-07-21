import React from 'react';
import { useAI } from '../contexts/AIContext';
import type { CodexSpace } from '../contexts/AIContext';
import {
  ChartBarIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  SparklesIcon,
  CpuChipIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

interface SpaceCardProps {
  space: CodexSpace;
  onEnter: (space: CodexSpace) => void;
}

export const getIcon = (iconName: string | null, className: string = "w-8 h-8", imgClassName: string = "w-10 h-10 object-contain") => {
  if (!iconName) return <GlobeAltIcon className={className} />;
  
  // Custom Brand Icons
  if (iconName.includes('.svg') || iconName.includes('.png')) {
    return <img src={iconName} alt="Space Icon" className={imgClassName} />;
  }

  switch (iconName) {
    case 'GlobeAltIcon': return <GlobeAltIcon className={className} />;
    case 'CpuChipIcon': return <CpuChipIcon className={className} />;
    case 'AcademicCapIcon': return <AcademicCapIcon className={className} />;
    case 'ChartBarIcon': return <ChartBarIcon className={className} />;
    case 'CodeBracketIcon': return <CodeBracketIcon className={className} />;
    case 'SparklesIcon': return <SparklesIcon className={className} />;
    default: return <GlobeAltIcon className={className} />;
  }
};

const SpaceCard: React.FC<SpaceCardProps> = ({ space, onEnter }) => {
  const { userProfile } = useAI();
  let config: Record<string, any> = {};
  try { config = space.config_json ? JSON.parse(space.config_json) : {}; } catch { config = {}; }
  const isGpuEnabled = config.is_gpu_enabled || false;
  const isExclusive = !['general', 'spirit-book'].includes(space.slug);
  const isAdmin = ['admin', 'super_admin'].includes(userProfile?.role || '');
  const showDonateCTA = isExclusive && !isAdmin;

  return (
    <div 
      className={`relative group bg-[var(--bg-surface)]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-500 hover:scale-[1.02] hover:bg-white/10 cursor-pointer shadow-2xl overflow-hidden`} 
      onClick={() => onEnter(space)}
    >
      {/* Exclusive Glow Effect */}
      {isExclusive && (
        <div 
          className="absolute -top-24 -left-24 w-48 h-48 rounded-full opacity-20 blur-[60px] pointer-events-none transition-all duration-700 group-hover:opacity-40 group-hover:scale-150"
          style={{ backgroundColor: space.color || 'var(--accent)' }}
        ></div>
      )}

      {/* Icon Container */}
      <div 
        className={`p-4 rounded-2xl mb-5 text-white shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`} 
        style={{ 
          backgroundColor: space.color || 'var(--accent)',
          boxShadow: `0 8px 24px -6px ${space.color || 'var(--accent)'}40`
        }}
      >
        {getIcon(space.icon)}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
          {space.name}
        </h3>
        {isExclusive && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-500 shadow-sm" title="Exclusive Space">
            <SparklesIcon className="w-3 h-3" />
          </span>
        )}
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-6 line-clamp-3 leading-relaxed opacity-80">
        {space.description}
      </p>
      
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        {isExclusive && (
            <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded border border-amber-500/20">Exclusive</span>
        )}
        
        {isGpuEnabled ? (
          <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded border border-blue-500/20 flex items-center gap-1">
            <CpuChipIcon className="w-2.5 h-2.5" />
            GPU Link
          </span>
        ) : (
          <span className="px-2 py-1 bg-white/5 text-[var(--text-muted)] text-[9px] font-black uppercase tracking-widest rounded border border-white/10">Standard Compute</span>
        )}
        
        {space.is_public ? (
          <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[9px] font-black uppercase tracking-widest rounded border border-green-500/20">Public</span>
        ) : (
          <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-[9px] font-black uppercase tracking-widest rounded border border-purple-500/20">Identity Locked</span>
        )}
      </div>
      
      {showDonateCTA ? (
        <button 
          className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-xl text-sm font-bold transition-all border border-amber-500/20"
          onClick={(e) => {
              e.stopPropagation();
              alert("Exclusive Space: A $5 one-time donation is required to unlock this workspace.");
          }}
        >
          Donate $5 to Unlock
        </button>
      ) : (
        <button 
          className="w-full py-2.5 bg-white/5 hover:bg-[var(--accent)] hover:text-white text-[var(--text-primary)] rounded-xl text-sm font-bold transition-all border border-white/5 hover:border-transparent"
          onClick={(e) => {
              e.stopPropagation();
              onEnter(space);
          }}
        >
          Enter Workspace
        </button>
      )}
    </div>
  );
};

export default SpaceCard;
