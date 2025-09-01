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
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={loading}
        placeholder="Type your message..."
        style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
      />
      <button type="submit" disabled={loading || !value.trim()} style={{ padding: '0 16px', borderRadius: 8, background: '#1a237e', color: '#fff', border: 'none' }}>
        Send
      </button>
    </form>
  );
};

export default ChatInput;
