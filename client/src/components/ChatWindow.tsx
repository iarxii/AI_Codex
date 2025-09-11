import React, { useRef, useEffect, useState } from 'react';
import ChatMessage from './ChatMessage';
import orgLogo from '../assets/Gauteng-Department-of-Health-Logo-1024x577-962373668.jpg';
import geminiLogo from '../assets/ai_online_services/gemini-color.svg';
import openaiLogo from '../assets/ai_online_services/openai-svgrepo-com.svg';

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
  provider: 'openai' | 'gemini';
  onSuggestedPromptClick: (prompt: string) => void;
};
const ChatWindow: React.FC<ChatWindowProps> = ({ messages, loading, provider, onSuggestedPromptClick }) => {
  const endRef = useRef<HTMLDivElement>(null);
  const currentProviderLogo = provider === 'gemini' ? geminiLogo : openaiLogo;
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "What are the latest public health advisories for Gauteng?",
    "Analyze the impact of TB on the mining industry in South Africa.",
    "Provide a summary of the latest HIV/AIDS treatment guidelines in South Africa.",
    "What are the current vaccination rates for measles in the Gauteng province?",
  ]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    // You can replace this with an API call to fetch prompts from the server
    // and update the state with the new prompts.
    // For now, we'll just keep the existing prompts.
    // Example:
    // fetch('/api/prompts').then(res => res.json()).then(data => setSuggestedPrompts(data));
    // Make sure to handle errors appropriately.
  }, []);

  return (
    <div className="flex-1 p-5 mb-4 overflow-y-auto bg-gray-50 shadow" style={{ paddingBottom: '80px', borderRadius: '12px' }}>
      <div className="space-y-4">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-full flex justify-center my-4">
              <img src={orgLogo} alt={`welcome`} className="w-[150px] h-[100px] rounded-[12px] full bg-white p-2 shadow-md" style={{ objectFit: 'contain' }} />
            </div>

            <div className='text-center'>
              <h3 className="mb-2 text-lg font-semibold text-[#02396e] font-bold" style={{ fontSize: '24px', fontWeight: 'bold', color: '#02396e' }}>Welcome back!</h3>
              <div className="mb-4 text-lg font-semibold text-gray-700">No messages yet</div>
            </div>

            <div className="border-b border-gray-200 [#196ab8] w-full mt-4 mb-5"></div>

            <div className="mb-2">Start a conversation or try one of these prompts:</div>
            <ul className="mb-4 space-y-2">
              {suggestedPrompts.map((prompt, index) => (
                <li
                  key={index}
                  className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 transition"
                  onClick={() => onSuggestedPromptClick(prompt)}
                >
                  {prompt}
                </li>
              ))}
            </ul>
            <div className="text-sm text-gray-400 mb-4">Or type your own question below to get started.</div>

            {/* <div className="border-b border-[#196ab8] gray-200 w-full mt-4 mb-5"></div> */}

            <div className="w-full flex flex-col items-center justify-center mb-4">
              <img src={currentProviderLogo} alt={`${provider} logo`} className="w-[50px] h-[50px] rounded-full bg-white p-2 shadow-md mb-1" />
              <small>{provider}</small>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} {...msg} />
            ))}
            {loading && <ChatMessage sender="bot" content="..." provider={provider} />}
          </>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};
export default ChatWindow;
