import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { PROVIDERS, type ProviderId } from './providerMeta';
import { useAI, type VisualSettings } from '../contexts/AIContext';
import OllamaLogo from '../assets/ai_online_services/ollama-color.svg';
import { config } from '../config';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

type SettingsModalProps = {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
};

/** Inline SVG icons for providers without image assets */
/** Map provider ID to its icon component */
const ProviderIcon: React.FC<{ providerId: string; size?: number }> = ({ providerId, size = 28 }) => {
  switch (providerId) {
    case 'local':
    case 'ollama_cloud':
      return <img src={OllamaLogo} alt="Ollama" style={{ width: size, height: size }} />;
    case 'groq':
      return <img src="/media/brand-icons/white-grok-logo_svgstack_com_37181777229567.svg" alt="Groq" style={{ width: size, height: size }} className="object-contain drop-shadow-sm" />;
    case 'openrouter':
      return <img src="/media/brand-icons/openrouter.webp" alt="OpenRouter" style={{ width: size, height: size }} className="object-contain" />;
    case 'gemini':
      return <img src="/media/brand-icons/gemini-logo_svgstack_com_37141777229654.svg" alt="Gemini" style={{ width: size, height: size }} className="object-contain" />;
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
  const [ollamaCloudKey, setOllamaCloudKey] = useState('');
  const [ollamaCloudUrl, setOllamaCloudUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveProvider(provider);
      setGroqKey(localStorage.getItem('groq_api_key') || '');
      setOpenRouterKey(localStorage.getItem('openrouter_api_key') || '');
      setGeminiKey(localStorage.getItem('gemini_api_key') || '');
      setOllamaCloudKey(localStorage.getItem('ollama_cloud_key') || '');
      setOllamaCloudUrl(localStorage.getItem('ollama_cloud_url') || 'https://ollama.com');
    }
  }, [isOpen, provider]);

  const testOllamaCloud = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {
        'X-Base-Url': ollamaCloudUrl || 'https://ollama.com'
      };
      if (ollamaCloudKey) headers['X-API-Key'] = ollamaCloudKey;

      const response = await fetch(`${config.API_BASE_URL}${config.API_V1_STR}/models?provider=ollama_cloud`, {
        headers
      });
      
      if (response.ok) {
        const models = await response.json();
        setTestResult({ 
          success: true, 
          message: models.length > 0 ? `Connected! Found ${models.length} models.` : "Connected, but no models found." 
        });
      } else {
        const err = await response.json();
        setTestResult({ success: false, message: err.detail || "Connection failed." });
      }
    } catch (e) {
      setTestResult({ success: false, message: "Network error. Check URL." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setProvider(activeProvider);
    localStorage.setItem('groq_api_key', groqKey);
    localStorage.setItem('openrouter_api_key', openRouterKey);
    localStorage.setItem('gemini_api_key', geminiKey);
    localStorage.setItem('ollama_cloud_key', ollamaCloudKey);
    localStorage.setItem('ollama_cloud_url', ollamaCloudUrl);
    
    // Dispatch custom event for parts of the app not yet using Context
    window.dispatchEvent(new Event('ai-settings-changed'));
    setIsOpen(false);
    
    // Force a hard reload to reset P5 and video buffers
    window.location.reload();
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
                  <div className="grid grid-cols-5 gap-2">
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

                  {activeProvider === 'ollama_cloud' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">Remote Ollama URL</label>
                        <input 
                          type="text" 
                          value={ollamaCloudUrl}
                          onChange={(e) => setOllamaCloudUrl(e.target.value)}
                          placeholder="https://ollama.your-domain.com"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">Authorization Token (Optional)</label>
                        <input 
                          type="password" 
                          value={ollamaCloudKey}
                          onChange={(e) => setOllamaCloudKey(e.target.value)}
                          placeholder="Bearer token or API key"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testOllamaCloud}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isTesting 
                              ? 'bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed'
                              : 'bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]'
                          }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${
                            testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {testResult.success ? <CheckCircleIcon className="w-4 h-4" /> : <ExclamationCircleIcon className="w-4 h-4" />}
                            {testResult.message}
                          </div>
                        )}
                      </div>
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
                      { key: 'showMonochrome', label: 'Monochrome Neural Phosphor' },
                      { key: 'showWaves', label: 'Great Neural Waves' },
                      { key: 'showGrain', label: 'Cinematic Film Grain' },
                      { key: 'showGlitches', label: 'Digital Glitch Artifacts' },
                      { key: 'showVideo', label: 'High-Fi Video Layer' },
                      { key: 'showStillBackground', label: 'Static Vector Wallpaper' },
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
