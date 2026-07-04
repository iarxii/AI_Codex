# VS Code Agentic Tool-Calling Architecture

This document describes how the VS Code Extension API supports **native tool calling** to empower Large Language Models (LLMs) and custom chat extensions with agentic workflows.

---

## 1. Core Architecture

VS Code separates the model execution from tool implementation. This separation allows LLMs hosted centrally (e.g., via GitHub Copilot or custom space tunnels) to act as the "brain," while local extensions register specific capabilities as the "hands."

```mermaid
sequenceDiagram
    participant User as User (Chat Input)
    participant Participant as Chat Participant (Extension Host)
    participant LM as Language Model (vscode.lm)
    participant Tool as Registered Tool (e.g., File Search)

    User->>Participant: Send Prompt "Find matches for 'Logger' in src"
    Participant->>LM: Request completion with available Tools
    LM-->>Participant: Returns Tool Call request (e.g., call "search_code" with query="Logger")
    Participant->>Tool: Execute search_code(query="Logger")
    Tool-->>Participant: Return LanguageModelToolResult (Content Parts)
    Participant->>LM: Send tool result context back to LM
    LM-->>Participant: Generates final response (Text)
    Participant->>User: Display Answer
```

---

## 2. Implementation Steps for Extensions

To expose tools to LLMs in VS Code, an extension follows a two-part declaration and registration process.

### Part A: Declaring Tools statically (`package.json`)
Every tool must be registered in the extension's manifest (`package.json`) under `contributes.languageModelTools` so that VS Code can discover and present them to the LLM agent.

```json
"contributes": {
    "languageModelTools": [
        {
            "name": "spirit_bird_search_files",
            "displayName": "Search Files",
            "description": "Searches for file paths matching a glob pattern within the workspace.",
            "modelDescription": "Use this tool to find the locations of files in the workspace. Returns a list of absolute paths.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "The glob pattern to search for (e.g., '**/src/**/*.ts')"
                    }
                },
                "required": ["pattern"]
            }
        }
    ]
}
```

### Part B: Registering the Tool Implementation (`TypeScript`)
During the extension's activation phase, the tool implementation is bound to the declared tool name using `vscode.lm.registerTool`.

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const searchFilesTool = vscode.lm.registerTool('spirit_bird_search_files', {
        invoke: async (options: vscode.LanguageModelToolInvocationOptions<any>, token: vscode.CancellationToken) => {
            const pattern = options.input.pattern;
            
            // Execute tool logic using VS Code workspace APIs
            const files = await vscode.workspace.findFiles(pattern, undefined, 10, token);
            const paths = files.map(file => file.fsPath).join('\n');
            
            // Return output wrapped in LanguageModelToolResult
            return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart(paths || "No matching files found.")
            ]);
        }
    });

    context.subscriptions.push(searchFilesTool);
}
```

---

## 3. Requesting Completions with Tools

To let the model choose from registered tools, provide them in the options when calling `vscode.lm.sendChatRequest`:

```typescript
const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
if (models.length > 0) {
    const [model] = models;
    const messages = [
        vscode.LanguageModelChatMessage.User("Search for package.json in the workspace")
    ];

    // Find and pass registered tools
    const availableTools = vscode.lm.tools; 
    const response = await model.sendChatRequest(messages, {
        tools: availableTools
    }, token);

    // Read stream response or tool invocation results
    for await (const chunk of response.stream) {
        if (chunk instanceof vscode.LanguageModelTextPart) {
            console.log(chunk.value);
        }
    }
}
```

---

## 4. Reverse Bridge & Custom Backend Integration (CodexSpaces)

In the current **AI Codex** architecture, the backend reverse-bridge uses WebSockets (`bridge.py`) to connect a local Google Colab notebook session with the Cloudrun central router:

1. **Local reverse WebSocket bridge (`bridge.websocket_tunnel`)**: 
   A persistent WebSocket connection is maintained between the notebook and `codex_spaces/backend/api/bridge.py` via `/ws/{token}`.
2. **RPC Messages**:
   When the extension hits `/spaces/{space_slug}/codegen`, the FastAPI route forwards the prompt as an RPC message through the WebSocket (`bridge_manager.send_rpc`).
3. **Local Tool Execution**:
   To execute agentic commands locally from the extension host instead of the notebook, the extension's `chatView.html` webview can issue message-passing requests (e.g. `vscode.postMessage({ type: 'runTool', ... })`) back to the `ChatViewProvider.ts` extension host, execute them, and return the result to the chat view.
