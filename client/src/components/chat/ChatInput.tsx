import React from 'react';
import ProviderSelector from '../ProviderSelector';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (e: React.FormEvent) => void;
  loading: boolean;
  currentConvId: number | null;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  loading,
  currentConvId
}) => {
  return (
    <footer className="px-6 pb-5 pt-3 bg-transparent border-t border-black/[0.04] z-20">
      <div className="max-w-4xl mx-auto mb-3">
        <ProviderSelector />
      </div>
      <form onSubmit={onSend} className="max-w-4xl mx-auto">
        {/* Main Input Container */}
        <div className="relative bg-[#E2E6EC] border border-black/[0.08] rounded-2xl overflow-hidden shadow-md transition-all focus-within:border-[#FF6600]/40 focus-within:shadow-lg focus-within:shadow-[#FF6600]/5">
          {/* Function Buttons Row */}
          <div className="flex items-center gap-1 px-3 pt-2.5 pb-0">
            {/* Attachments */}
            <button
              type="button"
              onClick={() => alert('File attachments — coming soon!')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05] transition-all"
              title="Attach files"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attach
            </button>

            {/* Tools */}
            <button
              type="button"
              onClick={() => alert('Tools selector — coming soon!')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#1A1D2E] hover:bg-black/[0.05] transition-all"
              title="Select tools"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tools
              <svg className="w-2.5 h-2.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Agent Mode */}
            <button
              type="button"
              onClick={() => alert('Agent mode — coming soon!')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#4A4D5E] hover:text-[#FF6600] hover:bg-[#FF6600]/8 transition-all"
              title="Toggle agent mode"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Agent
            </button>

            <div className="flex-1" />
          </div>

          {/* Textarea + Send Row */}
          <div className="flex items-end gap-3 px-3 pb-3 pt-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend(e);
                }
              }}
              placeholder={currentConvId ? "What would you like to build today?" : "Select a workspace to begin..."}
              disabled={!currentConvId}
              className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none px-2 py-2 text-sm text-[#1A1D2E] placeholder:text-[#7A7D8E] resize-none min-h-[44px] max-h-[160px]"
              rows={1}
            />
            {/* Send Button — Prominent Round Orange */}
            <button
              type="submit"
              disabled={loading || !input.trim() || !currentConvId}
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                loading || !input.trim() || !currentConvId
                  ? 'bg-[#BFC4CC] text-[#7A7D8E] cursor-not-allowed' 
                  : 'bg-[#FF6600] text-white hover:bg-[#E65C00] shadow-lg shadow-[#FF6600]/30 hover:shadow-[#FF6600]/50 active:scale-95'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </footer>
  );
};

export default ChatInput;
