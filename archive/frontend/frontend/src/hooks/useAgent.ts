import { useState, useEffect, useCallback, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AgentMessage {
  type: 'token' | 'status' | 'error' | 'done';
  content?: string;
  status?: string;
  message?: string;
}

export const useAgent = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = '127.0.0.1:8000';
    const path = `/ws/agent${conversationId ? `?conversation_id=${conversationId}` : ''}`;
    const url = `${protocol}//${host}${path}`;

    console.log('Connecting to WebSocket:', url);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected');
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data: AgentMessage = JSON.parse(event.data);
        console.log('WebSocket Message:', data);

        switch (data.type) {
          case 'status':
            setIsTyping(true);
            break;
          case 'token':
            setIsTyping(true);
            updateLastAssistantMessage(data.content || '');
            break;
          case 'done':
            setIsTyping(false);
            break;
          case 'error':
            setError(data.message || 'An error occurred');
            setIsTyping(false);
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected');
      setIsConnected(false);
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setError('Connection error. Retrying...');
    };
  }, [conversationId]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const updateLastAssistantMessage = (token: string) => {
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + token
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            role: 'assistant',
            content: token,
            timestamp: new Date(),
          },
        ];
      }
    });
  };

  const sendAgentMessage = (content: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const userMsg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      socketRef.current.send(JSON.stringify({ message: content }));
    } else {
      setError('Not connected to agent server');
    }
  };

  return {
    messages,
    sendAgentMessage,
    isTyping,
    isConnected,
    error,
  };
};
