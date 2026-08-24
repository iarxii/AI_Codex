## Implementation Plan: VSCode Extension Context Window + Integrations UI

### **Phase 1: Context Window — 3-Tab Bar with Brand Logos**  *(1.5 weeks)*

#### **1.1 Modify `ContextWindowPanelProvider.ts`**
| Change | Implementation |
|--------|----------------|
| **Tab Bar** | After header, before cards: `SKILLS` \| `MCP TOOLS` \| `CONNEX` |
| **Active Tab State** | `activeTab` in JS, persisted via `vscode.setState({ activeTab })` |
| **Conditional Rendering** | Each tab has its own `<section id="tab-skills">` etc., hidden via `display: none` |
| **Tab Click Handler** | Updates `activeTab`, calls `vscode.setState()`, re-renders visible section |

#### **1.2 Brand Icons — Local SVGs (Colored/Filled Variants)**
| Provider | Source | Target Path |
|----------|--------|-------------|
| Google | lobehub.com/icons → `google` (colored) | `client/public/media/brand-icons/integrations/google.svg` |
| GitHub | lobehub.com/icons → `github` (colored) | `client/public/media/brand-icons/integrations/github.svg` |
| Slack | lobehub.com/icons → `slack` (colored) | `client/public/media/brand-icons/integrations/slack.svg` |
| Notion | lobehub.com/icons → `notion` (colored) | `client/public/media/brand-icons/integrations/notion.svg` |
| MCP (generic) | Custom — MCP spec logo (filled purple) | `client/public/media/brand-icons/integrations/mcp.svg` |
| Skills (generic) | lobehub.com/icons → `sparkles` or `cpu` (filled orange) | `client/public/media/brand-icons/integrations/skills.svg` |

> **Download**: Use `lobehub.com/icons` search → export SVG → save to `client/public/media/brand-icons/integrations/`
> **Vite**: Served at `/media/brand-icons/integrations/{name}.svg` (from `public/`)
> **Extension**: Copy to `vscode-extension/media/brand-icons/integrations/` for webview access via `vscode.Uri.joinPath(extensionUri, 'media', 'brand-icons', 'integrations', ...)`

#### **1.3 Tab Content & Data Fetching**
| Tab | Backend Endpoint | Display |
|-----|------------------|---------|
| **SKILLS** | `GET /api/skills` | List with toggle, parameter schema (JSON), "Send in prompt" button |
| **MCP TOOLS** | `GET /api/integrations/mcp/tools` | List tools from connected MCP servers, "Send in prompt" |
| **CONNEX** | `GET /api/integrations/providers` + `GET /api/integrations/my-connections` | Provider cards with OAuth "Connect", status badges, workspace enable toggle |

**Auth**: Use `vscode.workspace.getConfiguration('spiritBirdAiCodex').get('apiKey')` → `Authorization: Bearer <token>`

#### **1.4 "Send in Prompt" Button (Skills & MCP Tools Tabs)**
```javascript
// In tab JS
function sendToChat(slashCommand) {
  vscode.postMessage({ 
    type: 'sendToChat', 
    slashCommand,  // e.g., "/workspace-write filename='test.ts' content='...'"
    params: { /* current form values */ }
  });
}
// Extension side (extension.ts or panel provider):
// Receives message → focuses chat view → inserts slashCommand into input
```

---

### **Phase 2: Settings Modal — Integrations Tab**  *(1 week)*

#### **2.1 Client `SettingsModal.tsx`**
- Add **Integrations** tab alongside **Providers** tab
- Reuse `Integrations.tsx` logic (OAuth popup, connection list, workspace enable)
- Add **MCP Servers** sub-tab: register/connect/disconnect MCP servers (sync with `/mcp/servers`)

#### **2.2 OAuth Flow — External Browser (Decision #2)**
```typescript
// SettingsModal.tsx
async function initiateOAuth(providerSlug: string) {
  const redirectUri = `${window.location.origin}/integrations/callback`;
  const res = await apiFetch(`/integrations/connect/${providerSlug}`, {
    method: 'POST',
    body: JSON.stringify({ redirect_uri: redirectUri })
  });
  const { authorization_url, state } = await res.json();
  
  // Open in external browser
  window.open(authorization_url, '_blank', 'width=600,height=700');
  
  // Poll for completion (same as Integrations.tsx)
  pollForCompletion(state, providerSlug);
}
```
> **Why external browser**: Simpler than VSCode URI handler (`vscode://...`), works reliably across platforms, no `package.json` URI handler registration needed.

---

### **Phase 3: VSCode Extension — MCP Manager Unification**  *(1.5 weeks)*

#### **3.1 Unified MCP Server Config (Decision #3)**
```typescript
// vscode-extension/src/config/mcpConfig.ts (NEW)
export type MCPTransport = 'stdio' | 'http' | 'sse';

export interface MCPServerConfig {
  name: string;
  transport: MCPTransport;
  // stdio
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // http/sse
  url?: string;
  headers?: Record<string, string>;
  // common
  enabled: boolean;
}
```

#### **3.2 Update `McpManager.ts`**
```typescript
// ADD to McpManager class
async syncWithBackend(): Promise<void> {
  const token = await this.getAuthToken();
  const res = await fetch(`${API_BASE}/api/integrations/mcp/servers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const servers = await res.json();
  
  // Reconcile: start missing, stop extra, update changed
  for (const server of servers) {
    if (server.enabled && !this.servers.has(server.name)) {
      await this.startServer(server);  // handles stdio/http/sse
    } else if (!server.enabled && this.servers.has(server.name)) {
      this.stopServer(server.name);
    }
  }
}

async registerServer(config: MCPServerConfig): Promise<void> {
  const token = await this.getAuthToken();
  await fetch(`${API_BASE}/api/integrations/mcp/servers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  await this.syncWithBackend();
}

private async startServer(config: MCPServerConfig): Promise<void> {
  if (config.transport === 'stdio') {
    // existing spawn logic
  } else {
    // HTTP/SSE: create SSETransport connection
    const transport = new SSETransport(config.url, config.headers);
    await transport.connect();
    // fetch tools, store in this.servers
  }
}
```

#### **3.3 Architecture Doc Update**
- Document in `docs/ARCHITECTURE.md` → "MCP Server Unification" section
- Explain `transport` field, stdio vs HTTP/SSE capabilities, config examples

---

### **Phase 4: Backend Enhancements**  *(1 week)*

#### **4.1 New Endpoints**
| Endpoint | Purpose |
|----------|---------|
| `GET /api/integrations/mcp/tools` | Aggregate tools from all connected MCP servers (via `mcp_client.py`) |
| `GET /api/integrations/mcp/servers` | Already exists — list user's MCP server configs |
| `POST /api/integrations/mcp/servers` | Already exists — register/update server |
| `DELETE /api/integrations/mcp/servers/{name}` | Already exists |

#### **4.2 MCP Tool Aggregation** (`backend/integrations/mcp_client.py`)
```python
async def get_all_mcp_tools(user_id: int) -> List[Dict]:
    """Get tools from all user's connected MCP servers."""
    # Load UserMCPServer configs from DB
    # For each: connect via StdioTransport or SSETransport
    # Fetch tools/list, aggregate
    return tools
```

#### **4.3 OAuth Callback — External Browser Compatible**
- Current `/integrations/callback` returns JSON
- Add `redirect_uri` param for frontend success page
- Frontend opens `/integrations/callback?state=...` in popup, polls `my-connections`

---

### **Phase 5: Icon Library Setup**  *(2 days)*

| Task | Command |
|------|---------|
| Create folder | `mkdir -p client/public/media/brand-icons/integrations` |
| Download SVGs | From `lobehub.com/icons` → search each provider → export colored/filled SVG |
| Copy to extension | `cp -r client/public/media/brand-icons/integrations vscode-extension/media/brand-icons/` |
| Verify | `ls client/public/media/brand-icons/integrations/` |

---

### **Phase 6: Skills Tab — Parameter Schema + "Send in Prompt"**  *(1 week)*

#### **6.1 Skills Tab Content**
```javascript
// For each skill from GET /api/skills:
{
  name: "workspace_write",
  description: "Write file to workspace",
  parameters: { /* JSON Schema */ }
}
// Render:
- Toggle (enable/disable)
- Parameter schema (collapsible JSON viewer)
- Form inputs for each parameter (dynamic based on schema)
- "Send in Prompt" button → builds slash command
```

#### **6.2 Slash Command Builder**
```typescript
function buildSlashCommand(skillName: string, params: Record<string, any>): string {
  const parts = [skillName];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${key}='${String(value).replace(/'/g, "\\'")}'`);
    }
  }
  return '/' + parts.join(' ');
}

// "Send in Prompt" click:
vscode.postMessage({ 
  type: 'sendToChat', 
  slashCommand: buildSlashCommand('workspace_write', { filename: 'test.ts', content: 'hello' })
});
```

#### **6.3 Extension Side — Chat Input Injection**
```typescript
// In extension.ts or chat panel provider
webview.onDidReceiveMessage(msg => {
  if (msg.type === 'sendToChat') {
    // Focus chat view, insert slash command at cursor
    vscode.commands.executeCommand('workbench.action.focusPanel', 'chat');
    // Or use chat API if available
    vscode.window.activeTextEditor?.edit(edit => {
      edit.insert(vscode.window.activeTextEditor.selection.active, msg.slashCommand);
    });
  }
});
```

---

### **File Structure Summary**

```
client/
├── public/
│   └── media/brand-icons/integrations/     # NEW: Google, GitHub, Slack, Notion, MCP, Skills SVGs
├── src/
│   ├── components/
│   │   ├── SettingsModal.tsx               # ADD: Integrations tab
│   │   └── providerMeta.ts                 # ADD: integrationProviders array
│   └── pages/
│       └── Integrations.tsx                # REUSE: logic for settings tab

vscode-extension/
├── media/brand-icons/integrations/          # NEW: copied from client/public
├── src/
│   ├── config/
│   │   ├── mcpConfig.ts                    # NEW: unified MCPServerConfig
│   │   └── providerSettings.ts             # ADD: integration sync helpers
│   ├── utils/
│   │   └── McpManager.ts                   # MODIFY: syncWithBackend(), transport unification
│   └── views/
│       └── ContextWindowPanelProvider.ts   # MODIFY: 3 tabs + brand logos + sendToChat

backend/
├── integrations/
│   ├── mcp_client.py                       # ADD: get_all_mcp_tools()
│   └── mcp_transport.py                    # EXISTS: HTTP/SSE transport
├── api/
│   └── integrations.py                     # ADD: GET /mcp/tools endpoint
└── db/models.py                            # EXISTS: UserMCPServer table

docs/
└── ARCHITECTURE.md                         # ADD: MCP Server Unification section
```

---

### **Effort & Timeline**

| Phase | Effort | Key Deliverable |
|-------|--------|-----------------|
| 1. Context Window Tabs + Icons | 1.5 weeks | 3-tab Context Window with brand logos |
| 2. Settings Integrations Tab | 1 week | OAuth + MCP server management in Settings |
| 3. MCP Manager Unification | 1.5 weeks | Single config for stdio + HTTP/SSE |
| 4. Backend MCP Tools Endpoint | 1 week | `GET /api/integrations/mcp/tools` |
| 5. Icon Library | 2 days | 6 SVGs in `public/media/brand-icons/integrations/` |
| 6. Skills Tab — Schema + Send | 1 week | Dynamic forms + slash command injection |

**Total**: ~5.5 weeks

---

### **Clarifying Questions Before Implementation**

1. **Slash Command Namespace**: Should skill commands be `/skill-name` or `/skill skill-name`? (Current: `/workspace-write`, suggest `/skill workspace-write` for consistency)

2. **Chat Input Injection**: Does the chat panel use a standard `<textarea>` or a custom component? Need to know the insertion mechanism.

3. **MCP HTTP/SSE Auth**: For remote MCP servers, should the extension pass the user's JWT to the backend, or does the backend proxy the connection? (Current `SSETransport` uses `Authorization: Bearer`)

4. **Icon Naming**: Use provider slug as filename? e.g., `google.svg`, `github.svg`, `mcp.svg`, `skills.svg`

5. **OAuth Popup vs Redirect**: Current `Integrations.tsx` uses popup + polling. For VSCode webview, popup may be blocked. Should we use redirect to `/integrations/callback?success=true` that posts message to opener?

---

Ready to proceed with implementation when you approve the plan. Phase 1 (Context Window tabs + icons) is the logical starting point since it's the most visible change.