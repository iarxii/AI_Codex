import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  provider?: string;
  timestamp?: string;
};

type ChatWindowProps = {
  messages: Message[];
  loading: boolean;
};

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, loading }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
      <div className="space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} {...msg} />
        ))}
        {loading && <ChatMessage sender="bot" content="..." />}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
