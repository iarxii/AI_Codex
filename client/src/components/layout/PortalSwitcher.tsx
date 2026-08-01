import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAI } from '../../contexts/AIContext';

interface PortalSwitcherProps {
  isDark?: boolean;
}

export const PortalSwitcher: React.FC<PortalSwitcherProps> = ({ isDark = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { provider, setProvider } = useAI();

  const isChatLite = location.pathname === '/chat';

  const handlePortalSwitch = (targetPortal: 'workspace' | 'chat') => {
    if (targetPortal === 'chat') {
      // Switch to LiteRT for lite-chat portal
      setProvider('litert');
      navigate('/chat');
    } else {
      // Switch back to local (Ollama/llama.cpp) for workspace portal
      if (provider === 'litert') {
        setProvider('local');
      }
      navigate('/workspace');
    }
  };

  return (
    <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
      isDark 
        ? 'bg-black/25 border-white/10' 
        : 'bg-black/5 border-black/[0.06]'
    } backdrop-blur-md`}>
      <button
        onClick={() => handlePortalSwitch('workspace')}
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
        onClick={() => handlePortalSwitch('chat')}
        className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 ${
          isChatLite
            ? 'bg-[#fd3b12] text-white shadow-md shadow-[#fd3b12]/20 font-black'
            : isDark
              ? 'text-white/60 hover:text-white hover:bg-white/5'
              : 'text-[#4A4D5E] hover:text-[#fd3b12] hover:bg-black/5'
        }`}
      >
        Chat
      </button>
    </div>
  );
};

export default PortalSwitcher;
