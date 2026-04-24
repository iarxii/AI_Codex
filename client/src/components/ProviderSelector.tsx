import React, { Fragment, useEffect, useState } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import OpenAILogo from '../assets/ai_online_services/openai-svgrepo-com.svg';
import GeminiLogo from '../assets/ai_online_services/gemini-color.svg';

const providers = [
  { id: 'local', name: 'Local (Ollama GPU)', icon: <span className="w-6 h-6 flex items-center justify-center text-xl">🦙</span> },
  { id: 'groq', name: 'Groq (Cloud)', icon: <span className="w-6 h-6 flex items-center justify-center text-xl text-orange-500">⚡</span> },
  { id: 'openrouter', name: 'OpenRouter (Cloud)', icon: <span className="w-6 h-6 flex items-center justify-center text-xl">🌐</span> },
  { id: 'gemini', name: 'Gemini (Cloud)', icon: <img src={GeminiLogo} alt="Gemini Logo" className="w-6 h-6" /> },
];

const modelsByProvider: Record<string, { id: string, name: string }[]> = {
  local: [
    { id: 'llama3.2:3b', name: 'Llama 3.2 3B' },
    { id: 'mistral:latest', name: 'Mistral 7B' },
  ],
  groq: [
    { id: 'llama3-8b-8192', name: 'Llama 3 8B (Groq)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)' },
    { id: 'gemma-7b-it', name: 'Gemma 7B (Groq)' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.2-3b-instruct', name: 'Llama 3.2 3B (Free)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  ]
};

const ProviderSelector: React.FC = () => {
  const [provider, setProvider] = useState(localStorage.getItem('ai_provider') || 'local');
  const [model, setModel] = useState(localStorage.getItem('ai_model') || modelsByProvider['local'][0].id);

  useEffect(() => {
    localStorage.setItem('ai_provider', provider);
    // Reset model if switching providers
    const validModels = modelsByProvider[provider];
    if (!validModels.find(m => m.id === model)) {
      const defaultModel = validModels[0].id;
      setModel(defaultModel);
      localStorage.setItem('ai_model', defaultModel);
    }
  }, [provider]);

  useEffect(() => {
    localStorage.setItem('ai_model', model);
  }, [model]);

  const selectedProvider = providers.find((p) => p.id === provider);
  const availableModels = modelsByProvider[provider] || [];
  const selectedModel = availableModels.find(m => m.id === model) || availableModels[0];

  return (
    <div className="mb-4 flex gap-4">
      <div className="flex-1">
        <Listbox value={provider} onChange={setProvider}>
          <div className="relative mt-1">
            <Listbox.Label className="block text-sm font-medium text-white mb-1">
              AI Provider
            </Listbox.Label>
            <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white/10 backdrop-blur-md border border-white/20 py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 sm:text-sm">
              <span className="flex items-center">
                {selectedProvider?.icon}
                <span className="ml-3 block truncate text-gray-200">{selectedProvider?.name}</span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm border border-white/10">
                {providers.map((p) => (
                  <Listbox.Option
                    key={p.id}
                    className={({ active }) => `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-indigo-600 text-white' : 'text-gray-300'}`}
                    value={p.id}
                  >
                    {({ selected }) => (
                      <>
                        <span className={`flex items-center truncate ${selected ? 'font-medium text-white' : 'font-normal'}`}>
                          {p.icon}
                          <span className="ml-3">{p.name}</span>
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-400">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
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
            <Listbox.Label className="block text-sm font-medium text-white mb-1">
              Model
            </Listbox.Label>
            <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white/10 backdrop-blur-md border border-white/20 py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 sm:text-sm">
              <span className="block truncate text-gray-200">{selectedModel?.name}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-slate-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm border border-white/10">
                {availableModels.map((m) => (
                  <Listbox.Option
                    key={m.id}
                    className={({ active }) => `relative cursor-default select-none py-2 pl-10 pr-4 ${active ? 'bg-indigo-600 text-white' : 'text-gray-300'}`}
                    value={m.id}
                  >
                    {({ selected }) => (
                      <>
                        <span className={`block truncate ${selected ? 'font-medium text-white' : 'font-normal'}`}>
                          {m.name}
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-400">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
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
    </div>
  );
};

export default ProviderSelector;
