/**
 * providerConfig.ts — Single source of truth for per-provider API keys and
 * connection params. Used by both the Workspace UI (ProviderSelector /
 * Workspace) and the Lite Chat portal (useLiteRtChat) so provider+model
 * selection stays consistent across surfaces.
 *
 * Keys and connection params live in localStorage (set by SettingsModal /
 * MoreProvidersModal) and are forwarded to the backend per request.
 */

export interface ProviderConnectionParams {
  base_url?: string;
  account_id?: string;
  gateway_id?: string;
}

export type ProviderInputPolicy = {
  supportsApiKey: boolean;
  requiresApiKey: boolean;
};

export const DEFAULT_PROVIDER_BASE_URLS: Record<string, string> = {
  local: "http://localhost:11434",
  ollama_cloud: "https://ollama.com",
  colab_bridge: "",
  cloudflare_ai_gateway: "https://gateway.ai.cloudflare.com",
  workers_ai: "https://api.cloudflare.com/client/v4/accounts",
  groq: "https://api.groq.com/openai/v1",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  anthropic: "https://api.anthropic.com",
  azure: "https://{resource-name}.openai.azure.com/openai/deployments",
  deepseek: "https://api.deepseek.com/v1",
  xai: "https://api.x.ai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  perplexity: "https://api.perplexity.ai",
  cohere: "https://api.cohere.com/v1",
  mistral: "https://api.mistral.ai/v1",
  huggingface: "https://router.huggingface.co/v1",
  cerebras: "https://api.cerebras.ai/v1",
};

const PROVIDER_API_KEY_STORAGE_KEYS: Record<string, string | null> = {
  local: null,
  litert: null,
  groq: "groq_api_key",
  openai: "openai_api_key",
  openrouter: "openrouter_api_key",
  gemini: "gemini_api_key",
  ollama_cloud: "ollama_cloud_key",
  colab_bridge: "colab_bridge_key",
  cloudflare_ai_gateway: "cloudflare_ai_gateway_key",
  workers_ai: "workers_ai_key",
  anthropic: "anthropic_api_key",
  azure: "azure_api_key",
  deepseek: "deepseek_api_key",
  xai: "xai_api_key",
  together: "together_api_key",
  fireworks: "fireworks_api_key",
  nvidia: "nvidia_api_key",
  perplexity: "perplexity_api_key",
  cohere: "cohere_api_key",
  mistral: "mistral_api_key",
  huggingface: "huggingface_api_key",
  cerebras: "cerebras_api_key",
};

const PROVIDER_BASE_URL_STORAGE_KEYS: Record<string, string | null> = {
  local: "local_base_url",
  litert: null,
  groq: "groq_base_url",
  openai: "openai_base_url",
  openrouter: "openrouter_base_url",
  gemini: "gemini_base_url",
  ollama_cloud: "ollama_cloud_url",
  colab_bridge: "colab_bridge_url",
  cloudflare_ai_gateway: "cloudflare_ai_gateway_url",
  workers_ai: "workers_ai_base_url",
  anthropic: "anthropic_base_url",
  azure: "azure_base_url",
  deepseek: "deepseek_base_url",
  xai: "xai_base_url",
  together: "together_base_url",
  fireworks: "fireworks_base_url",
  nvidia: "nvidia_base_url",
  perplexity: "perplexity_base_url",
  cohere: "cohere_base_url",
  mistral: "mistral_base_url",
  huggingface: "huggingface_base_url",
  cerebras: "cerebras_base_url",
};

const PROVIDER_INPUT_POLICIES: Record<string, ProviderInputPolicy> = {
  local: { supportsApiKey: false, requiresApiKey: false },
  litert: { supportsApiKey: false, requiresApiKey: false },
  ollama_cloud: { supportsApiKey: true, requiresApiKey: false },
  colab_bridge: { supportsApiKey: true, requiresApiKey: false },
  cloudflare_ai_gateway: { supportsApiKey: true, requiresApiKey: false },
  workers_ai: { supportsApiKey: true, requiresApiKey: false },
  groq: { supportsApiKey: true, requiresApiKey: true },
  openai: { supportsApiKey: true, requiresApiKey: true },
  openrouter: { supportsApiKey: true, requiresApiKey: true },
  gemini: { supportsApiKey: true, requiresApiKey: true },
  anthropic: { supportsApiKey: true, requiresApiKey: true },
  azure: { supportsApiKey: true, requiresApiKey: true },
  deepseek: { supportsApiKey: true, requiresApiKey: true },
  xai: { supportsApiKey: true, requiresApiKey: true },
  together: { supportsApiKey: true, requiresApiKey: true },
  fireworks: { supportsApiKey: true, requiresApiKey: true },
  nvidia: { supportsApiKey: true, requiresApiKey: true },
  perplexity: { supportsApiKey: true, requiresApiKey: true },
  cohere: { supportsApiKey: true, requiresApiKey: true },
  mistral: { supportsApiKey: true, requiresApiKey: true },
  huggingface: { supportsApiKey: true, requiresApiKey: true },
  cerebras: { supportsApiKey: true, requiresApiKey: true },
};

export function getProviderApiKeyStorageKey(prov: string): string | null {
  return PROVIDER_API_KEY_STORAGE_KEYS[prov] ?? `${prov}_api_key`;
}

export function getProviderBaseUrlStorageKey(prov: string): string | null {
  return PROVIDER_BASE_URL_STORAGE_KEYS[prov] ?? `${prov}_base_url`;
}

export function getDefaultProviderBaseUrl(prov: string): string {
  return DEFAULT_PROVIDER_BASE_URLS[prov] ?? "";
}

export function getStoredProviderBaseUrl(prov: string): string {
  const key = getProviderBaseUrlStorageKey(prov);
  if (!key) return "";
  return localStorage.getItem(key) || getDefaultProviderBaseUrl(prov) || "";
}

export function getProviderInputPolicy(prov: string): ProviderInputPolicy {
  return (
    PROVIDER_INPUT_POLICIES[prov] || {
      supportsApiKey: true,
      requiresApiKey: true,
    }
  );
}

/** API keys stored per-provider in localStorage (same convention across the app). */
export function getProviderApiKey(prov: string): string | null {
  const key = getProviderApiKeyStorageKey(prov);
  return key ? localStorage.getItem(key) : null;
}

/**
 * Connection params resolved from localStorage so providers that require a
 * custom base URL / account / gateway (Ollama Cloud, Cloudflare AI Gateway,
 * Workers AI, Colab bridge, and More Providers) route correctly through the
 * backend. Mirrors Workspace.tsx's getProviderConnectionParams.
 */
export function getProviderConnectionParams(prov: string): ProviderConnectionParams {
  const baseUrl = getStoredProviderBaseUrl(prov);

  const accountId =
    prov === 'cloudflare_ai_gateway'
      ? localStorage.getItem('cloudflare_ai_gateway_account_id') || ''
      : prov === 'workers_ai'
        ? localStorage.getItem('workers_ai_account_id') || ''
        : '';
  const gatewayId =
    prov === 'cloudflare_ai_gateway'
      ? localStorage.getItem('cloudflare_ai_gateway_gateway_id') || ''
      : '';

  return {
    base_url: baseUrl || undefined,
    account_id: accountId || undefined,
    gateway_id: gatewayId || undefined,
  };
}

/** All cloud providers the portal/workspace may offer (minus client-side ones). */
export const ALL_CLOUD_PROVIDERS: string[] = [
  'ollama_cloud',
  'groq',
  'openai',
  'openrouter',
  'gemini',
  'anthropic',
  'azure',
  'cloudflare_ai_gateway',
  'workers_ai',
  'colab_bridge',
  'deepseek',
  'xai',
  'together',
  'fireworks',
  'nvidia',
  'perplexity',
  'cohere',
  'mistral',
  'huggingface',
  'cerebras',
];
