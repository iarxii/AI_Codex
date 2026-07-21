import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PortalSwitcherProps {
  isDark?: boolean;
}

export const PortalSwitcher: React.FC<PortalSwitcherProps> = ({ isDark = false }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isChatLite = location.pathname === '/lite-chat';

  return (
    <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
      isDark 
        ? 'bg-black/25 border-white/10' 
        : 'bg-black/5 border-black/[0.06]'
    } backdrop-blur-md`}>
      <button
        onClick={() => navigate('/chat')}
        className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 ${
          !isChatLite
            ? 'bg-[#fd3b12] text-white shadow-md shadow-[#fd3b12]/20 font-black'
            : isDark
              ? 'text-white/60 hover:text-white hover:bg-white/5'
              : 'text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/5'
        }`}
      >
        Workspace
      </button>
      <button
        onClick={() => navigate('/lite-chat')}
        className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 ${
          isChatLite
            ? 'bg-[#fd3b12] text-white shadow-md shadow-[#fd3b12]/20 font-black'
            : isDark
              ? 'text-white/60 hover:text-white hover:bg-white/5'
              : 'text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/5'
        }`}
      >
        Chat (LiteRT)
      </button>
    </div>
  );
};

export default PortalSwitcher;
