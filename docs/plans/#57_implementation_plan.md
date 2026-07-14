# CodexSpaces UI Integration Plan

This plan details the frontend modifications required to integrate the new `health-tech` (MedGemma Soft Lab) and `microsoft-agent-lab` (Microsoft Agentic Code Lab) workspaces into the `AI_Codex` platform React UI.

## Goal Description
1. Configure **MedGemma Soft Lab (`health-tech`)** to utilize the exact same UI components, styling, and `GemmaSandboxHarness` as the existing Gemma Code Lab.
2. Configure **Microsoft Agentic Code Lab (`microsoft-agent-lab`)** with distinct "Office Process / Knowledge Work" branding, distinct colors (e.g., Microsoft Blue `#0078D4`), and a custom placeholder harness for interacting with Power Platform/Office tools.

## User Review Required

> [!IMPORTANT]
> The Microsoft Code Lab needs a dedicated side harness component (like the `GemmaSandboxHarness`). I propose creating a new `MicrosoftAgentHarness.tsx` component that features placeholder tools for Office Knowledge Work (e.g., "Power Apps Builder", "Flow Deployer", "SharePoint Graph"). Is this acceptable for the initial iteration?

## Proposed Changes

### 1. Route & Harness Registration (Chat Component)

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)
- Update the hardcoded space arrays (`['trading-space', 'code-lab', 'spirit-book']`) to include `health-tech` and `microsoft-agent-lab`.
- Map `health-tech` to render exactly as `code-lab` (using `GemmaSandboxHarness` and the `#446EFF` UI color).
- Create a distinct rendering branch for `microsoft-agent-lab`:
  - Provide a distinct title: **"Microsoft Code Lab (Office Copilot)"**
  - Configure the theme color to Microsoft Blue (`#0078D4`).
  - Set up unique quick-action side icons: Office Data (📊), Power Automate (⚡), PowerApps (📱).
  - Mount a new `<MicrosoftAgentHarness />` component in the side drawer.

### 2. Message Rendering & Global Configuration

#### [MODIFY] [MessageItem.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MessageItem.tsx)
- Add `health-tech` and `microsoft-agent-lab` to the arrays checking for ADK/A2UI specific rendering environments (`["code-lab", "gpt-oss"]`).
- Ensure `health-tech` triggers the exact same artifact compilation paths as `code-lab`.

#### [MODIFY] [MessageList.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MessageList.tsx)
- In the `spaceOverrides` dictionary, add:
  - `health-tech`: Name="MedGemma Soft Lab", Icon="gemma.svg", Desc="Specialized medical and clinical AI assistant..."
  - `microsoft-agent-lab`: Name="Microsoft Agentic Code Lab", Icon="windows-logo or ms-office.svg", Desc="Automate enterprise workflows with Power Platform and Office Graph."

#### [MODIFY] [P5Background.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/P5Background.tsx)
- Add particle animation settings for `health-tech` (mirroring `code-lab` logic).
- Add distinct particle animation settings for `microsoft-agent-lab` (perhaps a slightly sharper, enterprise grid aesthetic using blue).

#### [MODIFY] [ProviderSelector.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/ProviderSelector.tsx)
- Ensure both new spaces are included in provider restriction/filtration logic if applicable.

### 3. New Harness Component

#### [NEW] [MicrosoftAgentHarness.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MicrosoftAgentHarness.tsx)
- Create a new component displaying a functional tabbed interface for "Office Knowledge Work".
- **Sub-tabs to include:**
  - **MCP Integrations**: A view showing active Model Context Protocol connections (e.g., local filesystem, enterprise directories).
  - **Outlook Calendar**: A functional placeholder to view/manage daily schedules and meeting context.
  - **OneDrive / SharePoint**: A view for document retrieval and enterprise file context.
  - **Power Platform**: Quick links and tooling for Power Apps Builder, Power Automate Flow Deployer, and environment management.
- Include mock UI states (lists, data grids, status indicators) for tracking deployment logs, Graph API payloads, and tenant variables.

## Verification Plan

### Automated Tests
- Run `npm run build` or `tsc --noEmit` in `client/src` to ensure the new React components and type mappings compile correctly.

### Manual Verification
- After deployment, switch to the "MedGemma Soft Lab" space and confirm the Gemma UI harness opens automatically.
- Switch to the "Microsoft Agentic Code Lab" space and confirm the new Microsoft Blue theme and custom side-drawer tools appear.
