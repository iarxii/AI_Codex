import React, { Fragment, useEffect, useState } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import { useAI } from '../contexts/AIContext';
import { config } from '../config';
import OllamaLogo from '../assets/ai_online_services/ollama-color.svg';
import GeminiLogo from '../assets/ai_online_services/gemini-color.svg';

const providers = [
  { id: 'local', name: 'OllamaOpt (Local LLM)', icon: <img src={OllamaLogo} alt="Local Logo" className="w-6 h-6 object-contain" /> },
  { id: 'ollama_cloud', name: 'Ollama (Remote Cloud)', icon: <img src={OllamaLogo} alt="Ollama Cloud Logo" className="w-6 h-6 object-contain" /> },
  { id: 'groq', name: 'Groq (Cloud)', icon: <img src="/media/brand-icons/white-grok-logo_svgstack_com_37181777229567.svg" alt="Groq Logo" className="w-6 h-6 object-contain drop-shadow-md" /> },
  { id: 'openrouter', name: 'OpenRouter (Cloud)', icon: <img src="/media/brand-icons/openrouter.webp" alt="OpenRouter Logo" className="w-6 h-6 object-contain" /> },
  { id: 'gemini', name: 'Gemini (Cloud)', icon: <img src="/media/brand-icons/gemini-logo_svgstack_com_37141777229654.svg" alt="Gemini Logo" className="w-6 h-6 object-contain" /> },
];

interface ProviderSelectorProps {
  showTelemetry: boolean;
  setShowTelemetry: (val: boolean) => void;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ showTelemetry, setShowTelemetry }) => {
  const { provider, setProvider, model, setModel } = useAI();
  const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  useEffect(() => {
    fetchModels();
  }, [provider]);

  const fetchModels = async () => {
    setLoading(true);
    let apiKey = '';
    if (provider === 'groq') apiKey = localStorage.getItem('groq_api_key') || '';
    else if (provider === 'openrouter') apiKey = localStorage.getItem('openrouter_api_key') || '';
    else if (provider === 'gemini') apiKey = localStorage.getItem('gemini_api_key') || '';

    try {
      const url = `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=${provider}`;
      const headers: Record<string, string> = {};
      if (apiKey) headers['X-API-Key'] = apiKey;
      
      if (provider === 'ollama_cloud') {
        const cloudUrl = localStorage.getItem('ollama_cloud_url');
        if (cloudUrl) headers['X-Base-Url'] = cloudUrl;
      }

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data);
        
        if (data.length > 0 && (!model || !data.find((m: any) => m.id === model))) {
          const persisted = localStorage.getItem(`ai_model_${provider}`);
          if (persisted && data.find((m: any) => m.id === persisted)) {
            setModel(persisted);
          } else {
            setModel(data[0].id);
          }
        }
      } else {
        setAvailableModels([]);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setAvailableModels([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = providers.find((p) => p.id === provider);
  
  const filteredModels = availableModels.filter(m => 
    m.name.toLowerCase().includes(modelSearch.toLowerCase()) || 
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const selectedModel = availableModels.find(m => m.id === model) || availableModels[0];

  return (
    <div className="mb-2 flex gap-3">
      <div className="flex-none flex flex-col justify-end">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-[#4A4D5E] mb-1.5 ml-1">
          Stats
        </span>
        <button
          type="button"
          onClick={() => setShowTelemetry(!showTelemetry)}
          className={`h-[42px] px-3 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
            showTelemetry 
              ? 'bg-[#FF6600]/10 border-[#FF6600]/30 text-[#FF6600] shadow-sm shadow-[#FF6600]/10' 
              : 'bg-[#E2E6EC] border-black/[0.08] text-[#7A7D8E] hover:bg-[#D8DCE4] hover:text-[#4A4D5E]'
          }`}
          title={showTelemetry ? "Hide Hardware Telemetry" : "Show Hardware Telemetry"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
      </div>

      <div className="flex-1">
        <Listbox value={provider} onChange={setProvider}>
          <div className="relative mt-1">
            <Listbox.Label className="block text-[10px] font-bold uppercase tracking-widest text-[#4A4D5E] mb-1.5 ml-1">
              AI Provider
            </Listbox.Label>
            <Listbox.Button className="relative w-full cursor-default rounded-xl bg-[#E2E6EC] border border-black/[0.08] py-2.5 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]/20 sm:text-xs transition-all hover:bg-[#D8DCE4]">
              <span className="flex items-center">
                {selectedProvider?.icon}
                <span className="ml-3 block truncate font-semibold text-[#1A1D2E]">{selectedProvider?.name}</span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-4 w-4 text-[#7A7D8E]" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
              <Listbox.Options className="absolute z-50 bottom-full mb-2 max-h-60 w-full overflow-auto rounded-xl bg-[#E2E6EC] border border-black/[0.1] py-1 text-xs shadow-xl focus:outline-none scrollbar-hide">
                {providers.map((p) => (
                  <Listbox.Option
                    key={p.id}
                    className={({ active }) => `relative cursor-pointer select-none py-2.5 pl-10 pr-4 transition-colors ${active ? 'bg-[#FF6600]/10 text-[#FF6600]' : 'text-[#4A4D5E]'}`}
                    value={p.id}
                  >
                    {({ selected }) => (
                      <>
                        <span className={`flex items-center truncate ${selected ? 'font-bold' : 'font-medium'}`}>
                          {p.icon}
                          <span className="ml-3">{p.name}</span>
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#FF6600]">
                            <CheckIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>

      <div className="flex-1">
        <Listbox value={model} onChange={setModel}>
          <div className="relative mt-1">
            <Listbox.Label className="block text-[10px] font-bold uppercase tracking-widest text-[#4A4D5E] mb-1.5 ml-1">
              Model Configuration
            </Listbox.Label>
            <Listbox.Button className="relative w-full cursor-default rounded-xl bg-[#E2E6EC] border border-black/[0.08] py-2.5 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]/20 sm:text-xs transition-all hover:bg-[#D8DCE4]">
              <span className="block truncate font-semibold text-[#1A1D2E]">{loading ? 'Loading models...' : (selectedModel?.name || 'Select Model')}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-4 w-4 text-[#7A7D8E]" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0" afterLeave={() => setModelSearch('')}>
              <Listbox.Options className="absolute z-50 bottom-full mb-2 max-h-72 w-full overflow-auto rounded-xl bg-[#E2E6EC] border border-black/[0.1] py-1 text-xs shadow-xl focus:outline-none scrollbar-hide">
                <div className="sticky top-0 z-20 px-2 py-2 bg-[#E2E6EC] border-b border-black/[0.05]">
                  <input
                    type="text"
                    className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-lg px-3 py-1.5 text-xs text-[#1A1D2E] placeholder:text-[#7A7D8E] focus:outline-none focus:ring-1 focus:ring-[#FF6600]/40"
                    placeholder="Search models..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                {loading ? (
                  <div className="py-4 px-4 text-center text-xs text-[#7A7D8E] animate-pulse">
                    Fetching available models...
                  </div>
                ) : filteredModels.length === 0 ? (
                  <div className="py-4 px-4 text-center text-xs text-[#7A7D8E]">
                    No models found matching "{modelSearch}"
                  </div>
                ) : (
                  filteredModels.map((m) => (
                    <Listbox.Option
                      key={m.id}
                      className={({ active }) => `relative cursor-pointer select-none py-2.5 pl-10 pr-4 transition-colors ${active ? 'bg-[#FF6600]/10 text-[#FF6600]' : 'text-[#4A4D5E]'}`}
                      value={m.id}
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? 'font-bold' : 'font-medium'}`}>
                            {m.name}
                            <span className="ml-2 text-[10px] opacity-40 block font-mono">{m.id}</span>
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#FF6600]">
                              <CheckIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))
                )}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>
    </div>
  );
};

export default ProviderSelector;
