import React from 'react';

type ProviderSelectorProps = {
  provider: 'openai' | 'gemini';
  setProvider: (p: 'openai' | 'gemini') => void;
};

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ provider, setProvider }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ marginRight: 8 }}>Provider:</label>
    <select value={provider} onChange={e => setProvider(e.target.value as 'openai' | 'gemini')}>
      <option value="openai">OpenAI (gpt-4o)</option>
      <option value="gemini">Gemini (2.5 Flash)</option>
    </select>
  </div>
);

export default ProviderSelector;
