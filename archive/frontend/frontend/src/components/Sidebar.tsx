import React from 'react';
import { MessageSquare, Plus, Settings, Brain, Zap } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  activeConversation: string | null;
  onSelectConversation: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeConversation, onSelectConversation }) => {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <Brain className="brand-icon" />
          <span className="brand-name">AICodex</span>
        </div>
        <button className="btn btn-primary new-chat-btn">
          <Plus size={18} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="sidebar-sections">
        <div className="section">
          <h3 className="section-title">Recent</h3>
          <div className="conversation-list">
            <button className={`nav-item ${activeConversation === '1' ? 'active' : ''}`} onClick={() => onSelectConversation('1')}>
              <MessageSquare size={18} />
              <span>Fixing GPT Logic</span>
            </button>
            <button className={`nav-item ${activeConversation === '2' ? 'active' : ''}`} onClick={() => onSelectConversation('2')}>
              <MessageSquare size={18} />
              <span>OllamaOpt Integration</span>
            </button>
          </div>
        </div>

        <div className="section">
          <h3 className="section-title">Tools</h3>
          <div className="tool-links">
            <button className="nav-item">
              <Zap size={18} />
              <span>Skills Manager</span>
            </button>
            <button className="nav-item">
              <img src="/icons/github.png" alt="GitHub" style={{ width: '18px', height: '18px', filter: 'brightness(0) invert(1)' }} />
              <span>GitHub Context</span>
            </button>
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="nav-item settings-btn">
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;
