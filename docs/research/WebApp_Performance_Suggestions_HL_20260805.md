ME: I have a web based agentic harness, the web ui is quite dense and complex, built on typescript react. The problem is that its not performant now, I am thinking of porting it to a native approach, will a react native conversion work better?


GEMINI:
A React Native conversion will likely not solve your performance issues and could significantly degrade user experience if your UI is inherently dense and complex. [1, 2] 
While React Native compiles to native UI components, it is fundamentally designed for mobile screens (iOS/Android). Porting a complex web layout to a native architecture requires a deep understanding of where your actual performance bottlenecks lie. [3, 4, 5, 6, 7] 
------------------------------
## 🔍 Why React Native is Risky for Dense UIs

* The Bridge Bottleneck: React Native communicates between the JavaScript thread and the Native thread via a serialization bridge. If your agentic harness streams massive amounts of real-time data, state updates, or logs, this bridge will become a massive bottleneck, causing the UI to freeze. [8, 9, 10, 11, 12] 
* Layout Engine Overhead: React Native uses Yoga to translate Flexbox into native layouts. For a highly complex, dense grid or multi-panel dashboard (common in AI agent harnesses), the computation layout cost on native can actually be slower than modern browser engines. [13, 14] 
* Lack of Native Multi-Window/Desktop Support: While React Native for Desktop (macOS/Windows) exists, it is far less mature than its mobile counterpart. Handling complex mouse interactions, complex keyboard shortcuts, and resizable multi-pane windows is notoriously difficult. [15, 16] 

------------------------------
## 📊 Web vs. Native: Where is the Bottleneck?
Before rewriting your entire codebase, you must pinpoint exactly why the React app is slow. Agentic UIs usually slow down due to JavaScript execution/rendering, not DOM painting. [17] 

| Problem Source | Why it Happens in Agentic UIs | Will Native Fix It? |
|---|---|---|
| High-Frequency Streams | LLM token streaming or real-time agent thought logs hammering React state. | ❌ No. Native bridges clog just like React state. |
| Massive DOM Tree | Rendering thousands of log lines, nodes, or heavy JSON trees at once. | ⚠️ Partially. (Via native virtualization, but web can do this too). |
| Heavy JS Computations | Processing agent state graphs or token parsing on the main UI thread. | ❌ No. JavaScript speed remains identical. |
| GPU/Composite Overhead | Complex CSS animations, canvas rendering, or node-graph drag-and-drop. | Yes. Native handles hardware acceleration better. |

------------------------------
## 🛠️ Strategic Alternatives (Fix Web First)
Rewriting in React Native is an expensive gamble. Instead, consider these high-utility optimizations for your existing TypeScript React setup, ordered from easiest to most impactful: [18, 19] 
## 1. Implement Virtualization for Logs and Grids [20] 
If your harness displays massive scrolling terminal logs, agent steps, or data tables, do not render hidden elements. Use @tanstack/react-virtual or react-window. This keeps the DOM count minimal by only rendering what is physically visible on the screen. [21, 22, 23, 24] 
## 2. Move Agent Streams Out of React State
If you are updating your React state on every single token string or agent ping, your app will choke.

* Use useRef to accumulate incoming WebSocket/SSE data.
* Batch your state updates (e.g., update the UI only every 100–200ms using a throttle function), or use a state manager built for high-frequency updates like Zustand (transient updates) instead of native React Context. [25, 26, 27] 

## 3. Offload Logic to Web Workers [28] 
Agentic workflows require a lot of data parsing. Move graph traversals, heavy JSON parsing, and log filtering out of the main browser thread into a background Web Worker. This keeps your UI running at a buttery 60 FPS. [29, 30, 31, 32] 
## 4. The True "Native Desktop" Path: Tauri or Electron [33, 34] 
If you absolutely must have a desktop application wrapper:

* Tauri (Recommended): Uses a Rust backend with the system's native webview. It is incredibly lightweight, safe, and allows you to write heavy data-processing or agent coordination logic in blazing-fast Rust, while keeping your React UI.
* Electron: More resource-heavy, but provides deep native API integration. [35, 36, 37, 38, 39] 

------------------------------
To help diagnose the exact issue, could you tell me:

* What specific actions cause the lag? (e.g., LLM text streaming, node-graph dragging, rendering huge logs?)
* How is the frontend receiving data from the agents? (WebSockets, Server-Sent Events, or polling?)
* What state management library are you currently using?


[1] [https://www.conceptatech.com](https://www.conceptatech.com/blog/why-you-should-or-shouldnt-use-react-native)
[2] [https://www.thefrontendcompany.com](https://www.thefrontendcompany.com/posts/react-native-alternatives)
[3] [https://www.abbacustechnologies.com](https://www.abbacustechnologies.com/react-native-for-mobile-app-development-pros-cons-use-cases/)
[4] [https://www.netguru.com](https://www.netguru.com/blog/react-vs-react-native)
[5] [https://cloudinary.com](https://cloudinary.com/guides/vs/react-vs-react-native)
[6] [https://www.gomage.com](https://www.gomage.com/blog/pwa-vs-react-native/)
[7] [https://reintech.io](https://reintech.io/blog/setting-up-react-native-development-environment)
[8] [https://anil-gudigar.medium.com](https://anil-gudigar.medium.com/react-native-app-performance-is-a-myth-dfe7b141b812)
[9] [https://globaldev.tech](https://globaldev.tech/blog/react-native-architecture)
[10] [https://www.simform.com](https://www.simform.com/blog/react-native-vs-swift-ios-application-development/)
[11] [https://medium.com](https://medium.com/@antoniogally/exploring-react-natives-architectures-bridge-and-beyond-76e414accf7d)
[12] [https://medium.com](https://medium.com/@aadil_sayyed/react-natives-new-architecture-the-complete-developer-guide-everything-you-need-to-know-780a4e27b170)
[13] [https://medium.com](https://medium.com/@anisurrahmanbup/react-native-v0-74-stable-is-out-8943ea367217)
[14] [https://medium.com](https://medium.com/front-end-weekly/how-does-react-native-work-understanding-the-architecture-d9d714e402e0)
[15] [https://www.contentful.com](https://www.contentful.com/blog/react-vs-react-native/)
[16] [https://charleswan111.medium.com](https://charleswan111.medium.com/comparing-react-native-pyqt-and-qt-choosing-the-right-framework-for-cross-platform-development-cf8dfb43748a)
[17] [https://medium.com](https://medium.com/@anilchitte/supercharging-your-react-app-practical-strategies-for-peak-performance-408193cdbf20)
[18] [https://nicolasgallagher.com](https://nicolasgallagher.com/one-react-for-web-and-native/)
[19] [https://thoughtbot.com](https://thoughtbot.com/blog/the-problem-of-state)
[20] [https://pratha001.medium.com](https://pratha001.medium.com/exploring-the-power-of-material-ui-mui-for-react-applications-c4a233c490b6)
[21] [https://mashuktamim.medium.com](https://mashuktamim.medium.com/react-virtualization-showdown-tanstack-virtualizer-vs-react-window-for-sticky-table-grids-69b738b36a83)
[22] [https://www.youtube.com](https://www.youtube.com/watch?v=dViKLPWZrSY)
[23] [https://www.zigpoll.com](https://www.zigpoll.com/content/how-can-i-optimize-data-rendering-performance-in-react-when-dealing-with-large-datasets-to-ensure-smooth-user-interactions)
[24] [https://altersquare.io](https://altersquare.io/blog/common-frontend-performance-mistakes-data-heavy-web-apps)
[25] [https://www.zigpoll.com](https://www.zigpoll.com/content/how-can-i-optimize-the-performance-of-my-react-app-when-rendering-large-lists-of-dynamic-data)
[26] [https://medium.com](https://medium.com/@noroavetisyan/state-management-architectures-in-modern-react-an-exhaustive-comparative-analysis-of-zustand-095823853adb)
[27] [https://medium.com](https://medium.com/@arjunyadav.hash/the-evolution-of-state-management-in-react-from-usestate-to-redux-toolkit-5e1b57b04ffe)
[28] [https://fullstacktechies.com](https://fullstacktechies.com/how-to-scale-react-js-applications-enterprise/)
[29] [https://medium.com](https://medium.com/@huanzidage/javascript-advanced-series-part-7-performance-hacks-dbe47721372c)
[30] [https://sandeshrathnayake.medium.com](https://sandeshrathnayake.medium.com/how-to-render-100-000-items-in-react-without-freezing-the-browser-93b24d41318e)
[31] [https://web.dev](https://web.dev/articles/client-side-ai-performance)
[32] [https://www.boldare.com](https://www.boldare.com/blog/xamarin-vs-react-native-pros-and-cons/)
[33] [https://www.reddit.com](https://www.reddit.com/r/angular/comments/jtzal8/can_you_really_use_the_same_code_base_for_mobile/)
[34] [https://www.reddit.com](https://www.reddit.com/r/rust/comments/j6vm3q/how_to_turn_any_react_web_app_into_a_native/)
[35] [https://levelup.gitconnected.com](https://levelup.gitconnected.com/tauri-the-future-of-cross-platform-app-development-in-2025-77451d11f685)
[36] [https://raftlabs.medium.com](https://raftlabs.medium.com/tauri-vs-electron-a-practical-guide-to-picking-the-right-framework-5df80e360f26)
[37] [https://www.infoworld.com](https://www.infoworld.com/article/4137964/first-look-electrobun-for-typescript-powered-desktop-apps.html)
[38] [https://medium.com](https://medium.com/@yalovoy/i-built-the-same-app-with-five-gui-frameworks-tauri-slint-egui-dioxus-and-flutter-for-linux-31bd6f59ff6a)
[39] [https://www.xmethod.de](https://www.xmethod.de/en/blog/best-app-development-frameworks)

---

GPT-5.6 Terra Report:
I’ll compare the feedback against the actual data-flow paths in the client and backend, focusing on high-frequency streams, log rendering, and work currently performed on the browser’s main thread.

Read memory [](file:///c%3A/Users/28523971/AppData/Roaming/Code/User/workspaceStorage/81d812587e498e41a89cf59454097c1d/GitHub.copilot-chat/memory-tool/memories/repo/client_notes.md)

Search complete: Audit stream performance

Searching codebase for "streaming SSE WebSocket fetch reader performance audit"

Searching codebase for "high frequency React state updates chat log agent trace renderers"

Searched codebase for "large lists JSON formatting logging performance", 26 results

Searched for files matching `**/*stream*.{js,ts,jsx,tsx}`, 10 matches

Searched for files matching `**/*chat*.{js,ts,jsx,tsx}`, 11 matches

Searched for files matching `**/*log*.{js,ts,jsx,tsx}`, 11 matches

Searched for files matching `**/*trace*.{js,ts,jsx,tsx}`, 1 match

Searched for regex `SSE|WebSocket|fetch\s*\(.*stream|asyncIterator|ReadableStream`, 934 results

Searched for regex `state.*update|setState.*freq|useEffect.*stream|useCallback.*stream`, 99 results

Searched for regex `virtualize|@devsnek|@tanstack|useVirtualizer|lazy.*load|infinite.*scroll`, 57 results

Searched for files matching `**/tui/**`, 72 matches

Searched for files matching `**/coding-agent/**`, 200 matches

Searched for files matching `**/agent/**`, 98 matches

Searched for files matching `**/chat/**`, 17 matches

Searched for files matching `**/WebSocket*.{js,ts,jsx,tsx}`, 1 match

Searched for files matching `**/SSE*.{js,ts,jsx,tsx}`, no matches

Searched for files matching `**/*stream*.{js,ts,jsx,tsx}`, 10 matches

Searched for files matching `**/*agent-session*.{js,ts}`, 21 matches

Searched for files matching `**/*tui-renderer*.{ts,tsx}`, no matches

Searched for files matching `**/*thinking*.{ts,tsx}`, 15 matches

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/coding-agent/src/modes/rpc/jsonl.ts)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/ai/src/utils/event-stream.ts)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/ai/src/api/bedrock-converse-stream.ts#1-1), lines 1 to 260

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/ai/src/api/bedrock-converse-stream.lazy.ts)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/coding-agent/test/streaming-render-debug.ts)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/coding-agent/test/sdk-stream-options.test.ts)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/coding-agent/examples/extensions/input-transform-streaming.ts)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/agent/test/harness/agent-harness-stream.test.ts)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/agent/src/harness/agent-harness.ts#1-1), lines 1 to 260

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/cli/packages/agent/src/agent-loop.ts#1-1), lines 1 to 260

The initial scan confirms one concrete client risk: `ThinkingTrace` renders every thought entry and its details on each parent update, so a long live trace makes render work grow with the session. I’m now tracing the client’s actual stream hooks and the backend WebSocket emit/logging path to separate confirmed bottlenecks from general advice.

Created 4 todos

Ran terminal command:  rg -n -i "websocket|EventSource|ReadableStream|getReader|thoughtLog|ThinkingTrace|setThought|streaming|onmessage|useLiteRtChat" client/src backend --glob '!**/node_modules/**'
Completed with input:  rg -n -i "websocket|EventSource|ReadableStream|getReader|thoughtLog|ThinkingTrace|setThought|streaming|onmessage|useLiteRtChat" client/src backend --glob '!**/node_modules/**'

Ran terminal command:  rg -n -i "logger\.|logging\.|log_performance|print\(|open\(|write\(|json\.dumps|WebSocket|websocket|send_json|send_text" backend --glob '!**/__pycache__/**'
Completed with input:  rg -n -i "logger\.|logging\.|log_performance|print\(|open\(|write\(|json\.dumps|WebSocket|websocket|send_json|send_text" backend --glob '!**/__pycache__/**'

Ran terminal command:  cd client && npm ls @tanstack/react-virtual react-window zustand --depth=0 && type package.json
Completed with input:  cd client && npm ls @tanstack/react-virtual react-window zustand --depth=0 && type package.json

`rg` is not installed in this shell, and the client currently has neither a virtualization library nor Zustand installed. I’ll use the repository’s tracked-file search next, then inspect only the components and handlers that own the live update loop.

Ran terminal command:  git grep -n -i -E "websocket|EventSource|getReader|thoughtLog|ThinkingTrace|setThought|streaming|onmessage|useLiteRtChat" -- client/src backend
Completed with input:  git grep -n -i -E "websocket|EventSource|getReader|thoughtLog|ThinkingTrace|setThought|streaming|onmessage|useLiteRtChat" -- client/src backend

Ran terminal command:  git grep -n -i -E "logger\.|logging\.|log_performance|print\(|open\(|write\(|json\.dumps|WebSocket|websocket|send_json|send_text" -- backend
Completed with input:  git grep -n -i -E "logger\.|logging\.|log_performance|print\(|open\(|write\(|json\.dumps|WebSocket|websocket|send_json|send_text" -- backend

Ran terminal command:  cd client && type package.json
Completed with input:  cd client && type package.json

Ran terminal command:  pwd && ls

The terminal is scoped to the client directory, which explains the empty repository searches. The client is a Vite React app with dependencies already installed; I’m narrowing the search from that correct root and will inspect the event reducer plus its corresponding backend emitter.

Ran terminal command:  grep -RInE "websocket|EventSource|getReader|thoughtLog|ThinkingTrace|setThought|streaming|onmessage|useLiteRtChat" src ../backend --exclude-dir=node_modules --exclude-dir=__pycache__

Ran terminal command:  grep -RInE "logger\.|logging\.|log_performance|print\(|open\(|write\(|json\.dumps|WebSocket|websocket|send_json|send_text" ../backend --exclude-dir=__pycache__

Ran terminal command:  type package.json
Completed with input:  type package.json

Ran terminal command:  cat package.json

Read [](file:///c%3A/Users/28523971/AppData/Roaming/Code/User/workspaceStorage/81d812587e498e41a89cf59454097c1d/GitHub.copilot-chat/chat-session-resources/22c90c80-30df-4a94-adef-4280b10f1082/call_qADvWXwvWru0wvDYTlYRpqbj__vscode-1785959262476/content.txt)

Read [](file:///c%3A/Users/28523971/AppData/Roaming/Code/User/workspaceStorage/81d812587e498e41a89cf59454097c1d/GitHub.copilot-chat/chat-session-resources/22c90c80-30df-4a94-adef-4280b10f1082/call_C0MNCQLSuBHe8nXWxOiK1n3h__vscode-1785959262475/content.txt)

The broad search included vendored model-server code and Python environments, so it isn’t useful evidence for this review. The relevant client has no existing virtualizer, and the next pass is limited to src plus api and agent, where the application’s WebSocket route and event handlers live.

Ran terminal command:  grep -RInE "thoughtLog|ThinkingTrace|setThought|onmessage|WebSocket|EventSource|getReader|streaming|useLiteRtChat" src --include='*.ts' --include='*.tsx'

Ran terminal command:  find ../backend/api ../backend/agent -type f -name '*.py' -print0 | xargs -0 grep -nIE "WebSocket|websocket|send_json|send_text|receive_json|logger\.|log_performance|json\.dumps|open\("

Ran terminal command:  find src -type f \( -name '*.ts' -o -name '*.tsx' \) | sort

The live path is now concrete: `Workspace` accepts each WebSocket event and repeatedly appends or rewrites `thoughtLog`, which flows through `MessageList` into unvirtualized trace renderers. I’m reading those narrow sections with the backend route files next, then I’ll rank fixes by measured impact and implementation risk.

Ran terminal command:  find ../backend/api ../backend/agent -type f -name '*.py' -print0 | xargs -0 grep -lIE "WebSocket|websocket|send_json|send_text|receive_json|log_performance" | sort

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Workspace.tsx#190-190), lines 190 to 490

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MessageList.tsx)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py#1-1), lines 1 to 460

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#1-1), lines 1 to 820

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MessageItem.tsx#230-230), lines 230 to 590

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/GemmaSandboxHarness.tsx#1-1), lines 1 to 190

Ran terminal command:  grep -RInE "log_performance\(" ../backend/agent --include='*.py'; grep -RInE "send_json\(" ../backend/api/chat.py

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/chat.py#450-450), lines 450 to 850

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/chat/MessageItem.tsx#590-590), lines 590 to 927

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Workspace.tsx#1-1), lines 1 to 180

Two high-impact issues are confirmed. The backend sends the entire accumulated response on every token, and the client reparses the growing Markdown document on every one of those messages; that is quadratic in both bytes serialized and repeated parsing work. I’m checking the LiteRT path and the existing telemetry/log implementation so the recommendations cover client-side inference and observability as well as the WebSocket stream.

Starting: *Trace backend event logging* (2/4)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Workspace.tsx#300-300), lines 300 to 450

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#800-800), lines 800 to 845

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/hooks/useLiteRtChat.ts#1-1), lines 1 to 460

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/utils/logger.py)

Searched for regex `liteRtService.generate|setMessages\(|setTps\(|onToken|generate\(` (`**/client/src/hooks/useLiteRtChat.ts`), 13 results

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/hooks/useLiteRtChat.ts#470-470), lines 470 to 730

Searched for regex `generateLocalResponse|onToken|callback` (`**/client/src/services/liteRtService.ts`), 1 result

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/agent/nodes.py#1100-1100), lines 1100 to 1150

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/backend/api/metrics.py)

Read [](file:///c%3A/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/services/liteRtService.ts)

The LiteRT local-inference adapter currently throws before any generation, so it is not a present UI-thread workload. The active risks are therefore the workspace stream, live trace renderers, and synchronous console/file logging in agent execution; I’m doing one final pass on the telemetry handlers and history-loading behavior to avoid overstating anything.

Ran terminal command:  grep -RInE "console\.(log|debug|info)|logger\.debug\(token\)|print\(content" src ../backend/api/chat.py ../backend/agent/nodes.py --include='*.ts' --include='*.tsx' --include='*.py'

Ran terminal command:  git status --short

Searched for regex `context_telemetry|scratchpad_update|routing|telemetry` (`**/client/src/pages/Workspace.tsx`), 21 results

Searched for regex `get\("messages"\)|messages\]|messages` (`**/backend/api/chat.py`), 31 results

The final check confirms no client handler currently consumes the backend’s `context_telemetry` or routing updates, yet the backend computes and emits context metrics at every graph-node completion. There are also uncommitted user changes in route_map.json, vscode-extension, and the attached research note; this review made no edits.

Completed: *Trace backend event logging* (2/4)

**Review Result**

Gemini’s core conclusion is right: React Native would not solve the current bottleneck profile. Its “bridge” explanation is dated under React Native’s newer architecture, but the decisive issue remains high-frequency state/render work. Tauri/Electron would also preserve this React workload.

Confirmed highest-impact issues:

1. The backend sends the entire accumulated response for every streamed token in chat.py, chat.py, and chat.py. This creates $O(n^2)$ serialized bytes per response. Send deltas instead, with a sequence number, and coalesce sends to roughly every 50–100 ms or one animation frame.

2. The client updates React state per token in Workspace.tsx, then reparses the entire growing Markdown response through `ReactMarkdown` in MessageItem.tsx. Buffer token deltas in a ref and publish display state at a capped cadence. Render plain text while streaming; perform Markdown/math parsing once on completion, or at a much lower cadence.

3. The thought trace is also updated per token and fully mapped each time in Workspace.tsx and ThinkingTrace.tsx. Cap retained entries/details, batch trace updates, and virtualize historical traces. The client has no installed virtualization library.

4. The local streaming path logs every token to the terminal in chat.py and nodes.py. Remove token-level logs in production, or sample/aggregate them behind a debug flag.

5. `log_performance()` synchronously opens and writes a file from async agent code in nodes.py. It is currently per LLM/tool invocation, not per token, so it is secondary. Replace it with structured logging using a queue-based handler or an async telemetry sink; include request ID, node, duration, provider/model, token counts, and payload sizes.

6. The backend calculates and emits context telemetry after every graph-node completion in chat.py, but `Workspace` does not consume that event. Remove it, or emit it only at completion/debug sampling.

**Recommended Order**

1. Change the WebSocket contract to token deltas plus throttled flushes.
2. Batch client updates and avoid streaming Markdown parsing.
3. Bound and virtualize trace/log UI; memoize stable historical messages.
4. Replace per-token prints/debug logs with sampled structured events.
5. Add per-request metrics: inbound/outbound event count, streamed bytes, render flush count, long-task duration, and time-to-first-token.
6. Only introduce a Web Worker after profiling proves JSON/artifact parsing or filtering is expensive. LiteRT local generation is currently disabled in liteRtService.ts, so it is not an active UI-thread workload today.

No files were changed. The focused client build/test command is `npm run build` from client once implementation begins.

---