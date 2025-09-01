import React from 'react';

type ProviderSelectorProps = {
  provider: 'openai' | 'gemini';
  setProvider: (p: 'openai' | 'gemini') => void;
};

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ provider, setProvider }) => (
  <div className="mb-4">
    <label htmlFor="provider-select" className="block text-sm font-medium text-gray-700 mb-1">
      AI Provider
    </label>
    <select
      id="provider-select"
      value={provider}
      onChange={(e) => setProvider(e.target.value as 'openai' | 'gemini')}
      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
    >
      <option value="openai">OpenAI (gpt-4o)</option>
      <option value="gemini">Gemini (2.5 Flash)</option>
    </select>
  </div>
);

export default ProviderSelector;
