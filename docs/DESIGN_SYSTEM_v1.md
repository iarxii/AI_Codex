# AICodex Design System: Cyber-Glass

The AICodex UI is built on a "Cyber-Glass" aesthetic—a fusion of futuristic glassmorphism, high-contrast accents, and system-level data visualization.

## 1. Color Palette

| Usage | Color | Hex | Tailwind |
| :--- | :--- | :--- | :--- |
| **Primary Accent** | Cyber Orange | `#FF3B30` | `orange-600` |
| **Secondary Accent** | Neon Indigo | `#6366F1` | `indigo-500` |
| **Background (Deep)** | Void Slate | `#0F172A` | `slate-950` |
| **Surface (Glass)** | Frosted Silver | `rgba(255,255,255,0.05)` | `white/5` |
| **Borders** | Silicon Wire | `rgba(255,255,255,0.1)` | `white/10` |

## 2. Typography

- **Interface**: [Outfit](https://fonts.google.com/specimen/Outfit) (Geometric, Modern)
- **System Logs**: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (Clear, Architectural)

## 3. Visual Language

### A. The "Silicon" Background
- Use subtle SVG patterns of circuitry or terminal logs (`core.log[system.init]`) at 5% opacity.
- Multi-layered radial gradients to create depth.

### B. Glass Panels (Nexus Panels)
- `backdrop-blur-xl` for all surface containers.
- Thin `1px` borders with a subtle gradient (`indigo-500/20` to `transparent`).
- Hover states should trigger a "glow" effect in the corners.

### C. Interactions
- **Micro-animations**: Use subtle scales (`0.98`) on clicks and gentle bounces for agent status indicators.
- **Transitions**: 300ms cubic-bezier for panel expansion/collapse.

## 4. Layout Architecture (3-Pane Workspace)

1.  **Sidebar (The Shelf)**: Fixed left, glass-frosted, minimal icons.
2.  **Main (The Reasoning Core)**: Center, clean typography, fluid scrolling.
3.  **Inspector (The Grounding Panel)**: Right, monospace logs, RAG metadata, collapsible.
