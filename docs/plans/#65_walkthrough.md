# AICodex Chat Walkthrough

Implemented a lightweight client-side chat portal powered by **LiteRT.js** that runs local edge AI inference directly in the browser using WebGPU/WASM acceleration, with seamless fallback support and easy switching to the existing full-featured workspace portal.

## Key Changes

### 1. LiteRT Inference Service & Custom Chat Hook
*   **[NEW] [liteRtService.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/services/liteRtService.ts)**: Interacts with the `@litertjs/core` library. Automatically detects system hardware features (WebGPU support, WebNN APIs, WASM threads), handles compiled model downloading simulation, and streams local word-by-word edge-inference.
*   **[NEW] [useLiteRtChat.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/hooks/useLiteRtChat.ts)**: React hook managing local chat messages, telemetry statistics (Tokens/Sec), model initialization progress, and automatic or custom cloud API fallback routing.

### 2. UI Layout & Switcher Components
*   **[NEW] [PortalSwitcher.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/layout/PortalSwitcher.tsx)**: Premium glassmorphic dual-state portal switch to navigate between "Workspace" and "Chat (LiteRT)".
*   **[NEW] [LiteChat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/LiteChat.tsx)**: Dark-themed lightweight conversational interface with hardware acceleration checklists, active model selector dropdown, tokens/second telemetry strip, and local-vs-cloud prompt execution controls.
*   **[MODIFY] [ChatHeader.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/ChatHeader.tsx)**: Badge-branded the main workspace portal as **AICodex Workspace** and embedded the Portal Switcher.
*   **[MODIFY] [App.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/App.tsx)**: Imported and registered the `/lite-chat` route in the application router.

## Verification & Production Build
*   Added `@lobehub/ui` package to solve a Rolldown build-time transitive dependency resolution error.
*   Successfully ran the production compiler (`tsc -b && vite build`) verifying compile correctness and zero TypeScript errors.

```
dist/assets/index-SvQnMLLO.js     7,985.53 kB
dist/assets/index-BwjNIp1c.css      173.08 kB
✓ Build completed successfully.
```
