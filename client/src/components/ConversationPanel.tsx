import React from 'react';
import ProviderSelector from './ProviderSelector';

type Conversation = {
  id: number;
  title: string;
};

type ConversationPanelProps = {
  conversations: Conversation[];
  onSelectConversation: (id: number) => void;
  onCreateNew: () => void;
  provider: 'openai' | 'gemini';
  setProvider: (p: 'openai' | 'gemini') => void;
};

const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversations,
  onSelectConversation,
  onCreateNew,
  provider,
  setProvider,
}) => {
  return (
    <div className="bg-[#00509d] text-white h-full p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-bold mb-4">History</h2>
        <button
          onClick={onCreateNew}
          className="w-full bg-white text-[#00509d] hover:text-white hover:bg-[#02396e] font-bold py-2 px-4 rounded mb-4"
        >
          + New Chat
        </button>
        <div className="flex-grow overflow-y-auto max-h-[calc(100vh-400px)]"> {/* Adjusted max-h to account for header and footer */}
          {conversations.length > 0 ? (
            conversations.map((convo) => (
              <div
                key={convo.id}
                onClick={() => onSelectConversation(convo.id)}
                className="p-2 mb-2 text-white hover:bg-[#02396e] rounded cursor-pointer truncate"
              >
                {convo.title}
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm text-center mt-4">No conversations yet. Start a new chat!</p>
          )}
        </div>
      </div>

      <div>
        <ProviderSelector provider={provider} setProvider={setProvider} />
        <div className="text-center text-xs text-gray-400 border-t border-gray-700 pt-4">
          <p className="mb-2">&copy; {new Date().getFullYear()} GP HealthMedAgentix</p>
          <button
            onClick={() => window.location.href = "mailto:support@example.com?subject=Support Request from HealthMedAgentix"}
            className="inline-flex items-center justify-center bg-white text-[#00509d] hover:text-white hover:bg-[#02396e] text-xs py-1 px-3 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span>Support</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationPanel;
