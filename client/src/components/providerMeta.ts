/**
 * providerMeta.ts — Single source of truth for AI provider metadata.
 * Used by Chat.tsx header badge, SettingsModal radio group, and ProviderSelector.
 */


export type ProviderId = 'local' | 'groq' | 'openrouter' | 'gemini' | 'ollama_cloud' | 'colab_bridge' | 'cloudflare_ai_gateway' | 'workers_ai' | 'anthropic' | 'azure' | 'deepseek' | 'xai' | 'together' | 'fireworks' | 'nvidia' | 'perplexity' | 'cohere' | 'mistral' | 'huggingface' | 'cerebras' | 'litert';
export type LocalBackendMode = 'ollama' | 'llamacpp' | 'litert';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  description: string;
  color: string;
  icon: string | null;  // SVG import path, or null for inline SVG
  iconType: 'svg-file' | 'inline';
  brand?: string; // Brand name for @lobehub/icons
  class: 'standard' | 'expert' | 'pro';
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'local',
    label: 'Local LLM',
    description: 'Ollama or llama-server',
    color: '#A3E635',
    icon: '/media/brand-icons/ollama-color.svg',
    iconType: 'svg-file',
    brand: 'Ollama',
    class: 'standard',
  },
  {
    id: 'ollama_cloud',
    label: 'Ollama Cloud',
    description: 'Remote Ollama instance',
    color: '#34D399',
    icon: '/media/brand-icons/ollama-color.svg',
    iconType: 'svg-file',
    brand: 'Ollama',
    class: 'expert',
  },
  {
    id: 'colab_bridge',
    label: 'Colab Bridge',
    description: 'Reverse tunnel execution',
    color: '#F9AB00',
    icon: null,
    iconType: 'inline',
    brand: 'Colab',
    class: 'pro',
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Ultra-fast cloud inference',
    color: '#fd3b12',
    icon: '/media/brand-icons/groq.webp',
    iconType: 'svg-file',
    brand: 'Groq',
    class: 'pro',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Multi-model cloud gateway',
    color: '#06B6D4',
    icon: '/media/brand-icons/openrouter.webp',
    iconType: 'svg-file',
    brand: 'OpenRouter',
    class: 'expert',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'Google AI models',
    color: '#4285F4',
    icon: '/media/brand-icons/gemini-logo_svgstack_com_37141777229654.svg',
    iconType: 'svg-file',
    brand: 'Gemini',
    class: 'pro',
  },
  {
    id: 'cloudflare_ai_gateway',
    label: 'Cloudflare AI Gateway',
    description: 'Unified AI gateway with logging, caching & routing',
    color: '#F38020',
    icon: '/media/brand-icons/cloudflare-color.svg',
    iconType: 'svg-file',
    brand: 'Cloudflare',
    class: 'expert',
  },
  {
    id: 'workers_ai',
    label: 'Workers AI',
    description: 'Cloudflare edge AI inference',
    color: '#F38020',
    icon: '/media/brand-icons/cloudflare-color.svg',
    iconType: 'svg-file',
    brand: 'Cloudflare',
    class: 'pro',
  },
  {
    id: 'litert',
    label: 'LiteRT',
    description: 'On-device inference (WebGPU/WASM)',
    color: '#8B5CF6',
    icon: '/media/brand-icons/Litert_icon.svg',
    iconType: 'svg-file',
    class: 'standard',
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

/** Get the local backend mode from localStorage, defaulting to 'ollama' */
export function getLocalBackendMode(): LocalBackendMode {
  return (localStorage.getItem('local_backend_mode') as LocalBackendMode) || 'ollama';
}

/** Set the local backend mode in localStorage */
export function setLocalBackendMode(mode: LocalBackendMode): void {
  localStorage.setItem('local_backend_mode', mode);
}