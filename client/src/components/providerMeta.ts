/**
 * providerMeta.ts — Single source of truth for AI provider metadata.
 * Used by Chat.tsx header badge, SettingsModal radio group, and ProviderSelector.
 */


export type ProviderId = 'local' | 'groq' | 'openai' | 'openrouter' | 'gemini' | 'ollama_cloud' | 'colab_bridge' | 'cloudflare_ai_gateway' | 'workers_ai' | 'anthropic' | 'azure' | 'deepseek' | 'xai' | 'together' | 'fireworks' | 'nvidia' | 'perplexity' | 'cohere' | 'mistral' | 'huggingface' | 'cerebras' | 'litert';
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
    id: 'litert',
    label: 'LiteRT (Web Local)',
    description: 'On-device inference (WebGPU/WASM)',
    color: '#3B82F6',
    icon: '/media/brand-icons/Litert_icon.svg',
    iconType: 'svg-file',
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
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models direct',
    color: '#10A37F',
    icon: null,
    iconType: 'inline',
    brand: 'OpenAI',
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
    id: 'workers_ai',
    label: 'Cloudflare Workers AI',
    description: 'Cloudflare edge AI inference',
    color: '#F38020',
    icon: '/media/brand-icons/cloudflare-color.svg',
    iconType: 'svg-file',
    brand: 'Cloudflare',
    class: 'pro',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models direct',
    color: '#D4A574',
    icon: '/media/brand-icons/claude-logo_svgstack_com_36971777229669.svg',
    iconType: 'svg-file',
    brand: 'Anthropic',
    class: 'pro',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    description: 'Inference endpoints',
    color: '#FFD21F',
    icon: null,
    iconType: 'inline',
    brand: 'HuggingFace',
    class: 'expert',
  },
];

/** Additional BYOK providers configured via MoreProvidersModal. */
export const MORE_PROVIDERS: ProviderInfo[] = [
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
    id: 'azure',
    label: 'Azure OpenAI',
    description: 'Enterprise OpenAI on Azure',
    color: '#0078D4',
    icon: '/media/brand-icons/microsoft.svg',
    iconType: 'svg-file',
    brand: 'Microsoft',
    class: 'expert',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'Open-source reasoning models',
    color: '#1A1A2E',
    icon: '/media/brand-icons/deepseek-logo_svgstack_com_37061777229678.svg',
    iconType: 'svg-file',
    brand: 'DeepSeek',
    class: 'pro',
  },
  {
    id: 'xai',
    label: 'xAI',
    description: 'Grok models',
    color: '#000000',
    icon: '/media/brand-icons/white-grok-logo_svgstack_com_37181777229567.svg',
    iconType: 'svg-file',
    brand: 'XAI',
    class: 'pro',
  },
  {
    id: 'together',
    label: 'Together AI',
    description: 'Open-source model hosting',
    color: '#F58A07',
    icon: null,
    iconType: 'inline',
    brand: 'Together',
    class: 'expert',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    description: 'Fast open-source inference',
    color: '#FF6B35',
    icon: null,
    iconType: 'inline',
    brand: 'Fireworks',
    class: 'expert',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    description: 'Optimized enterprise models',
    color: '#76B900',
    icon: null,
    iconType: 'inline',
    brand: 'Nvidia',
    class: 'expert',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    description: 'Search-augmented models',
    color: '#20808D',
    icon: null,
    iconType: 'inline',
    brand: 'Perplexity',
    class: 'pro',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    description: 'Enterprise LLMs',
    color: '#0047FF',
    icon: null,
    iconType: 'inline',
    brand: 'Cohere',
    class: 'expert',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    description: 'Open-weight models',
    color: '#FF6B35',
    icon: null,
    iconType: 'inline',
    brand: 'Mistral',
    class: 'pro',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    description: 'Ultra-fast inference',
    color: '#00D4AA',
    icon: null,
    iconType: 'inline',
    brand: 'Cerebras',
    class: 'pro',
  },
];

export const PROVIDER_MAP: Record<string, ProviderInfo> = Object.fromEntries(
  [...PROVIDERS, ...MORE_PROVIDERS].map(p => [p.id, p])
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