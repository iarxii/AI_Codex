import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

const AppLogo: React.FC<AppLogoProps> = ({ className = "", size = 'md', showTagline = true }) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  const titleClasses = {
    sm: 'text-3xl',
    md: 'text-4xl',
    lg: 'text-5xl'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} mx-auto mb-4 flex flex-col items-center justify-center drop-shadow-2xl`}>
        <img
          src="/media/aicodex-spirit-bird.png"
          alt="AICodex Logo"
          className="w-full h-full object-contain rounded-3xl border-2 border-[var(--accent)]"
        />
        {showTagline && (
          <span className="text-[6px] my-2 font-display uppercase tracking-[0.2em] text-[var(--accent)] flex items-center gap-1.5 opacity-90">
            Spirit Bird&trade;
          </span>
        )}
      </div>

      <h1 className={`${titleClasses[size]} font-extrabold mb-4 text-[var(--text-primary)]`}>
        AI<span className="text-[var(--accent)]">Codex</span>
      </h1>
    </div>
  );
};

export default AppLogo;
