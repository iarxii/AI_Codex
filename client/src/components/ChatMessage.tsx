import React from 'react';

type ChatMessageProps = {
  sender: 'user' | 'bot';
  content: string;
  provider?: string;
  timestamp?: string;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ sender, content }) => (
  <div className={`flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div
      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        sender === 'user'
          ? 'bg-indigo-600 text-white rounded-br-none'
          : 'bg-gray-200 text-gray-800 rounded-bl-none'
      }`}
    >
      {content}
    </div>
  </div>
);

export default ChatMessage;
