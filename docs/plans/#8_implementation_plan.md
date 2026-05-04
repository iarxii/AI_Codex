# AICodex UI — Provider Visibility & Full Design Overhaul

Surface the active AI provider throughout the Chat UI, give users a clear way to switch providers, and migrate the entire palette from indigo/dark-blue to a **gray-base + AdaptivOrange** design language with an enriched chat input bar.

---

## Decisions (from feedback)

- ✅ Provider badge click → **Opens full SettingsModal**
- ✅ Accent → **Full migration** — Gray base, Orange `#fd3b12` accent, **kill all indigo**
- ✅ Font → **Poppins** everywhere, defined in `App.css`
- ✅ Chat input → **Bigger, richer** with function buttons (Tools, Agent Mode, Attachments) + a prominent rounded send button
- ✅ Text → Dark text on light surfaces, light text on dark bg (proper contrast)
- ✅ Icons → Inline SVGs for Groq/OpenRouter, copy Ollama SVG

---

## Design System

### Color Palette — "AdaptivGray + Orange"

Inspired by the reference image: light-gray circuit-trace background with bold orange branding.

| Token                | Value                    | Usage                                                  |
| -------------------- | ------------------------ | ------------------------------------------------------ |
| `--bg-primary`       | `#1A1A2E`                | App shell background (deep dark navy-gray)             |
| `--bg-surface`       | `#2A2A3E`                | Cards, sidebar, panels (elevated dark gray)            |
| `--bg-surface-hover` | `#3A3A4E`                | Hover states on surfaces                               |
| `--bg-input`         | `#22223A`                | Input fields background                                |
| `--accent`           | `#fd3b12`                | **AdaptivOrange** — CTAs, active states, brand accents |
| `--accent-glow`      | `rgba(255,102,0,0.15)`   | Glow halos, hover highlights                           |
| `--accent-hover`     | `#E65C00`                | Orange button hover                                    |
| `--status-online`    | `#22C55E`                | Connection dot                                         |
| `--status-offline`   | `#EF4444`                | Disconnected dot                                       |
| `--text-primary`     | `#F0F0F0`                | Main text on dark backgrounds                          |
| `--text-secondary`   | `#A0A0B0`                | Descriptions, timestamps                               |
| `--text-muted`       | `#606070`                | Disabled, placeholders                                 |
| `--border`           | `rgba(255,255,255,0.08)` | Subtle borders                                         |
| `--border-accent`    | `rgba(255,102,0,0.30)`   | Orange-tinted borders for active elements              |

### Typography

- **Font Family**: `'Poppins', sans-serif` — loaded via Google Fonts CDN in `index.html`
- **Defined in**: `App.css` as the global `font-family`
- **Weights**: 400 (body), 500 (labels), 600 (headings), 700 (emphasis)

### Provider Icon Map

| Provider         | Icon                        | Badge Color      |
| ---------------- | --------------------------- | ---------------- |
| `local` (Ollama) | `ollama-color.svg` (copied) | Lime `#A3E635`   |
| `groq`           | Inline SVG lightning bolt   | Orange `#fd3b12` |
| `openrouter`     | Inline SVG globe/network    | Cyan `#06B6D4`   |
| `gemini`         | `gemini-color.svg` (exists) | Blue `#4285F4`   |

---

## Proposed Changes

### Component 1: Global Styles & Font

#### [MODIFY] [index.html](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/index.html)

- Add Google Fonts `<link>` for Poppins (weights 400, 500, 600, 700)

#### [MODIFY] [App.css](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/App.css)

- Add `:root` CSS custom properties for the full color palette
- Set `body { font-family: 'Poppins', sans-serif; }` as the global default
- Update scrollbar colors to match gray/orange scheme

#### [MODIFY] [index.css](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/index.css)

- Update `--font-sans` to `'Poppins'`
- Update body background to `--bg-primary`

---

### Component 2: Chat Header — Provider Badge

#### [MODIFY] [Chat.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/pages/Chat.tsx)

**Header changes (L215-250):**

- Replace `Live`/`Off` badge → Dynamic provider icon + label + connection dot
- Clicking the badge opens SettingsModal
- Replace all `indigo-*` classes with orange/gray equivalents
- Replace `bg-[#0F172A]` with `bg-[var(--bg-primary)]` or `bg-[#1A1A2E]`
- Add `isSettingsOpen` state + import SettingsModal

**Chat input bar (L317-358) — Full redesign:**

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────┐ ┌──────────┐ ┌──────┐                             │
│  │ 📎   │ │🛠 Tools ▼│ │🤖 AI │    Type your message...     │
│  │Attach│ │          │ │ Mode │                        ⬤ ►  │
│  └──────┘ └──────────┘ └──────┘                    [SEND]   │
│                                                              │
│  CPU: 12%  •  RAM: 45%  •  LATENCY: 120ms  •  MOD: llama3  │
└──────────────────────────────────────────────────────────────┘
```

- **Left side**: Row of compact function buttons:
  - **Attachments** (📎 icon) — placeholder `onClick` with `alert('Coming soon')`
  - **Tools** (🛠 wrench icon with ▼ chevron) — placeholder dropdown
  - **Agent Mode** (🤖 bot icon) — toggle placeholder with orange active glow
- **Center**: Larger textarea with better padding and placeholder text
- **Right side**: Prominent **round orange send button** with arrow icon
- **Bottom bar**: Metrics strip stays but styled in the new gray/orange palette

**Full color migration across Chat.tsx:**

- `bg-indigo-600` user bubbles → `bg-[#fd3b12]` orange
- `text-indigo-400/500` accents → `text-[#fd3b12]`
- `bg-indigo-500/20` highlights → `bg-[#fd3b12]/20`
- `bg-white/5` surfaces → `bg-[#2A2A3E]`
- Inspector button uses orange when active
- Thinking process dots/accents → orange

---

### Component 3: Settings Modal — Provider Switch

#### [MODIFY] [SettingsModal.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/SettingsModal.tsx)

**Add provider radio group:**

```
┌────────────────────────────────────────────┐
│ ⚙ Provider Settings                      ✕│
│                                            │
│  Default Provider                          │
│  ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐  │
│  │  🦙  │ │  ⚡  │ │    🌐    │ │  ✨  │  │
│  │Ollama│ │ Groq │ │OpenRouter│ │Gemini│  │
│  └──────┘ └──────┘ └──────────┘ └──────┘  │
│   ●active                                  │
│                                            │
│  Groq API Key                              │
│  ┌────────────────────────────────────────┐│
│  │ gsk_...                                ││
│  └────────────────────────────────────────┘│
│                                            │
│              [Cancel]  [Save Changes]      │
└────────────────────────────────────────────┘
```

- Horizontal card-style radio group with icons
- Active card: `border-[#fd3b12]`, `bg-[#fd3b12]/10`
- Only show the relevant API key input for the selected cloud provider
- Local (Ollama) shows no key input — just a "Using local GPU" note
- Save persists both `ai_provider` and API keys
- Dispatch `window.dispatchEvent(new Event('storage'))` so Chat.tsx reacts
- Migrate all `indigo-*` → orange/gray

---

### Component 4: Sidebar Color Migration

#### [MODIFY] [Sidebar.tsx](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/Sidebar.tsx)

- Active conversation: `bg-indigo-600/20 border-indigo-500/30` → `bg-[#fd3b12]/15 border-[#fd3b12]/30`
- Active dot: `bg-indigo-400` → `bg-[#fd3b12]`
- New Workspace "+" icon: `text-indigo-400` → `text-[#fd3b12]`
- User avatar ring and System.Active text stay emerald (status green is fine)

---

### Component 5: Provider Assets & Metadata

#### [NEW] Copy `ollama-color.svg` → `AI_Codex/client/src/assets/ai_online_services/`

#### [NEW] [providerMeta.ts](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/src/components/providerMeta.ts)

```typescript
export const PROVIDER_META: Record<string, { label: string; color: string }> = {
  local: { label: "Ollama", color: "#A3E635" },
  groq: { label: "Groq", color: "#fd3b12" },
  openrouter: { label: "OpenRouter", color: "#06B6D4" },
  gemini: { label: "Gemini", color: "#4285F4" },
};
```

Plus inline SVG icon components for each provider.

---

### Component 6: Design Specification

#### [NEW] [DESIGN.md](file:///c:/AppDev/My_Linkdin/projects/iarxii/AI_Codex/client/DESIGN.md)

Commits the design system above as a living reference doc in the project root.

---

## File Change Summary

| File                | Action | Scope                                                             |
| ------------------- | ------ | ----------------------------------------------------------------- |
| `index.html`        | MODIFY | Add Poppins font link                                             |
| `App.css`           | MODIFY | CSS custom properties, global font, scrollbar                     |
| `index.css`         | MODIFY | Update Tailwind font-sans, body bg                                |
| `Chat.tsx`          | MODIFY | Provider badge, input bar redesign, full color migration          |
| `SettingsModal.tsx` | MODIFY | Add provider radio group, conditional key inputs, color migration |
| `Sidebar.tsx`       | MODIFY | Accent color migration indigo → orange                            |
| `providerMeta.ts`   | NEW    | Shared provider metadata constants                                |
| `ollama-color.svg`  | COPY   | Icon asset from portfolio                                         |
| `DESIGN.md`         | NEW    | Design system specification                                       |

---

## Verification Plan

### Dev Server

- `npm run dev` — confirm zero compilation errors

### Browser Verification

1. Screenshot the Chat header showing provider badge with icon + label + dot
2. Screenshot the enriched chat input bar with function buttons
3. Open SettingsModal — verify provider radio group + conditional API key inputs
4. Switch provider → confirm Chat header badge updates live
5. Verify the full gray + orange palette — **no indigo remnants**
6. Confirm Poppins font is rendering across all text

### Manual

- Refresh page — provider selection persists from localStorage
- First-time user with no localStorage — defaults to `local` (Ollama)
