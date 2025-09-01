import React from 'react';

type Conversation = {
  id: number;
  title: string;
};

type ConversationPanelProps = {
  conversations: Conversation[];
  onSelectConversation: (id: number) => void;
  onCreateNew: () => void;
};

const ConversationPanel: React.FC<ConversationPanelProps> = ({ conversations, onSelectConversation, onCreateNew }) => {
  return (
    <div className="bg-gray-800 text-white h-full p-4 flex flex-col">
      <h2 className="text-xl font-bold mb-4">History</h2>
      <button
        onClick={onCreateNew}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded mb-4"
      >
        + New Chat
      </button>
      <div className="flex-grow overflow-y-auto">
        {conversations.map((convo) => (
          <div
            key={convo.id}
            onClick={() => onSelectConversation(convo.id)}
            className="p-2 hover:bg-gray-700 rounded cursor-pointer truncate"
          >
            {convo.title}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationPanel;
