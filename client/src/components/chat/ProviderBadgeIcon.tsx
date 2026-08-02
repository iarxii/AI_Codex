import React from 'react';
import ProviderIcon from '../ProviderIcon';
import type { ProviderInfo } from '../providerMeta';

interface ProviderBadgeIconProps {
  provider: ProviderInfo;
  size?: number;
}

const MONOCHROME_PROVIDER_IDS = new Set(['local', 'ollama_cloud', 'openai', 'openrouter', 'anthropic', 'xai']);

const ProviderBadgeIcon: React.FC<ProviderBadgeIconProps> = ({ provider, size = 16 }) => {
  const identity = `${provider.id} ${provider.label} ${provider.brand || ''} ${provider.icon || ''}`.toLowerCase();
  const useGraySurface = MONOCHROME_PROVIDER_IDS.has(provider.id) || identity.includes('white') || identity.includes('light');
  const iconToneClass = useGraySurface
    ? 'text-[#111827] brightness-0 saturate-100'
    : 'text-[#111827]';

  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full shadow-sm shrink-0 ${useGraySurface ? 'bg-gray-100' : 'bg-white'}`}
      aria-hidden="true"
    >
      <ProviderIcon provider={provider} size={size} className={iconToneClass} />
    </span>
  );
};

export default ProviderBadgeIcon;