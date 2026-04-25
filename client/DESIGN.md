# AICodex — Design System v2 (Light Gray + AdaptivOrange)

> Reference: `GGI_22p0pt22p0pt22p0.png` — Silvery gray background with circuit-trace vectors and bold orange branding.

---

## Color Palette — "AdaptivGray + Orange"

### Backgrounds (Light Gray Palette)
| Token | Value | Usage |
|---|---|---|
| `--bg-primary` | `#C8CDD5` | App shell — cool silvery gray |
| `--bg-surface` | `#D8DCE4` | Sidebar, panels — elevated lighter gray |
| `--bg-surface-hover` | `#E2E6EC` | Hover states |
| `--bg-input` | `#BFC4CC` | Input fields — slightly darker/inset |
| `--bg-elevated` | `#E8ECF2` | Modals, dropdowns — lightest |
| `--bg-chat-bot` | `#E2E6EC` | Bot message bubbles |
| `--bg-chat-user` | `#FF6600` | User message bubbles |

### Accent — AdaptivOrange
| Token | Value | Usage |
|---|---|---|
| `--accent` | `#FF6600` | Primary CTAs, active states, brand |
| `--accent-hover` | `#E65C00` | Button hover |
| `--accent-glow` | `rgba(255,102,0,0.15)` | Focus rings, glow halos |
| `--accent-border` | `rgba(255,102,0,0.35)` | Active element borders |

### Text (Dark on Light)
| Token | Value | Usage |
|---|---|---|
| `--text-primary` | `#1A1D2E` | Headings, body — near-black |
| `--text-secondary` | `#4A4D5E` | Descriptions, labels |
| `--text-muted` | `#7A7D8E` | Placeholders, disabled |
| `--text-on-accent` | `#FFFFFF` | Text on orange surfaces |

### Borders
| Token | Value | Usage |
|---|---|---|
| `--border` | `rgba(0,0,0,0.08)` | Default subtle borders |
| `--border-hover` | `rgba(0,0,0,0.15)` | Hover borders |

---

## Typography
| Property | Value |
|---|---|
| Font Family (UI) | `'Poppins', sans-serif` |
| Font Family (Code) | `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` |
| Weights | 400 (body), 500 (medium), 600 (semibold), 700 (bold) |

---

## Design Inspiration

The reference image features:
- **Silvery light-gray background** — the dominant base color
- **Circuit-board trace vectors** — white lines forming a tech-grid pattern
- **Code snippets** — `{core.log[system.init]};` overlaid subtly
- **Binary streams** — `0101` patterns at low opacity
- **Wave/particle effects** — flowing mesh lines with white dots
- **AdaptivOrange logo** — bold, centered, rounded-square container
- **No dark mode** — this is a light-themed design

---

## Key Decisions

- **Light gray base** — NOT dark mode. `#C8CDD5` is the primary bg.
- **Dark text** — `#1A1D2E` for maximum readability on gray.
- **No indigo/blue** — all accent colors are AdaptivOrange `#FF6600`.
- **User chat bubbles** — solid orange bg with white text.
- **Bot chat bubbles** — light gray `#E2E6EC` with dark text.
- **Borders** — use `rgba(0,0,0,0.08)` not white-alpha (light theme).
- **Poppins** — universal font, loaded via Google Fonts.
