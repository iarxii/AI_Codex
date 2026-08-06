import React from "react";
import type { CodexSpace } from "../contexts/AIContext";
import { FinTraderHarness } from "../components/chat/FinTraderHarness";
import { GemmaSandboxHarness } from "../components/chat/GemmaSandboxHarness";
import { MicrosoftAgentHarness } from "../components/chat/MicrosoftAgentHarness";
import { SpiritBirdChatHarness } from "../components/chat/SpiritBirdChatHarness";

type HarnessKey = "fintrader" | "gemma-sandbox" | "microsoft-agent" | "spirit-book-chat";

interface HarnessRendererProps {
  spaceName: string;
  thoughtLog: any[];
  telemetry: any;
  onArtifactReady: (artifact: { id: string; title: string; content: string; language: string }) => void;
}

export interface SpaceHarnessDefinition {
  key: HarnessKey;
  label: string;
  accentClass: string;
  collapsedLabel: string;
  render: (props: HarnessRendererProps) => React.ReactNode;
}

const SPACE_HARNESSES: Record<HarnessKey, SpaceHarnessDefinition> = {
  fintrader: {
    key: "fintrader",
    label: "FinTrader Harness",
    accentClass: "text-[#fd3b12]",
    collapsedLabel: "FINTRADER",
    render: ({ spaceName }) => <FinTraderHarness spaceName={spaceName} />,
  },
  "gemma-sandbox": {
    key: "gemma-sandbox",
    label: "Gemma Sandbox",
    accentClass: "text-[#446EFF]",
    collapsedLabel: "GEMMA LAB",
    render: ({ thoughtLog, telemetry }) => <GemmaSandboxHarness thoughtLog={thoughtLog} telemetry={telemetry} />,
  },
  "microsoft-agent": {
    key: "microsoft-agent",
    label: "Microsoft Agent Lab",
    accentClass: "text-[#0078D4]",
    collapsedLabel: "MS CODE LAB",
    render: ({ onArtifactReady }) => <MicrosoftAgentHarness onArtifactReady={onArtifactReady} />,
  },
  "spirit-book-chat": {
    key: "spirit-book-chat",
    label: "SpiritBook Helper",
    accentClass: "text-[#6366f1]",
    collapsedLabel: "SPIRIT BOOK",
    render: () => <SpiritBirdChatHarness />,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const resolveSpaceHarness = (space: Pick<CodexSpace, "config_json"> | null | undefined): SpaceHarnessDefinition | null => {
  if (!space?.config_json) return null;

  try {
    const config: unknown = JSON.parse(space.config_json);
    if (!isRecord(config) || typeof config.harness !== "string") return null;
    return SPACE_HARNESSES[config.harness as HarnessKey] ?? null;
  } catch {
    return null;
  }
};