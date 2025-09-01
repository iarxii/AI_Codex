import React from 'react';

type ChatMessageProps = {
  sender: 'user' | 'bot';
  content: string;
  provider?: string;
  timestamp?: string;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ sender, content }) => (
  <div style={{
    display: 'flex',
    justifyContent: sender === 'user' ? 'flex-end' : 'flex-start',
    margin: '8px 0'
  }}>
    <div style={{
      background: sender === 'user' ? '#e3f2fd' : '#ede7f6',
      color: '#222',
      padding: '10px 16px',
      borderRadius: 16,
      maxWidth: 320
    }}>
      {content}
    </div>
  </div>
);

export default ChatMessage;
