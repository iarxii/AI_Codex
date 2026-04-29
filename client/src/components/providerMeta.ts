/**
 * providerMeta.ts — Single source of truth for AI provider metadata.
 * Used by Chat.tsx header badge, SettingsModal radio group, and ProviderSelector.
 */


export type ProviderId = 'local' | 'groq' | 'openrouter' | 'gemini' | 'ollama_cloud';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  description: string;
  color: string;
  icon: string | null;  // SVG import path, or null for inline SVG
  iconType: 'svg-file' | 'inline';
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'local',
    label: 'Ollama',
    description: 'Local GPU inference',
    color: '#A3E635',
    icon: '/media/brand-icons/ollama-color.svg',
    iconType: 'svg-file',
  },
  {
    id: 'ollama_cloud',
    label: 'Ollama Cloud',
    description: 'Remote Ollama instance',
    color: '#34D399',
    icon: '/media/brand-icons/ollama-color.svg',
    iconType: 'svg-file',
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Ultra-fast cloud inference',
    color: '#FF6600',
    icon: '/media/brand-icons/white-grok-logo_svgstack_com_37181777229567.svg',
    iconType: 'svg-file',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Multi-model cloud gateway',
    color: '#06B6D4',
    icon: '/media/brand-icons/openrouter.webp',
    iconType: 'svg-file',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'Google AI models',
    color: '#4285F4',
    icon: '/media/brand-icons/gemini-logo_svgstack_com_37141777229654.svg',
    iconType: 'svg-file',
  },
];

export const PROVIDER_MAP: Record<string, ProviderInfo> = Object.fromEntries(
  PROVIDERS.map(p => [p.id, p])
);

/** Get the current provider from localStorage, defaulting to 'local' */
export function getActiveProvider(): ProviderId {
  return (localStorage.getItem('ai_provider') as ProviderId) || 'local';
}

/** Get display info for the current provider */
export function getActiveProviderInfo(): ProviderInfo {
  const id = getActiveProvider();
  return PROVIDER_MAP[id] || PROVIDERS[0];
}
