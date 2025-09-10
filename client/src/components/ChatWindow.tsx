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
    <div className="flex-1 p-5 overflow-y-auto bg-gray-50 shadow" style={{ paddingBottom: '80px', borderRadius: '12px' }}>
      <div className="space-y-4">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-gray-500">
            <div className="mb-4 text-lg font-semibold text-gray-700">No messages yet</div>
            <div className="mb-2">Start a conversation or try one of these prompts:</div>
            <ul className="mb-4 space-y-2">
              <li className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 transition">What are the symptoms of flu vs. cold?</li>
              <li className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 transition">Summarize this medical document for me.</li>
              <li className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 transition">What are the side effects of ibuprofen?</li>
              <li className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 transition">How can I improve my sleep quality?</li>
            </ul>
            <div className="text-sm text-gray-400">Or type your own question below to get started.</div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} {...msg} />
            ))}
            {loading && <ChatMessage sender="bot" content="..." />}
          </>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
