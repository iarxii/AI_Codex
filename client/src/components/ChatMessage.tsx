

import React from 'react';
import ReactMarkdown from 'react-markdown';
import userSvg from '../assets/user.svg';
import botSvg from '../assets/bot.svg';
import geminiLogo from '../assets/ai_online_services/gemini-color.svg';
import openaiLogo from '../assets/ai_online_services/openai-svgrepo-com.svg';

type ChatMessageProps = {
  sender: 'user' | 'bot';
  content: string;
  provider?: string;
  timestamp?: string;
};



const ChatMessage: React.FC<ChatMessageProps> = ({ sender, content, provider }) => {
  const isUser = sender === 'user';

  const getBotAvatar = () => {
    switch (provider) {
      case 'gemini':
        return geminiLogo;
      case 'openai':
        return openaiLogo;
      default:
        return botSvg;
    }
  };

  const getUserAvatar = () => {
    // TODO: When auth is added, this could be `user.avatarUrl || userSvg`
    return userSvg;
  };

  const avatar = isUser ? getUserAvatar() : getBotAvatar();
  const avatarAlt = isUser ? 'user' : `${provider || 'bot'} logo`;
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Avatar on left for bot, right for user */}
      {!isUser && (
        <img src={avatar} alt={avatarAlt} className="w-8 h-8 p-1 rounded-full shadow border border-gray-300 bg-white" />
      )}
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg break-words whitespace-pre-wrap ${
          isUser
            ? 'bg-[#00509d] text-white rounded-br-none chat-bubble-user'
            : 'bg-gray-200 text-gray-800 rounded-bl-none chat-bubble-bot'
        }`}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      {isUser && (
        <img src={avatar} alt={avatarAlt} className="w-8 h-8 p-1 rounded-full shadow border border-gray-300 bg-[#00509d]" />
      )}
    </div>
  );
};

export default ChatMessage;
