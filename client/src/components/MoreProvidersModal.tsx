import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { type ProviderId, MORE_PROVIDERS, getVisibleProviderIds, setVisibleProviderIds } from "./providerMeta";
import { useAI } from "../contexts/AIContext";
import ProviderIcon from "./ProviderIcon";
import { config, getApiUrl } from "../config";
import {
  getProviderApiKeyStorageKey,
  getProviderBaseUrlStorageKey,
  getStoredProviderBaseUrl,
  getProviderInputPolicy,
} from "../config/providerConfig";

interface MoreProvidersModalProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
}

const MoreProvidersModal: React.FC<MoreProvidersModalProps> = ({ isOpen, setIsOpen }) => {
  const { provider, setProvider, model, setModel, activeSpace, isPremiumSpace } = useAI();
  const [activeProvider, setActiveProvider] = useState<ProviderId | string>(provider);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [providerUrls, setProviderUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    providerId: string;
  } | null>(null);
  const [availableModels, setAvailableModels] = useState<Record<string, { id: string; name: string }[]>>({});
  const [visibleProviders, setVisibleProvidersState] = useState<ProviderId[]>(() => getVisibleProviderIds());

  useEffect(() => {
    if (isOpen) {
      setActiveProvider(provider);
      setVisibleProvidersState(getVisibleProviderIds());
      // Load stored keys for all more providers
      MORE_PROVIDERS.forEach((p) => {
        const keyStorage = getProviderApiKeyStorageKey(p.id);
        const key = keyStorage ? localStorage.getItem(keyStorage) : null;
        if (key) setProviderKeys(prev => ({ ...prev, [p.id]: key }));
        const url = getStoredProviderBaseUrl(p.id);
        if (url) setProviderUrls(prev => ({ ...prev, [p.id]: url }));
      });
    }
  }, [isOpen, provider]);

  const testAndLoadModels = async (providerId: string) => {
    setLoading(true);
    setTestResult(null);
    const policy = getProviderInputPolicy(providerId);
    const keyStorage = getProviderApiKeyStorageKey(providerId);
    const apiKey = providerKeys[providerId] || (keyStorage ? localStorage.getItem(keyStorage) || "" : "");
    const baseUrl = providerUrls[providerId] || getStoredProviderBaseUrl(providerId);

    try {
      const headers: Record<string, string> = {};
      const token = localStorage.getItem("token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (policy.supportsApiKey && apiKey) headers["X-API-Key"] = apiKey;
      if (baseUrl) headers["X-Base-Url"] = baseUrl;
      if (activeSpace) {
        headers["X-Space-Slug"] = activeSpace.slug;
      }
      headers["X-Is-Premium"] = isPremiumSpace ? "true" : "false";

      const response = await fetch(`${getApiUrl(isPremiumSpace)}${config.API_V1_STR}/models?provider=${providerId}`, {
        headers,
      });

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message: models.length > 0 ? `Connected! Found ${models.length} models.` : "Connected, but no models found.",
          providerId,
        });
        setAvailableModels(prev => ({ ...prev, [providerId]: models }));
        if (models.length > 0 && (!model || !models.find((m: any) => m.id === model))) {
          setModel(models[0].id);
        }
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
          providerId,
        });
        setAvailableModels(prev => ({ ...prev, [providerId]: [] }));
      }
    } catch (e) {
      setTestResult({ success: false, message: "Network error. Check configuration.", providerId });
      setAvailableModels(prev => ({ ...prev, [providerId]: [] }));
    } finally {
      setLoading(false);
    }
  };

  const toggleProviderVisibility = (providerId: ProviderId) => {
    setVisibleProvidersState((prev) => {
      const next = prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : [...prev, providerId];
      setVisibleProviderIds(next);
      return next;
    });
    window.dispatchEvent(new Event("ai-settings-changed"));
  };

  const handleSave = () => {
    try {
      setProvider(activeProvider as ProviderId);
      setVisibleProviderIds(visibleProviders);

      // Save keys for all more providers (write even when empty so values can be cleared)
      MORE_PROVIDERS.forEach((p) => {
        const keyStorage = getProviderApiKeyStorageKey(p.id);
        const urlStorage = getProviderBaseUrlStorageKey(p.id);
        if (keyStorage) {
          localStorage.setItem(keyStorage, (providerKeys[p.id] || "").trim());
        }
        if (urlStorage) {
          localStorage.setItem(urlStorage, (providerUrls[p.id] || "").trim());
        }
      });

      window.dispatchEvent(new Event("ai-settings-changed"));
      setIsOpen(false);

      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Error saving settings. Please try again.");
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-[#E2E6EC] border border-black/[0.06] p-6 text-left align-middle shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-5">
                  <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-[#1A1D2E] flex items-center gap-2">
                    <span className="w-5 h-5 text-[#fd3b12]">⋮</span>
                    More Providers
                  </Dialog.Title>
                  <button onClick={() => setIsOpen(false)} className="text-[#7A7D8E] hover:text-[#1A1D2E] transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#4A4D5E] mb-6 leading-relaxed">
                  Configure additional BYOK providers. Enter your API key and base URL (if custom) to connect.
                </p>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  {MORE_PROVIDERS.map((provider) => {
                    const isActive = activeProvider === provider.id;
                    const policy = getProviderInputPolicy(provider.id);
                    const keyStorage = getProviderApiKeyStorageKey(provider.id);
                    const storedKey = providerKeys[provider.id] || (keyStorage ? localStorage.getItem(keyStorage) || "" : "");
                    const storedUrl = providerUrls[provider.id] || getStoredProviderBaseUrl(provider.id);
                    const models = availableModels[provider.id] || [];
                    const showTest = testResult?.providerId === provider.id;

                    return (
                      <div key={provider.id} className={`rounded-xl border-2 p-4 transition-all ${isActive
                          ? "bg-[#fd3b12]/10 border-[#fd3b12] shadow-md shadow-[#fd3b12]/10"
                          : "bg-[#D8DCE4] border-transparent hover:bg-[#D0D4DC] hover:border-black/[0.08]"
                        }`}>
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveProvider(provider.id);
                              setProvider(provider.id as ProviderId);
                            }}
                            className={`relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${isActive
                                ? "bg-[#fd3b12]/20 border border-[#fd3b12]/30"
                                : "bg-transparent hover:bg-[#D8DCE4]"
                              }`}
                          >
                            {isActive && (
                              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#fd3b12] shadow-[0_0_6px_rgba(255,102,0,0.7)]" />
                            )}
                            <ProviderIcon provider={provider} size={28} />
                            <span className={`text-[10px] font-semibold ${isActive ? "text-[#fd3b12]" : "text-[#4A4D5E]"}`}>
                              {provider.label}
                            </span>
                          </button>

                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4A4D5E]">
                              {visibleProviders.includes(provider.id as ProviderId) ? "Shown" : "Hidden"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleProviderVisibility(provider.id as ProviderId)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${visibleProviders.includes(provider.id as ProviderId) ? "bg-[#fd3b12]" : "bg-[#A8B0BE]"
                                }`}
                              aria-label={`Toggle ${provider.label} visibility in main provider selector`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${visibleProviders.includes(provider.id as ProviderId) ? "translate-x-6" : "translate-x-1"
                                  }`}
                              />
                            </button>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#7A7D8E] mb-3">{provider.description}</p>

                            <div className="space-y-2">
                              {policy.supportsApiKey && (
                                <div>
                                  <label className="block text-xs font-medium text-[#1A1D2E] mb-1">
                                    API Key {policy.requiresApiKey ? "" : "(Optional)"}
                                  </label>
                                  <input
                                    type="password"
                                    value={storedKey}
                                    onChange={(e) => setProviderKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                    placeholder={policy.requiresApiKey ? "Required for this provider" : "sk-... or Bearer token"}
                                    className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-3 py-2 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-xs placeholder:text-[#7A7D8E] transition-all"
                                  />
                                </div>
                              )}

                              <div>
                                <label className="block text-xs font-medium text-[#1A1D2E] mb-1">
                                  Base URL (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={storedUrl}
                                  onChange={(e) => setProviderUrls(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                  placeholder="https://api.provider.com/v1"
                                  className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-3 py-2 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-xs placeholder:text-[#7A7D8E] transition-all"
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => testAndLoadModels(provider.id)}
                                  disabled={loading || (policy.requiresApiKey && !storedKey)}
                                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${loading || (policy.requiresApiKey && !storedKey)
                                      ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                                      : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                                    }`}
                                >
                                  {loading && testResult?.providerId === provider.id ? (
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <ArrowPathIcon className="w-4 h-4" />
                                  )}
                                  Test & Load Models
                                </button>

                                {showTest && (
                                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                    }`}>
                                    {testResult.success ? (
                                      <CheckCircleIcon className="w-4 h-4" />
                                    ) : (
                                      <ExclamationCircleIcon className="w-4 h-4" />
                                    )}
                                    {testResult.message}
                                  </div>
                                )}

                                {models.length > 0 && (
                                  <div className="text-xs text-[#7A7D8E]">
                                    {models.length} models available — first: {models[0].name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-xl border border-black/[0.08] bg-transparent px-5 py-2.5 text-sm font-medium text-[#4A4D5E] hover:bg-black/[0.04] hover:text-[#1A1D2E] focus:outline-none transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-xl border border-transparent bg-[#fd3b12] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#E65C00] focus:outline-none transition-all shadow-lg shadow-[#fd3b12]/25"
                    onClick={handleSave}
                  >
                    Save & Apply
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default MoreProvidersModal;