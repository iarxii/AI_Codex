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

/** API keys stored per-provider in localStorage (same convention across the app). */
export function getProviderApiKey(prov: string): string | null {
  switch (prov) {
    case 'groq': return localStorage.getItem('groq_api_key');
    case 'openrouter': return localStorage.getItem('openrouter_api_key');
    case 'gemini': return localStorage.getItem('gemini_api_key');
    case 'ollama_cloud': return localStorage.getItem('ollama_cloud_key');
    case 'cloudflare_ai_gateway': return localStorage.getItem('cloudflare_ai_gateway_key');
    case 'workers_ai': return localStorage.getItem('workers_ai_key');
    case 'anthropic': return localStorage.getItem('anthropic_api_key');
    case 'azure': return localStorage.getItem('azure_api_key');
    case 'deepseek': return localStorage.getItem('deepseek_api_key');
    case 'xai': return localStorage.getItem('xai_api_key');
    case 'together': return localStorage.getItem('together_api_key');
    case 'fireworks': return localStorage.getItem('fireworks_api_key');
    case 'nvidia': return localStorage.getItem('nvidia_api_key');
    case 'perplexity': return localStorage.getItem('perplexity_api_key');
    case 'cohere': return localStorage.getItem('cohere_api_key');
    case 'mistral': return localStorage.getItem('mistral_api_key');
    case 'huggingface': return localStorage.getItem('huggingface_api_key');
    case 'cerebras': return localStorage.getItem('cerebras_api_key');
    default: return null;
  }
}

/**
 * Connection params resolved from localStorage so providers that require a
 * custom base URL / account / gateway (Ollama Cloud, Cloudflare AI Gateway,
 * Workers AI, Colab bridge, and More Providers) route correctly through the
 * backend. Mirrors Workspace.tsx's getProviderConnectionParams.
 */
export function getProviderConnectionParams(prov: string): ProviderConnectionParams {
  let baseUrl = '';
  if (prov === 'ollama_cloud') baseUrl = localStorage.getItem('ollama_cloud_url') || '';
  else if (prov === 'colab_bridge') baseUrl = localStorage.getItem('colab_bridge_url') || '';
  else if (prov === 'cloudflare_ai_gateway') baseUrl = localStorage.getItem('cloudflare_ai_gateway_url') || '';
  else if (prov === 'anthropic' || prov === 'azure' || prov === 'deepseek' || prov === 'xai'
    || prov === 'together' || prov === 'fireworks' || prov === 'nvidia' || prov === 'perplexity'
    || prov === 'cohere' || prov === 'mistral' || prov === 'huggingface' || prov === 'cerebras') {
    baseUrl = localStorage.getItem(`${prov}_base_url`) || '';
  }

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
