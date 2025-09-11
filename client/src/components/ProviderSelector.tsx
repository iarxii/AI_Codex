import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';
import OpenAILogo from '../assets/ai_online_services/openai-svgrepo-com.svg';
import GeminiLogo from '../assets/ai_online_services/gemini-color.svg';

type ProviderSelectorProps = {
  provider: 'openai' | 'gemini';
  setProvider: (p: 'openai' | 'gemini') => void;
};

const providers = [
  { id: 'gemini', name: 'Gemini (1.5 Flash)', icon: <img src={GeminiLogo} alt="Gemini Logo" className="w-6 h-6" /> },
  { id: 'openai', name: 'OpenAI (gpt-4o)', icon: <img src={OpenAILogo} alt="OpenAI Logo" className="w-6 h-6" /> },
];

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ provider, setProvider }) => {
  const selectedProvider = providers.find((p) => p.id === provider);

  return (
    <div className="mb-4">
      <Listbox value={provider} onChange={setProvider}>
        <div className="relative mt-1">
          <Listbox.Label className="block text-sm font-medium text-white mb-1">
            AI Provider
          </Listbox.Label>
          <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
            <span className="flex items-center">
              {selectedProvider?.icon}
              <span className="ml-3 block truncate text-gray-400">{selectedProvider?.name}</span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-10 bottom-full mb-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
              {providers.map((p) => (
                <Listbox.Option
                  key={p.id}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                    }`
                  }
                  value={p.id}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`flex items-center truncate ${
                          selected ? 'font-medium' : 'font-normal'
                        }`}
                      >
                        {p.icon}
                        <span className="ml-3">{p.name}</span>
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
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
  );
};

export default ProviderSelector;
