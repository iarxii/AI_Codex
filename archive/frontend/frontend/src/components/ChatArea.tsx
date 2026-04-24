import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Terminal, Shield, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgent } from '../hooks/useAgent';
import './ChatArea.css';

interface ChatAreaProps {
  conversationId: string | null;
}

const ChatArea: React.FC<ChatAreaProps> = ({ conversationId }) => {
  const { messages, sendAgentMessage, isTyping, isConnected, error: agentError } = useAgent(conversationId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || !isConnected) return;
    sendAgentMessage(input);
    setInput('');
  };

  const formatTime = (timestamp: any) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="chat-area">
      <header className="chat-header">
        <div className="chat-info">
          <h2>{conversationId ? 'Fixing GPT Logic' : 'AICodex Agent'}</h2>
          <span className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
            <span className="dot"></span> {isConnected ? 'Online' : 'Connecting...'}
          </span>
        </div>
        <div className="chat-actions">
          <button className="btn-secondary btn-sm">
            <Shield size={16} />
            <span>Sandbox On</span>
          </button>
        </div>
      </header>

      <div className="messages-container">
        {(!messages || messages.length === 0) && !isTyping && (
          <div className="initial-state">
            <div className="welcome-card glass">
              <h3>Welcome to AICodex</h3>
              <p>Your local agentic workflow is ready. How can I help you today?</p>
            </div>
          </div>
        )}
        <div className="messages-list" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`message-wrapper ${msg.role}`}
              >
                <div className="message-bubble">
                  <p>{msg.content}</p>
                  <span className="message-time">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div 
                key="typing"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="message-wrapper assistant typing"
              >
                <div className="message-bubble">
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {agentError && <div className="error-banner">{agentError}</div>}
        <div ref={messagesEndRef} style={{ float: "left", clear: "both" }} />
      </div>

      <div className="input-container">
        <div className="input-wrapper glass">
          <button className="input-action-btn">
            <Paperclip size={20} />
          </button>
          <textarea 
            rows={1}
            placeholder={isConnected ? "Describe your task..." : "Waiting for connection..."} 
            value={input}
            disabled={!isConnected}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          />
          <button className="btn btn-primary send-btn" onClick={handleSend} disabled={!isConnected || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
        <div className="input-footer">
          <Terminal size={14} />
          <span>Agent ready for tool execution</span>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
