import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { PROVIDERS, type ProviderId } from './providerMeta';
import { useAI, type VisualSettings } from '../contexts/AIContext';
import OllamaLogo from '../assets/ai_online_services/ollama-color.svg';
import GeminiLogo from '../assets/ai_online_services/gemini-color.svg';

type SettingsModalProps = {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
};

/** Inline SVG icons for providers without image assets */
const GroqIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#FF6600" stroke="#FF6600" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const OpenRouterIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="#06B6D4" strokeWidth="1.5"/>
    <path d="M2 12h20M12 2c-3 3-4.5 6-4.5 10s1.5 7 4.5 10c3-3 4.5-6 4.5-10S15 5 12 2z" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/** Map provider ID to its icon component */
const ProviderIcon: React.FC<{ providerId: string; size?: number }> = ({ providerId, size = 28 }) => {
  switch (providerId) {
    case 'local':
      return <img src={OllamaLogo} alt="Ollama" style={{ width: size, height: size }} />;
    case 'groq':
      return <GroqIcon />;
    case 'openrouter':
      return <OpenRouterIcon />;
    case 'gemini':
      return <img src={GeminiLogo} alt="Gemini" style={{ width: size, height: size }} />;
    default:
      return <span style={{ fontSize: size * 0.7 }}>🤖</span>;
  }
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, setIsOpen }) => {
  const { provider, setProvider, visualSettings, updateVisualSetting } = useAI();
  const [activeProvider, setActiveProvider] = useState<ProviderId>(provider);
  const [groqKey, setGroqKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveProvider(provider);
      setGroqKey(localStorage.getItem('groq_api_key') || '');
      setOpenRouterKey(localStorage.getItem('openrouter_api_key') || '');
      setGeminiKey(localStorage.getItem('gemini_api_key') || '');
    }
  }, [isOpen, provider]);

  const handleSave = () => {
    setProvider(activeProvider);
    localStorage.setItem('groq_api_key', groqKey);
    localStorage.setItem('openrouter_api_key', openRouterKey);
    localStorage.setItem('gemini_api_key', geminiKey);
    
    // Dispatch custom event for parts of the app not yet using Context
    window.dispatchEvent(new Event('ai-settings-changed'));
    setIsOpen(false);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-[#E2E6EC] border border-black/[0.06] p-6 text-left align-middle shadow-2xl transition-all">
                {/* Header */}
                <div className="flex justify-between items-center mb-5">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-[#1A1D2E] flex items-center gap-2">
                    <Cog6ToothIcon className="w-5 h-5 text-[#FF6600]" />
                    Provider Settings
                  </Dialog.Title>
                  <button onClick={() => setIsOpen(false)} className="text-[#7A7D8E] hover:text-[#1A1D2E] transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-xs text-[#4A4D5E] mb-6 leading-relaxed">
                  Select your default AI provider and configure API keys. Keys are stored in your browser's local storage and sent directly to the inference engine.
                </p>

                {/* Provider Radio Group */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[#4A4D5E] uppercase tracking-wider mb-3">
                    Default Provider
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PROVIDERS.map((provider) => {
                      const isActive = activeProvider === provider.id;
                      return (
                        <button
                          key={provider.id}
                          onClick={() => setActiveProvider(provider.id)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${
                            isActive
                              ? 'bg-[#FF6600]/10 border-[#FF6600] shadow-md shadow-[#FF6600]/10'
                              : 'bg-[#D8DCE4] border-transparent hover:bg-[#D0D4DC] hover:border-black/[0.08]'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF6600] shadow-[0_0_6px_rgba(255,102,0,0.7)]" />
                          )}
                          <ProviderIcon providerId={provider.id} size={28} />
                          <span className={`text-[11px] font-semibold ${isActive ? 'text-[#FF6600]' : 'text-[#4A4D5E]'}`}>
                            {provider.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Conditional API Key Inputs */}
                <div className="space-y-4">
                  {activeProvider === 'local' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-xs text-green-700 font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Using local Ollama GPU — no API key needed
                      </p>
                      <p className="text-[10px] text-green-600/70 mt-1.5">Ensure Ollama is running on localhost:11434</p>
                    </div>
                  )}

                  {activeProvider === 'groq' && (
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">Groq API Key</label>
                      <input 
                        type="password" 
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        placeholder="gsk_..."
                        className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                      />
                    </div>
                  )}

                  {activeProvider === 'openrouter' && (
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">OpenRouter API Key</label>
                      <input 
                        type="password" 
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                      />
                    </div>
                  )}

                  {activeProvider === 'gemini' && (
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">Google Gemini API Key</label>
                      <input 
                        type="password" 
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="AIza..."
                        className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Visual Identity Toggles */}
                <div className="mt-8 pt-6 border-t border-black/[0.06]">
                  <label className="block text-xs font-semibold text-[#4A4D5E] uppercase tracking-wider mb-4">
                    Neural Identity & Effects
                  </label>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { key: 'isDynamic', label: 'Motion & Animations' },
                      { key: 'showTraces', label: 'Neural Energy Traces' },
                      { key: 'showNeuralStrings', label: 'Neural Drifting Strings' },
                      { key: 'showScanlines', label: 'CRT Scanlines' },
                      { key: 'showWaves', label: 'Great Neural Waves' },
                      { key: 'showGrain', label: 'Cinematic Film Grain' },
                      { key: 'showGlitches', label: 'Digital Glitch Artifacts' },
                      { key: 'showVideo', label: 'High-Fi Video Layer' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between group">
                        <span className="text-sm text-[#1A1D2E] font-medium group-hover:text-[#FF6600] transition-colors">
                          {item.label}
                        </span>
                        <button
                          onClick={() => updateVisualSetting(item.key as keyof VisualSettings, !visualSettings[item.key as keyof VisualSettings])}
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            visualSettings[item.key as keyof VisualSettings] ? 'bg-[#FF6600]' : 'bg-[#D8DCE4]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              visualSettings[item.key as keyof VisualSettings] ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* String Color Selector */}
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm text-[#1A1D2E] font-medium">Neural String Color</span>
                    <div className="flex bg-[#D8DCE4] p-1 rounded-lg">
                      {(['orange', 'white', 'dark'] as const).map((color) => (
                        <button
                          key={color}
                          onClick={() => updateVisualSetting('stringColor', color)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                            visualSettings.stringColor === color 
                              ? 'bg-[#FF6600] text-white shadow-sm' 
                              : 'text-[#4A4D5E] hover:text-[#1A1D2E]'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-xl border border-black/[0.08] bg-transparent px-5 py-2.5 text-sm font-medium text-[#4A4D5E] hover:bg-black/[0.04] hover:text-[#1A1D2E] focus:outline-none transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-xl border border-transparent bg-[#FF6600] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#E65C00] focus:outline-none transition-all shadow-lg shadow-[#FF6600]/25"
                    onClick={handleSave}
                  >
                    Save Changes
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SettingsModal;
