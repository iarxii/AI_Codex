import React, { useState } from 'react';

type ChatInputProps = {
  onSend: (msg: string) => void;
  loading: boolean;
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading }) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSend(value);
      setValue('');
    }
  };

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <form onSubmit={handleSubmit} className="flex items-center space-x-4">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
