

import React from 'react';
import ReactMarkdown from 'react-markdown';
import userSvg from '../assets/user.svg';
import botSvg from '../assets/bot.svg';

type ChatMessageProps = {
  sender: 'user' | 'bot';
  content: string;
  provider?: string;
  timestamp?: string;
};



const ChatMessage: React.FC<ChatMessageProps> = ({ sender, content }) => {
  const isUser = sender === 'user';
  const avatar = isUser ? userSvg : botSvg;
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar on left for bot, right for user */}
      {!isUser && (
        <img src={avatar} alt="bot" className="w-8 h-8 p-2 rounded-full shadow border border-gray-300 bg-gray-800" />
      )}
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg break-words whitespace-pre-wrap ${
          isUser
            ? 'bg-indigo-600 text-white rounded-br-none chat-bubble-user'
            : 'bg-gray-200 text-gray-800 rounded-bl-none chat-bubble-bot'
        }`}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      {isUser && (
        <img src={avatar} alt="user" className="w-8 h-8 p-2 rounded-full shadow border border-gray-300 bg-gray-800" />
      )}
    </div>
  );
};

export default ChatMessage;
