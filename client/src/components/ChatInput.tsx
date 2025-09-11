import React, { useState, useEffect, useRef } from 'react';

type ChatInputProps = {
  onSend: (msg: string) => void;
  loading: boolean;
   initialValue?: string;
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, loading, initialValue = '' }) => {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const MAX_HEIGHT_PX = 120; // Maximum height for the textarea
  const MAX_LENGTH = 500; // Maximum character length for the input

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height to recalculate
      const newHeight = Math.min(textareaRef.current.scrollHeight, MAX_HEIGHT_PX);
      textareaRef.current.style.height = `${newHeight}px`;
      // A textarea is considered "expanded" if its height is greater than the initial single-line height (44px).
      setIsExpanded(newHeight > 44);
    }
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSend(value);
      setValue('');
      setIsExpanded(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; // Reset height after sending
      }
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 bg-[#00509d] -gray-800" style={{ boxShadow: '0 -2px 5px rgba(0, 0, 0, 0.1)' , position: 'sticky', bottom: 0, zIndex: 10 , borderRadius: '12px' }}>
      <form onSubmit={handleSubmit} className="flex items-center space-x-4">
        <textarea
          name="userInput"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          placeholder="Type your message..."
          className={`flex-1 px-4 py-2 border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 ${isExpanded ? 'rounded-2xl' : 'rounded-full'}`}
          style={{ resize: 'none', overflowY: 'auto', minHeight: '44px' }} // minHeight to match input's default height
          rows={1}
          ref={textareaRef}
          maxLength={MAX_LENGTH}
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="flex flex-col items-center justify-center px-4 py-2 bg-white text-[#00509d] rounded-full hover:text-white hover:bg-[#02396e] disabled:text-gray-400 disabled:bg-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
          <span className="text-xs mt-1">Send</span>
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
