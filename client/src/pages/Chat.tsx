import React, { useState } from 'react';
import Layout from './_Layout';
import ChatWindow from '../components/ChatWindow';
import ChatInput from '../components/ChatInput';
import ProviderSelector from '../components/ProviderSelector';

// Message type for chat history
type Message = {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  provider?: string;
  timestamp?: string;
};

// Helper to generate unique IDs for messages
const generateUniqueId = () => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [loading, setLoading] = useState(false);

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
      const response = await fetch('http://localhost:3000/', {
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
        content: 'Something went wrong: ' + (err.message || err),
        provider,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      {/* Provider selection dropdown */}
      <ProviderSelector provider={provider} setProvider={setProvider} />
      {/* Chat history window */}
      <ChatWindow messages={messages} loading={loading} />
      {/* Input box for sending messages */}
      <ChatInput 
        onSend={handleSend}
        loading={loading}
      />
    </Layout>
  );
};

export default Chat;
