import React, { useState, useEffect } from 'react';
// import Layout from './_Layout';
import ChatWindow from '../components/ChatWindow';
import ChatInput from '../components/ChatInput';

// Message type for chat history
type Message = {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  provider?: string;
  timestamp?: string;
};

const API_BASE_URL = 'http://localhost:3000';

// Helper to generate unique IDs for messages
const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Chat: React.FC<{ provider: 'openai' | 'gemini' }> = ({ provider }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');

  useEffect(() => {
    // Fetch messages for the selected conversation from the server
    const fetchMessages = async () => {
      const response = await fetch(`http://localhost:3000/api/conversations/1`);
      const data = await response.json();
      setMessages(data.messages);
    };

    fetchMessages();
  }, []);


  // Handle sending a message
  const handleSend = async (msg: string) => {
    if (!msg.trim()) return;

    // Add user message to chat
    const userMsg: Message = {
      id: generateUniqueId(),
      sender: 'user',
      content: msg,
      provider,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Send POST request to server
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: msg, provider }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      // Add bot message to chat
      const botMsg: Message = {
        id: generateUniqueId(),
        sender: 'bot',
        content: data.bot?.trim() || 'No response',
        provider,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      // Add error message to chat
      setMessages(prev => [...prev, {
        id: generateUniqueId(),
        sender: 'bot',
        content: provider + ' error: Something went wrong: ' + (err.message || err),
        provider,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedPromptClick = (prompt: string) => {
    setCurrentPrompt(prompt);
  };

  return (
    <>
      {/* Chat history window */}
      <ChatWindow
        onSuggestedPromptClick={handleSuggestedPromptClick}
        messages={messages}
        loading={loading}
        provider={provider}
      />
      {/* Input box for sending messages */}
      <ChatInput
        onSend={handleSend}
        loading={loading}
        initialValue={currentPrompt}
      />
    </>
  );
};

export default Chat;
