# AICodex Workspace Web UI — Design System

This document outlines the core Design System and aesthetic principles used across the **AICodex Workspace Web UI**. It serves as a reference for maintaining visual consistency, high-fidelity interactions, and premium glassmorphism layouts.

---

## 🎨 Color Palette & Theming

The Workspace UI relies on a sleek, professional light mode theme accented by a vibrant brand color.

### Core Variables
- **Background**: `#D8DCE4` — A cool, technical grey-blue.
- **Accent**: `#fd3b12` — Vibrant electric orange/red used for primary actions, badges, and glows.

### Typography Colors
- **Primary Text (`--text-primary`, `--text-h`)**: `#1A1D2E` — Deep slate for high-contrast headings and primary reading text.
- **Secondary Text (`--text`)**: `#4A4D5E` — Softer slate for body text and descriptions.
- **Muted Text (`--text-muted`)**: `#7A7D8E` — Subdued grey for metadata, timestamps, and secondary labels.

### Surfaces & Glassmorphism
- **Glass Background (`--glass-bg`)**: `rgba(226, 230, 236, 0.7)` — Used with `backdrop-blur-xl` to create depth.
- **Glass Border (`--glass-border`)**: `rgba(0, 0, 0, 0.08)` — Subtle borders to define floating elements.

---

## ✒️ Typography

The typographic hierarchy prioritizes readability and a modern, tech-forward feel.

- **Primary Sans-Serif (`--font-sans`)**: `Poppins`, `system-ui`, `sans-serif`
  - Used for body copy, UI controls, navigation, and chat messages.
- **Display Font (`--font-display`)**: `Senior Service`, `cursive`
  - Used for specialized branding elements and distinct headers.
- **Monospace**: `var(--font-mono)`
  - Used for code blocks, terminal outputs, and syntax highlighting.

---

## ✨ Visual Effects & Aesthetics

### Background Pattern
The global body background features a subtle technical grid overlay:
```css
background-image: 
  linear-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255, 255, 255, 0.4) 1px, transparent 1px);
background-size: 40px 40px;
```

### Chat Bubble Corner Glows
Interactive elements and chat nodes utilize CSS pseudo-elements to create directional gradient glows:
- **Bot Bubbles**: Top-left corner glows gradients (`#fd3b12` to `transparent`).
- **User Bubbles**: Top-right corner shadow glows (`rgba(0, 0, 0, 0.8)` to `transparent`).

### Custom Scrollbars
Scrollbars are minimal and un-intrusive, styled to disappear when inactive:
- **Track**: Transparent.
- **Thumb**: `rgba(0, 0, 0, 0.12)`, turning to `rgba(255, 102, 0, 0.35)` on hover.

---

## 📱 Responsive & Mobile Optimization

- **Safe Areas**: Padding utilizes `env(safe-area-inset-*)` for notched mobile devices.
- **Touch Targets**: Minimum `44x44px` enforced for interactive elements.
- **Zoom Prevention**: Input fields explicitly set to `16px` on screens `< 480px` to prevent automatic zooming on iOS.
- **Reduced Motion**: Full support for `prefers-reduced-motion: reduce` to disable animations for accessibility.

---

## 📝 Markdown & Content Rendering

The `.prose-chat` utility handles all rendered markdown from agents:
- **Base Font Size**: `13px` with `1.7` line height.
- **Inline Code**: Warm, subtle orange background (`rgba(255, 102, 0, 0.08)`) with `#E65C00` text.
- **Code Blocks (`pre`)**: Deep dark slate (`#0F172A`) for high contrast against the light UI, bordered by subtle white opacity.
- **Blockquotes**: Framed with a thick `#fd3b12` left border and an italicized grey text structure.
- **Tables**: Premium glassmorphism tables with `backdrop-filter: blur(10px)` and subtle hover states on rows.

> [!TIP]
> When building new components, always prioritize `backdrop-blur` utility classes combined with `--glass-bg` to maintain the depth and hierarchy established by the core design system.
