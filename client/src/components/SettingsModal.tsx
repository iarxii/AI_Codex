import React, { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Cog6ToothIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { PROVIDERS } from "./providerMeta";
import { useAI, type VisualSettings, type ProviderId } from "../contexts/AIContext";
import ProviderIcon from "./ProviderIcon";
import MoreProvidersModal from "./MoreProvidersModal";
import { config } from "../config";
import { getStoredProviderBaseUrl } from "../config/providerConfig";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ServerIcon,
} from "@heroicons/react/24/solid";

type SettingsModalProps = {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const { provider, setProvider, visualSettings, updateVisualSetting, activeSpace, isPremiumSpace } =
    useAI();
  const [activeProvider, setActiveProvider] = useState<ProviderId>(provider);
  const [moreProvidersOpen, setMoreProvidersOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("providers");
  const [openAiKey, setOpenAiKey] = useState("");
  const [openAiBaseUrl, setOpenAiBaseUrl] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiAuthMethod, setGeminiAuthMethod] = useState<
    "api_key" | "vertex"
  >("api_key");
  const [geminiProjectId, setGeminiProjectId] = useState("");
  const [geminiRegion, setGeminiRegion] = useState("");
  const [ollamaCloudKey, setOllamaCloudKey] = useState("");
  const [ollamaCloudUrl, setOllamaCloudUrl] = useState("");
  const [colabBridgeKey, setColabBridgeKey] = useState("");
  const [colabBridgeUrl, setColabBridgeUrl] = useState("");
  const [cfGatewayKey, setCfGatewayKey] = useState("");
  const [cfGatewayUrl, setCfGatewayUrl] = useState("");
  const [cfGatewayAccountId, setCfGatewayAccountId] = useState("");
  const [cfGatewayGatewayId, setCfGatewayGatewayId] = useState("");
  const [workersAiKey, setWorkersAiKey] = useState("");
  const [workersAiAccountId, setWorkersAiAccountId] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicBaseUrl, setAnthropicBaseUrl] = useState("");
  const [huggingfaceKey, setHuggingfaceKey] = useState("");
  const [huggingfaceBaseUrl, setHuggingfaceBaseUrl] = useState("");
  const [enableLangsmith, setEnableLangsmith] = useState(false);
  const [langsmithApiKey, setLangsmithApiKey] = useState("");
  const [langsmithProject, setLangsmithProject] = useState("");
  const [privateWorkspace, setPrivateWorkspace] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveProvider(provider);
      setOpenAiKey(localStorage.getItem("openai_api_key") || "");
      setOpenAiBaseUrl(getStoredProviderBaseUrl("openai"));
      setOpenRouterKey(localStorage.getItem("openrouter_api_key") || "");
      const storedGeminiKey = localStorage.getItem("gemini_api_key") || "";
      if (storedGeminiKey.startsWith("vertex_adc:")) {
        setGeminiAuthMethod("vertex");
        const parts = storedGeminiKey.split(":");
        setGeminiProjectId(parts[1] || "");
        setGeminiRegion(parts[2] || "");
        setGeminiKey("");
      } else {
        setGeminiAuthMethod("api_key");
        setGeminiKey(storedGeminiKey);
        setGeminiProjectId("");
        setGeminiRegion("");
      }
      setOllamaCloudKey(localStorage.getItem("ollama_cloud_key") || "");
      setOllamaCloudUrl(getStoredProviderBaseUrl("ollama_cloud"));
      setColabBridgeKey(localStorage.getItem("colab_bridge_key") || "");
      setColabBridgeUrl(getStoredProviderBaseUrl("colab_bridge"));
      setCfGatewayKey(localStorage.getItem("cloudflare_ai_gateway_key") || "");
      setCfGatewayUrl(getStoredProviderBaseUrl("cloudflare_ai_gateway"));
      setCfGatewayAccountId(
        localStorage.getItem("cloudflare_ai_gateway_account_id") || "",
      );
      setCfGatewayGatewayId(
        localStorage.getItem("cloudflare_ai_gateway_gateway_id") || "",
      );
      setWorkersAiKey(localStorage.getItem("workers_ai_key") || "");
      setWorkersAiAccountId(
        localStorage.getItem("workers_ai_account_id") || "",
      );
      setAnthropicKey(localStorage.getItem("anthropic_api_key") || "");
      setAnthropicBaseUrl(getStoredProviderBaseUrl("anthropic"));
      setHuggingfaceKey(localStorage.getItem("huggingface_api_key") || "");
      setHuggingfaceBaseUrl(getStoredProviderBaseUrl("huggingface"));
      setEnableLangsmith(localStorage.getItem("enable_langsmith") === "true");
      setLangsmithApiKey(localStorage.getItem("langsmith_api_key") || "");
      setLangsmithProject(
        localStorage.getItem("langsmith_project") ||
        "aicodex-agent-react-benchmarks",
      );
      setPrivateWorkspace(
        localStorage.getItem("private_workspace") !== "false",
      );
    }
  }, [isOpen, provider]);

  const testOllamaCloud = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "X-Base-Url": ollamaCloudUrl || getStoredProviderBaseUrl("ollama_cloud"),
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (ollamaCloudKey) headers["X-API-Key"] = ollamaCloudKey;

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=ollama_cloud`,
        {
          headers,
        },
      );

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message:
            models.length > 0
              ? `Connected! Found ${models.length} models.`
              : "Connected, but no models found.",
        });
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
        });
      }
    } catch (e) {
      setTestResult({ success: false, message: "Network error. Check URL." });
    } finally {
      setIsTesting(false);
    }
  };

  const testOpenAI = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (openAiKey) headers["X-API-Key"] = openAiKey;
      if (openAiBaseUrl) headers["X-Base-Url"] = openAiBaseUrl;
      if (activeSpace) headers["X-Space-Slug"] = activeSpace.slug;
      headers["X-Is-Premium"] = isPremiumSpace ? "true" : "false";

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=openai`,
        {
          headers,
        },
      );

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message:
            models.length > 0
              ? `Connected! Found ${models.length} models.`
              : "Connected, but no models found.",
        });
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
        });
      }
    } catch (e) {
      setTestResult({ success: false, message: "Network error. Check configuration." });
    } finally {
      setIsTesting(false);
    }
  };

  const testAnthropic = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (anthropicKey) headers["X-API-Key"] = anthropicKey;
      if (anthropicBaseUrl) headers["X-Base-Url"] = anthropicBaseUrl;
      if (activeSpace) headers["X-Space-Slug"] = activeSpace.slug;
      headers["X-Is-Premium"] = isPremiumSpace ? "true" : "false";

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=anthropic`,
        {
          headers,
        },
      );

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message:
            models.length > 0
              ? `Connected! Found ${models.length} models.`
              : "Connected, but no models found.",
        });
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
        });
      }
    } catch (e) {
      setTestResult({
        success: false,
        message: "Network error. Check configuration.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testColabBridge = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {
        "X-Base-Url": colabBridgeUrl || "",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (colabBridgeKey) headers["X-API-Key"] = colabBridgeKey;

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=colab_bridge`,
        {
          headers,
        },
      );

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message:
            models.length > 0
              ? `Connected! Found ${models.length} models.`
              : "Connected, but no models found.",
        });
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
        });
      }
    } catch (e) {
      setTestResult({ success: false, message: "Network error. Check URL." });
    } finally {
      setIsTesting(false);
    }
  };

  const testCloudflareAIGateway = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (cfGatewayKey) headers["X-API-Key"] = cfGatewayKey;
      if (cfGatewayUrl) headers["X-Base-Url"] = cfGatewayUrl;
      if (cfGatewayAccountId) headers["X-Account-Id"] = cfGatewayAccountId;
      if (cfGatewayGatewayId) headers["X-Gateway-Id"] = cfGatewayGatewayId;
      if (activeSpace) headers["X-Space-Slug"] = activeSpace.slug;
      headers["X-Is-Premium"] = isPremiumSpace ? "true" : "false";

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=cloudflare_ai_gateway`,
        {
          headers,
        },
      );

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message:
            models.length > 0
              ? `Connected! Found ${models.length} models.`
              : "Connected, but no models found.",
        });
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
        });
      }
    } catch (e) {
      setTestResult({
        success: false,
        message: "Network error. Check configuration.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testWorkersAI = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (workersAiKey) headers["X-API-Key"] = workersAiKey;
      if (workersAiAccountId) headers["X-Account-Id"] = workersAiAccountId;
      if (activeSpace) headers["X-Space-Slug"] = activeSpace.slug;
      headers["X-Is-Premium"] = isPremiumSpace ? "true" : "false";

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=workers_ai`,
        {
          headers,
        }
      );

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message:
            models.length > 0
              ? `Connected! Found ${models.length} models.`
              : "Connected, but no models found.",
        });
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
        });
      }
    } catch (e) {
      setTestResult({
        success: false,
        message: "Network error. Check configuration.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const testHuggingFace = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (huggingfaceKey) headers["X-API-Key"] = huggingfaceKey;
      if (huggingfaceBaseUrl) headers["X-Base-Url"] = huggingfaceBaseUrl;
      if (activeSpace) headers["X-Space-Slug"] = activeSpace.slug;
      headers["X-Is-Premium"] = isPremiumSpace ? "true" : "false";

      const response = await fetch(
        `${config.API_BASE_URL}${config.API_V1_STR}/models?provider=huggingface`,
        {
          headers,
        }
      );

      if (response.ok) {
        const models = await response.json();
        setTestResult({
          success: true,
          message:
            models.length > 0
              ? `Connected! Found ${models.length} models.`
              : "Connected, but no models found.",
        });
      } else {
        const err = await response.json();
        setTestResult({
          success: false,
          message: err.detail || "Connection failed.",
        });
      }
    } catch (e) {
      setTestResult({ success: false, message: "Network error. Check configuration." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    try {
      setProvider(activeProvider);

      localStorage.setItem("openai_api_key", (openAiKey || "").trim());
      localStorage.setItem("openai_base_url", (openAiBaseUrl || "").trim());
      localStorage.setItem("openrouter_api_key", (openRouterKey || "").trim());
      if (geminiAuthMethod === "vertex") {
        const constructedKey = `vertex_adc:${(geminiProjectId || "").trim()}:${(geminiRegion || "").trim()}`;
        localStorage.setItem("gemini_api_key", constructedKey);
      } else {
        localStorage.setItem("gemini_api_key", (geminiKey || "").trim());
      }
      localStorage.setItem("ollama_cloud_key", (ollamaCloudKey || "").trim());
      localStorage.setItem("ollama_cloud_url", (ollamaCloudUrl || "").trim());
      localStorage.setItem("colab_bridge_key", (colabBridgeKey || "").trim());
      localStorage.setItem("colab_bridge_url", (colabBridgeUrl || "").trim());
      localStorage.setItem(
        "cloudflare_ai_gateway_key",
        (cfGatewayKey || "").trim(),
      );
      localStorage.setItem(
        "cloudflare_ai_gateway_url",
        (cfGatewayUrl || "").trim(),
      );
      localStorage.setItem(
        "cloudflare_ai_gateway_account_id",
        (cfGatewayAccountId || "").trim(),
      );
      localStorage.setItem(
        "cloudflare_ai_gateway_gateway_id",
        (cfGatewayGatewayId || "").trim(),
      );
      localStorage.setItem("workers_ai_key", (workersAiKey || "").trim());
      localStorage.setItem(
        "workers_ai_account_id",
        (workersAiAccountId || "").trim(),
      );
      localStorage.setItem("anthropic_api_key", (anthropicKey || "").trim());
      localStorage.setItem("anthropic_base_url", (anthropicBaseUrl || "").trim());
      localStorage.setItem("huggingface_api_key", (huggingfaceKey || "").trim());
      localStorage.setItem("huggingface_base_url", (huggingfaceBaseUrl || "").trim());
      localStorage.setItem(
        "enable_langsmith",
        enableLangsmith ? "true" : "false",
      );
      localStorage.setItem("langsmith_api_key", (langsmithApiKey || "").trim());
      localStorage.setItem(
        "langsmith_project",
        (langsmithProject || "").trim(),
      );
      localStorage.setItem(
        "private_workspace",
        privateWorkspace ? "true" : "false",
      );

      // Dispatch custom event for parts of the app not yet using Context
      window.dispatchEvent(new Event("ai-settings-changed"));

      setIsOpen(false);

      // Force reload to ensure all components pick up new keys from localStorage
      // Small delay to allow modal close animation to start if needed,
      // but window.location.reload() is the priority.
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
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => setIsOpen(false)}
      >
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-[#E2E6EC] border border-black/[0.06] p-6 text-left align-middle shadow-2xl transition-all">
                {/* Header */}
                <div className="flex justify-between items-center mb-5">
<Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-[#1A1D2E] flex items-center gap-2"
                  >
                    <Cog6ToothIcon className="w-5 h-5 text-[#fd3b12]" />
                    {activeSettingsTab === "providers" ? "Provider Settings" : "Integrations"}
                  </Dialog.Title>
                  <div className="flex gap-2 mb-4" role="tablist" aria-label="Settings sections">
                    <button
                      role="tab"
                      aria-selected={activeSettingsTab === "providers"}
                      onClick={() => setActiveSettingsTab("providers")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeSettingsTab === "providers"
                        ? "bg-[#fd3b12] text-white shadow-lg shadow-[#fd3b12]/30"
                        : "bg-[#D8DCE4] text-[#4A4D5E] hover:bg-[#D0D4DC] hover:text-[#1A1D2E]"
                      }`}
                    >
                      <Cog6ToothIcon className="w-4 h-4" />
                      <span>Providers</span>
                    </button>
                    <button
                      role="tab"
                      aria-selected={activeSettingsTab === "integrations"}
                      onClick={() => setActiveSettingsTab("integrations")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeSettingsTab === "integrations"
                        ? "bg-[#fd3b12] text-white shadow-lg shadow-[#fd3b12]/30"
                        : "bg-[#D8DCE4] text-[#4A4D5E] hover:bg-[#D0D4DC] hover:text-[#1A1D2E]"
                      }`}
                    >
                      <ServerIcon className="w-4 h-4" />
                      <span>Integrations</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-[#7A7D8E] hover:text-[#1A1D2E] transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#4A4D5E] mb-6 leading-relaxed">
                  Select your default AI provider and configure API keys. Keys
                  are stored in your browser's local storage and sent directly
                  to the inference engine.
                </p>

                {/* Provider Radio Group */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[#4A4D5E] uppercase tracking-wider mb-3">
                    Default Provider
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {PROVIDERS.map((provider) => {
                      const isActive = activeProvider === provider.id;
                      const isLiteRt = provider.id === "litert";
                      return (
                        <button
                          key={provider.id}
                          onClick={() => setActiveProvider(provider.id)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${isActive
                              ? isLiteRt
                                ? "bg-white/60 backdrop-blur-md border-[#3B82F6]/60 shadow-lg shadow-[#3B82F6]/20"
                                : "bg-[#fd3b12]/10 border-[#fd3b12] shadow-md shadow-[#fd3b12]/10"
                              : isLiteRt
                                ? "bg-white/35 backdrop-blur-md border-[#3B82F6]/20 hover:bg-white/55 hover:border-[#3B82F6]/40"
                                : "bg-[#D8DCE4] border-transparent hover:bg-[#D0D4DC] hover:border-black/[0.08]"
                            }`}
                        >
                          {isActive && (
                            <div
                              className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${isLiteRt
                                  ? "bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.75)]"
                                  : "bg-[#fd3b12] shadow-[0_0_6px_rgba(255,102,0,0.7)]"
                                }`}
                            />
                          )}
                          <ProviderIcon provider={provider} size={28} />
                          <span
                            className={`text-[11px] font-semibold ${isActive
                                ? isLiteRt
                                  ? "text-[#1D4ED8]"
                                  : "text-[#fd3b12]"
                                : "text-[#4A4D5E]"
                              }`}
                          >
                            {provider.label}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setMoreProvidersOpen(true)}
                      className="relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-dashed border-black/[0.12] bg-[#D8DCE4] text-[#4A4D5E] hover:bg-[#D0D4DC] hover:border-black/[0.2] transition-all duration-200"
                    >
                      <span className="w-7 h-7 rounded-full bg-[#fd3b12]/10 text-[#fd3b12] flex items-center justify-center text-lg font-bold leading-none">
                        +
                      </span>
                      <span className="text-[11px] font-semibold">More</span>
                    </button>
                  </div>
                </div>

                {/* Conditional API Key Inputs */}
                <div className="space-y-4">
                  {activeProvider === "local" && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-xs text-green-700 font-medium flex items-center gap-2">
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Using local Ollama GPU — no API key needed
                      </p>
                      <p className="text-[10px] text-green-600/70 mt-1.5">
                        Ensure Ollama is running on localhost:11434
                      </p>
                    </div>
                  )}

                  {activeProvider === "litert" && (
                    <div className="relative overflow-hidden space-y-3 rounded-2xl border border-[#3B82F6]/25 bg-white/45 backdrop-blur-md shadow-[0_12px_28px_-18px_rgba(59,130,246,0.85)] p-4">
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/65 via-[#DBEAFE]/30 to-[#93C5FD]/20" />
                      <p className="relative text-xs text-[#1E40AF] font-medium leading-relaxed">
                        LiteRT runs in the dedicated Chat portal where you can use local on-device inference controls.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setProvider("litert");
                          setIsOpen(false);
                          navigate("/chat");
                        }}
                        className="relative w-full flex items-center justify-center gap-2 rounded-xl border border-[#3B82F6]/40 bg-white/80 text-[#1D4ED8] px-4 py-3 text-sm font-semibold hover:bg-[#DBEAFE]/70 hover:border-[#3B82F6]/60 transition-all shadow-sm"
                      >
                        <svg
                          className="w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path
                            d="M7.5 7.5V4.5L3 9L7.5 13.5V10.5H10.5C13.2614 10.5 15.5 12.7386 15.5 15.5V17"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <rect
                            x="13"
                            y="4"
                            width="8"
                            height="8"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                          <path
                            d="M15.5 18H20"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                        Open LiteRT Chat Portal
                      </button>
                    </div>
                  )}

                  {activeProvider === "ollama_cloud" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Remote Ollama URL
                        </label>
                        <input
                          type="text"
                          value={ollamaCloudUrl}
                          onChange={(e) => setOllamaCloudUrl(e.target.value)}
                          placeholder="https://ollama.your-domain.com"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Authorization Token (Optional)
                        </label>
                        <input
                          type="password"
                          value={ollamaCloudKey}
                          onChange={(e) => setOllamaCloudKey(e.target.value)}
                          placeholder="Bearer token or API key"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testOllamaCloud}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isTesting
                              ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                              : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                            }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {testResult.success ? (
                              <CheckCircleIcon className="w-4 h-4" />
                            ) : (
                              <ExclamationCircleIcon className="w-4 h-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeProvider === "colab_bridge" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Colab Bridge Base URL
                        </label>
                        <input
                          type="text"
                          value={colabBridgeUrl}
                          onChange={(e) => setColabBridgeUrl(e.target.value)}
                          placeholder="https://xxxx.ngrok-free.app"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Handshake Secret (Optional)
                        </label>
                        <input
                          type="password"
                          value={colabBridgeKey}
                          onChange={(e) => setColabBridgeKey(e.target.value)}
                          placeholder="Authentication token or API key"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testColabBridge}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isTesting
                              ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                              : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                            }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {testResult.success ? (
                              <CheckCircleIcon className="w-4 h-4" />
                            ) : (
                              <ExclamationCircleIcon className="w-4 h-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeProvider === "openai" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          OpenAI Base URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={openAiBaseUrl}
                          onChange={(e) => setOpenAiBaseUrl(e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          OpenAI API Key
                        </label>
                        <input
                          type="password"
                          value={openAiKey}
                          onChange={(e) => setOpenAiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testOpenAI}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isTesting
                              ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                              : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                            }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {testResult.success ? (
                              <CheckCircleIcon className="w-4 h-4" />
                            ) : (
                              <ExclamationCircleIcon className="w-4 h-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeProvider === "openrouter" && (
                    <div>
                      <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                        OpenRouter API Key
                      </label>
                      <input
                        type="password"
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                      />
                    </div>
                  )}

                  {activeProvider === "gemini" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-2">
                          Authentication Method
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-[#D8DCE4] p-1 rounded-xl border border-black/[0.04]">
                          <button
                            type="button"
                            onClick={() => setGeminiAuthMethod("api_key")}
                            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${geminiAuthMethod === "api_key"
                                ? "bg-[#1A1D2E] text-white shadow-sm"
                                : "text-[#4A4D5E] hover:text-[#1A1D2E]"
                              }`}
                          >
                            Google AI Studio
                          </button>
                          <button
                            type="button"
                            onClick={() => setGeminiAuthMethod("vertex")}
                            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${geminiAuthMethod === "vertex"
                                ? "bg-[#1A1D2E] text-white shadow-sm"
                                : "text-[#4A4D5E] hover:text-[#1A1D2E]"
                              }`}
                          >
                            Vertex AI (ADC)
                          </button>
                        </div>
                      </div>

                      {geminiAuthMethod === "api_key" ? (
                        <div>
                          <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                            Google Gemini API Key
                          </label>
                          <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIza..."
                            className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                          />
                        </div>
                      ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="bg-[#1A1D2E]/[0.03] border border-[#1A1D2E]/[0.08] rounded-xl p-3.5 text-xs text-[#4A4D5E] leading-relaxed">
                            💡{" "}
                            <strong>
                              Application Default Credentials (ADC)
                            </strong>
                            <p className="mt-1">
                              Uses the backend environment's credentials. Ensure
                              you have run{" "}
                              <code>gcloud auth application-default login</code>{" "}
                              on your host.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[#1A1D2E] mb-1">
                                GCP Project ID
                              </label>
                              <input
                                type="text"
                                value={geminiProjectId}
                                onChange={(e) =>
                                  setGeminiProjectId(e.target.value)
                                }
                                placeholder="aicodex-lab (optional)"
                                className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-3.5 py-2 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-xs placeholder:text-[#7A7D8E] transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#1A1D2E] mb-1">
                                GCP Region
                              </label>
                              <input
                                type="text"
                                value={geminiRegion}
                                onChange={(e) =>
                                  setGeminiRegion(e.target.value)
                                }
                                placeholder="us-west1 (optional)"
                                className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-3.5 py-2 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-xs placeholder:text-[#7A7D8E] transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeProvider === "cloudflare_ai_gateway" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Cloudflare AI Gateway Base URL
                        </label>
                        <input
                          type="text"
                          value={cfGatewayUrl}
                          onChange={(e) => setCfGatewayUrl(e.target.value)}
                          placeholder="https://gateway.ai.cloudflare.com"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#1A1D2E] mb-1">
                            Account ID
                          </label>
                          <input
                            type="text"
                            value={cfGatewayAccountId}
                            onChange={(e) =>
                              setCfGatewayAccountId(e.target.value)
                            }
                            placeholder="your-account-id"
                            className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-3.5 py-2 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-xs placeholder:text-[#7A7D8E] transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#1A1D2E] mb-1">
                            Gateway ID
                          </label>
                          <input
                            type="text"
                            value={cfGatewayGatewayId}
                            onChange={(e) =>
                              setCfGatewayGatewayId(e.target.value)
                            }
                            placeholder="your-gateway-id"
                            className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-3.5 py-2 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-xs placeholder:text-[#7A7D8E] transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Authorization Token (Optional)
                        </label>
                        <input
                          type="password"
                          value={cfGatewayKey}
                          onChange={(e) => setCfGatewayKey(e.target.value)}
                          placeholder="Bearer token or API key"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testCloudflareAIGateway}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isTesting
                              ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                              : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                            }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {testResult.success ? (
                              <CheckCircleIcon className="w-4 h-4" />
                            ) : (
                              <ExclamationCircleIcon className="w-4 h-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeProvider === "workers_ai" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#1A1D2E] mb-1">
                          Account ID
                        </label>
                        <input
                          type="text"
                          value={workersAiAccountId}
                          onChange={(e) =>
                            setWorkersAiAccountId(e.target.value)
                          }
                          placeholder="your-account-id"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-3.5 py-2 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-xs placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          API Token (Optional)
                        </label>
                        <input
                          type="password"
                          value={workersAiKey}
                          onChange={(e) => setWorkersAiKey(e.target.value)}
                          placeholder="Bearer token or API key"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testWorkersAI}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isTesting
                              ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                              : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                            }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {testResult.success ? (
                              <CheckCircleIcon className="w-4 h-4" />
                            ) : (
                              <ExclamationCircleIcon className="w-4 h-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeProvider === "anthropic" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Anthropic Base URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={anthropicBaseUrl}
                          onChange={(e) => setAnthropicBaseUrl(e.target.value)}
                          placeholder="https://api.anthropic.com"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Anthropic API Key
                        </label>
                        <input
                          type="password"
                          value={anthropicKey}
                          onChange={(e) => setAnthropicKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testAnthropic}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isTesting
                              ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                              : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                            }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {testResult.success ? (
                              <CheckCircleIcon className="w-4 h-4" />
                            ) : (
                              <ExclamationCircleIcon className="w-4 h-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeProvider === "huggingface" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Hugging Face Base URL (Optional)
                        </label>
                        <input
                          type="text"
                          value={huggingfaceBaseUrl}
                          onChange={(e) => setHuggingfaceBaseUrl(e.target.value)}
                          placeholder="https://api-inference.huggingface.co"
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                          Hugging Face API Key
                        </label>
                        <input
                          type="password"
                          value={huggingfaceKey}
                          onChange={(e) => setHuggingfaceKey(e.target.value)}
                          placeholder="hf_..."
                          className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={testHuggingFace}
                          disabled={isTesting}
                          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${isTesting
                              ? "bg-[#D8DCE4] text-[#7A7D8E] cursor-not-allowed"
                              : "bg-white text-[#1A1D2E] border border-black/[0.06] hover:bg-[#D8DCE4]"
                            }`}
                        >
                          {isTesting ? (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowPathIcon className="w-4 h-4" />
                          )}
                          Test Connection
                        </button>

                        {testResult && (
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] ${testResult.success
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {testResult.success ? (
                              <CheckCircleIcon className="w-4 h-4" />
                            ) : (
                              <ExclamationCircleIcon className="w-4 h-4" />
                            )}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* LangSmith Telemetry Settings */}
                <div className="mt-6 pt-6 border-t border-black/[0.06]">
                  <label className="block text-xs font-semibold text-[#4A4D5E] uppercase tracking-wider mb-4">
                    LangSmith Telemetry
                  </label>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between group">
                      <span className="text-sm text-[#1A1D2E] font-medium group-hover:text-[#fd3b12] transition-colors">
                        Enable LangSmith Tracing
                      </span>
                      <button
                        onClick={() => setEnableLangsmith(!enableLangsmith)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enableLangsmith ? "bg-[#fd3b12]" : "bg-[#D8DCE4]"
                          }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableLangsmith ? "translate-x-5" : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>

                    {enableLangsmith && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div>
                          <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                            LangSmith API Key
                          </label>
                          <input
                            type="password"
                            value={langsmithApiKey}
                            onChange={(e) => setLangsmithApiKey(e.target.value)}
                            placeholder="ls__..."
                            className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 font-mono text-sm placeholder:text-[#7A7D8E] transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#1A1D2E] mb-1.5">
                            LangSmith Project
                          </label>
                          <input
                            type="text"
                            value={langsmithProject}
                            onChange={(e) =>
                              setLangsmithProject(e.target.value)
                            }
                            placeholder="aicodex-agent-react-benchmarks"
                            className="w-full bg-[#D8DCE4] border border-black/[0.08] rounded-xl px-4 py-2.5 text-[#1A1D2E] focus:outline-none focus:ring-2 focus:ring-[#fd3b12]/40 focus:border-[#fd3b12]/30 text-sm placeholder:text-[#7A7D8E] transition-all"
                          />
                        </div>
                        <div className="flex items-center justify-between group">
                          <div className="flex flex-col">
                            <span className="text-sm text-[#1A1D2E] font-medium group-hover:text-[#fd3b12] transition-colors">
                              Private Workspace
                            </span>
                            <span className="text-[10px] text-[#7A7D8E]">
                              Enforces data egress restriction (gating
                              telemetry)
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              setPrivateWorkspace(!privateWorkspace)
                            }
                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${privateWorkspace ? "bg-[#fd3b12]" : "bg-[#D8DCE4]"
                              }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${privateWorkspace
                                  ? "translate-x-5"
                                  : "translate-x-0"
                                }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Identity Toggles */}
                <div className="mt-8 pt-6 border-t border-black/[0.06]">
                  <label className="block text-xs font-semibold text-[#4A4D5E] uppercase tracking-wider mb-4">
                    Neural Identity & Effects
                  </label>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { key: "isDynamic", label: "Motion & Animations" },
                      { key: "showTraces", label: "Neural Energy Traces" },
                      {
                        key: "showNeuralStrings",
                        label: "Neural Drifting Strings",
                      },
                      { key: "showScanlines", label: "CRT Scanlines" },
                      {
                        key: "showMonochrome",
                        label: "Monochrome Neural Phosphor",
                      },
                      { key: "showWaves", label: "Great Neural Waves" },
                      { key: "showGrain", label: "Cinematic Film Grain" },
                      {
                        key: "showGlitches",
                        label: "Digital Glitch Artifacts",
                      },
                      { key: "showVideo", label: "High-Fi Video Layer" },
                      {
                        key: "showStillBackground",
                        label: "Static Vector Wallpaper",
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between group"
                      >
                        <span className="text-sm text-[#1A1D2E] font-medium group-hover:text-[#fd3b12] transition-colors">
                          {item.label}
                        </span>
                        <button
                          onClick={() =>
                            updateVisualSetting(
                              item.key as keyof VisualSettings,
                              !visualSettings[item.key as keyof VisualSettings],
                            )
                          }
                          className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${visualSettings[item.key as keyof VisualSettings]
                              ? "bg-[#fd3b12]"
                              : "bg-[#D8DCE4]"
                            }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${visualSettings[item.key as keyof VisualSettings]
                                ? "translate-x-5"
                                : "translate-x-0"
                              }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Super Admin Section */}
                  <div className="mt-6 pt-6 border-t border-black/[0.06]">
                    <label className="block text-xs font-semibold text-[#4A4D5E] uppercase tracking-wider mb-4">
                      Super Admin Controls
                    </label>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate("/admin/overview");
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-black/5 hover:bg-black/10 border border-black/[0.05] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#fd3b12]/10 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-[#fd3b12]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9 20l-5.447-2.724A2 2 0 013 15.485V6.415a2 2 0 011.118-1.789L9 2l5.447 2.724A2 2 0 0115 6.415v9.07a2 2 0 01-1.118 1.789L9 20zm0-18v18m0-18l-5.447 2.724m10.894 0L9 2m5.447 13.485L9 20m-5.447-2.724L9 20"
                            />
                          </svg>
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] font-bold text-[#1A1D2E] uppercase tracking-wider">
                            Super Admin Overview
                          </div>
                          <div className="text-[9px] text-[#7A7D8E]">
                            Access cross-workspace knowledge clusters
                          </div>
                        </div>
                      </div>
                      <svg
                        className="w-4 h-4 text-[#7A7D8E] group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {activeSettingsTab === "integrations" && (
                  <div className="p-6 bg-white/50 border border-black/[0.05] rounded-xl mt-4">
                    <p className="text-[#7A7D8E] text-sm">
                      Integrations tab is active. Configure your MCP servers and
                      third-party service connections here.
                    </p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-8 flex justify-end gap-3">
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
                    Save Changes
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      <MoreProvidersModal
        isOpen={moreProvidersOpen}
        setIsOpen={setMoreProvidersOpen}
      />
    </Transition>
  );
};

export default SettingsModal;
