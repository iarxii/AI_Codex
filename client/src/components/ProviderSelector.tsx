import React, { Fragment, useEffect, useState } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { useAI } from "../contexts/AIContext";
import { config, getApiUrl } from "../config";
import { PROVIDERS, PROVIDER_MAP, getLocalBackendMode, setLocalBackendMode } from "./providerMeta";
import type { LocalBackendMode } from "./providerMeta";
import ProviderIcon from "./ProviderIcon";

interface ProviderSelectorProps {
  showTelemetry: boolean;
  setShowTelemetry: (val: boolean) => void;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  showTelemetry,
  setShowTelemetry,
}) => {
  const { provider, setProvider, model, setModel, activeSpace, isPremiumSpace, userProfile } = useAI();
  const [availableModels, setAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [backendMode, setBackendMode] = useState<LocalBackendMode>(getLocalBackendMode());

  useEffect(() => {
    fetchModels();
  }, [provider, backendMode]);

  // Fallback to Groq if user is in Standard Workspace and tries to use local models
  useEffect(() => {
    if (!activeSpace && (provider === "local" || provider === "ollama_cloud")) {
      setProvider("groq");
    }
  }, [activeSpace, provider, setProvider]);

  const fetchModels = async () => {
    setLoading(true);
    let apiKey = "";
    if (provider === "groq")
      apiKey = localStorage.getItem("groq_api_key") || "";
    else if (provider === "openrouter")
      apiKey = localStorage.getItem("openrouter_api_key") || "";
    else if (provider === "gemini")
      apiKey = localStorage.getItem("gemini_api_key") || "";

    try {
      const url = `${getApiUrl(isPremiumSpace)}${config.API_V1_STR}/models?provider=${provider}`;
      const headers: Record<string, string> = {};
      if (apiKey) headers["X-API-Key"] = apiKey;
      
      // Inject space awareness headers for backend enforcement
      if (activeSpace) {
        headers["X-Space-Slug"] = activeSpace.slug;
      }
      headers["X-Is-Premium"] = isPremiumSpace ? "true" : "false";

      if (provider === "ollama_cloud") {
        const cloudUrl = localStorage.getItem("ollama_cloud_url");
        if (cloudUrl) headers["X-Base-Url"] = cloudUrl;
      }

      // Pass local backend mode so the API queries the correct server
      if (provider === "local") {
        headers["X-Local-Backend-Mode"] = backendMode;
      }

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data);

        if (
          data.length > 0 &&
          (!model || !data.find((m: any) => m.id === model))
        ) {
          const persisted = localStorage.getItem(`ai_model_${provider}`);
          if (persisted && data.find((m: any) => m.id === persisted)) {
            setModel(persisted);
          } else {
            setModel(data[0].id);
          }
        }
      } else {
        setAvailableModels([]);
      }
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setAvailableModels([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedProvider = PROVIDER_MAP[provider];

  const filteredModels = availableModels.filter(
    (m) =>
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const selectedModel =
    availableModels.find((m) => m.id === model) || availableModels[0];

  const isAdmin = ['admin', 'super_admin'].includes(userProfile?.role || '');
  const isLocalLocked = provider === 'local' && !isAdmin;

  // If local is locked, only allow the default model (e.g. llama3.2:3b)
  const finalModels = isLocalLocked 
    ? filteredModels.filter(m => m.id.includes('llama3.2') || m.id.includes('llama3.5')) 
    : filteredModels;

  const handleBackendModeChange = (mode: LocalBackendMode) => {
    setBackendMode(mode);
    setLocalBackendMode(mode);
  };

  return (
    <div className="mb-2 flex flex-col gap-2">
      {/* Backend mode toggle — only visible when local provider is selected */}
      {provider === "local" && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#4A4D5E]">
            Backend
          </span>
          <div className="flex rounded-lg bg-[#D8DCE4] border border-black/[0.06] p-0.5">
            <button
              type="button"
              onClick={() => handleBackendModeChange("ollama")}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all ${
                backendMode === "ollama"
                  ? "bg-[#A3E635]/20 text-[#65A30D] shadow-sm border border-[#A3E635]/30"
                  : "text-[#7A7D8E] hover:text-[#4A4D5E]"
              }`}
            >
              Ollama
            </button>
            <button
              type="button"
              onClick={() => handleBackendModeChange("llamacpp")}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all ${
                backendMode === "llamacpp"
                  ? "bg-[#fb923c]/20 text-[#ea580c] shadow-sm border border-[#fb923c]/30"
                  : "text-[#7A7D8E] hover:text-[#4A4D5E]"
              }`}
            >
              llama.cpp
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
      <div className="flex-none flex flex-col justify-end">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-[#4A4D5E] mb-1.5 ml-1">
          Neuro
        </span>
        <button
          type="button"
          onClick={() => setShowTelemetry(!showTelemetry)}
          className={`h-[42px] px-3 rounded-xl border transition-all active:scale-95 flex items-center justify-center ${
            showTelemetry
              ? "bg-[#fd3b12]/10 border-[#fd3b12]/30 text-[#fd3b12] shadow-sm shadow-[#fd3b12]/10"
              : "bg-[#E2E6EC] border-black/[0.08] text-[#7A7D8E] hover:bg-[#D8DCE4] hover:text-[#4A4D5E]"
          }`}
          title={
            showTelemetry
              ? "Hide Hardware Telemetry"
              : "Show Hardware Telemetry"
          }
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1">
        {/* AI Provider selector */}
        <Listbox value={provider} onChange={setProvider}>
          <div className="relative mt-1">
            <Listbox.Label className="block text-[10px] font-bold uppercase tracking-widest text-[#4A4D5E] mb-1.5 ml-1">
              AI Provider
            </Listbox.Label>
            <Listbox.Button className="relative w-full cursor-default rounded-xl bg-[#E2E6EC] border border-black/[0.08] py-2.5 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/20 sm:text-xs transition-all hover:bg-[#D8DCE4]">
              <span className="flex items-center">
                {selectedProvider && (
                  <ProviderIcon
                    provider={selectedProvider}
                    size={24}
                    className="mr-3"
                  />
                )}
                <span className="block truncate font-semibold text-[#1A1D2E]">
                  {selectedProvider?.label}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-4 w-4 text-[#7A7D8E]"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-50 bottom-full mb-2 max-h-60 w-full overflow-auto rounded-xl bg-[#E2E6EC] border border-black/[0.1] py-1 text-xs shadow-xl focus:outline-none scrollbar-hide">
                {PROVIDERS
                  .filter((p) => {
                    // Restrict local LLM options if no active Codex Space (Standard Workspace)
                    if (!activeSpace && (p.id === 'local' || p.id === 'ollama_cloud')) {
                      return false;
                    }
                    return true;
                  })
                  .map((p) => (
                  <Listbox.Option
                    key={p.id}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-2.5 pl-10 pr-4 transition-colors ${active ? "bg-[#fd3b12]/10 text-[#fd3b12]" : "text-[#4A4D5E]"}`
                    }
                    value={p.id}
                  >
                    {({ selected }) => (
                      <>
                        <span
                          className={`flex items-center truncate ${selected ? "font-bold" : "font-medium"}`}
                        >
                          <ProviderIcon
                            provider={p}
                            size={24}
                            className="mr-3"
                          />
                          <span>{p.label}</span>
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#fd3b12]">
                            <CheckIcon className="h-4 w-4" aria-hidden="true" />
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

      <div className="flex-1">
        {/* model selection list */}
        <Listbox value={model} onChange={setModel}>
          <div className="relative mt-1">
            <Listbox.Label className="block text-[10px] font-bold uppercase tracking-widest text-[#4A4D5E] mb-1.5 ml-1">
              Model Configuration
            </Listbox.Label>
            <Listbox.Button className="relative w-full cursor-default rounded-xl bg-[#E2E6EC] border border-black/[0.08] py-2.5 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/20 sm:text-xs transition-all hover:bg-[#D8DCE4]">
              <span className="block truncate font-semibold text-[#1A1D2E]">
                {loading
                  ? "Loading models..."
                  : selectedModel?.name || "Select Model"}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-4 w-4 text-[#7A7D8E]"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              afterLeave={() => setModelSearch("")}
            >
              <Listbox.Options className="absolute z-50 bottom-full mb-2 max-h-72 w-full overflow-auto rounded-xl bg-[#E2E6EC] border border-black/[0.1] py-1 text-xs shadow-xl focus:outline-none scrollbar-hide">
                <div className="sticky top-0 z-20 px-2 py-2 bg-[#E2E6EC] border-b border-black/[0.05]">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      className="flex-1 bg-[#D8DCE4] border border-black/[0.08] rounded-lg px-3 py-1.5 text-xs text-[#1A1D2E] placeholder:text-[#7A7D8E] focus:outline-none focus:ring-1 focus:ring-[#fd3b12]/40"
                      placeholder="Search models..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {provider === "openrouter" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const isFree = modelSearch.toLowerCase() === "free";
                          setModelSearch(isFree ? "" : "free");
                        }}
                        className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all active:scale-95 whitespace-nowrap ${
                          modelSearch.toLowerCase() === "free"
                            ? "bg-[#fd3b12] border-[#fd3b12] text-white shadow-sm"
                            : "bg-[#D8DCE4] border-black/[0.08] text-[#7A7D8E] hover:text-[#4A4D5E]"
                        }`}
                      >
                        Free Only
                      </button>
                    )}
                  </div>
                </div>
                {loading ? (
                  <div className="py-4 px-4 text-center text-xs text-[#7A7D8E] animate-pulse">
                    Fetching available models...
                  </div>
                ) : finalModels.length === 0 ? (
                  <div className="py-4 px-4 text-center text-xs text-[#7A7D8E]">
                    {isLocalLocked ? "Model switching is locked for Standard Accounts." : `No models found matching "${modelSearch}"`}
                  </div>
                ) : (
                  finalModels.map((m) => (
                    <Listbox.Option
                      key={m.id}
                      disabled={isLocalLocked && finalModels.length === 1 && m.id !== finalModels[0].id}
                      className={({ active, disabled }) =>
                        `relative cursor-pointer select-none py-2.5 pl-10 pr-4 transition-colors ${active && !disabled ? "bg-[#fd3b12]/10 text-[#fd3b12]" : disabled ? "opacity-50 cursor-not-allowed text-[#7A7D8E]" : "text-[#4A4D5E]"}`
                      }
                      value={m.id}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${selected ? "font-bold" : "font-medium"}`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{m.name}</span>
                              {(provider === "groq" ||
                                provider === "ollama_cloud" ||
                                provider === "local") && (
                                <span
                                  className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter ${
                                    provider === "groq"
                                      ? m.id.includes("compound") ||
                                        m.id.includes("instant")
                                        ? "bg-green-100 text-green-600 border border-green-200"
                                        : "bg-blue-100 text-blue-600 border border-blue-200"
                                      : "bg-green-100 text-green-600 border border-green-200"
                                  }`}
                                >
                                  {provider === "groq"
                                    ? m.id.includes("compound") ||
                                      m.id.includes("instant")
                                      ? "Free"
                                      : "Charged"
                                    : "Free"}
                                </span>
                              )}
                            </div>
                            <span className="ml-2 text-[10px] opacity-40 block font-mono">
                              {m.id}
                            </span>
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#fd3b12]">
                              <CheckIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </span>
                          ) : null}
                          {isLocalLocked && (
                            <span className="block mt-1 text-[9px] text-[#7A7D8E] font-medium leading-tight opacity-75">
                               Standard Access Locked
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))
                )}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>
      </div>
    </div>
  );
};

export default ProviderSelector;
