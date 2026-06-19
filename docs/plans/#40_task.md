# Tasks: Implementing Dynamic LangSmith Telemetry

- `[x]` Configure VSCode Extension Settings (`package.json`)
- `[x]` Update VSCode WebSocket Client Payload (`ChatViewProvider.ts`)
- `[x]` Build Web Client Settings UI (`SettingsModal.tsx`)
- `[x]` Add Web Client Payload Fields (`Chat.tsx`)
- `[x]` Integrate dynamic `tracing_context` in FastAPI Backend (`chat.py`)
- `[x]` Implement telemetry payload redactor/truncation (`chat.py`)
- `[x]` Perform Verification Steps
    - `[x]` Verify tracing is off by default
    - `[x]` Verify tracing triggers correctly when enabled
    - `[x]` Verify large inputs are scrubbed/truncated in LangSmith
    - `[x]` Verify concurrent requests remain isolated
