import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Shield, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './ChatArea.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ChatAreaProps {
  conversationId: string | null;
}

const ChatArea: React.FC<ChatAreaProps> = ({ conversationId }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'system', content: 'AICodex Engine v0.1.0 Ready. Local inference enabled.', timestamp: new Date() },
    { id: '2', role: 'assistant', content: "Hello! I'm your AICodex agent. How can I help you with your local development today?", timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    // Simulate agent response
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've received your request about: "${input}". Scanning local workspace context...`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  return (
    <div className="chat-area">
      <header className="chat-header">
        <div className="chat-info">
          <h2>{conversationId ? 'Fixing GPT Logic' : 'AICodex Agent'}</h2>
          <span className="status-badge"><span className="dot"></span> Online</span>
        </div>
        <div className="chat-actions">
          <button className="btn-secondary btn-sm">
            <Shield size={16} />
            <span>Sandbox On</span>
          </button>
        </div>
      </header>

      <div className="messages-container">
        <AnimatePresence>
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
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <div className="input-wrapper glass">
          <button className="input-action-btn">
            <Paperclip size={20} />
          </button>
          <textarea 
            rows={1}
            placeholder="Describe your task..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          />
          <button className="btn btn-primary send-btn" onClick={handleSend}>
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
