---
name: ui-ux-fixer
description: >
  Audits, refactors, fixes, and elevates UI/UX quality across web applications, UI components, and layouts.
  Triggered by topics and commands:
  - Perbaiki UI/UX: "perbaiki ui", "perbaiki ux", "perbaiki tampilan", "improve ui", "improve ux", "polish ui", "fix ui", "fix ux".
  - Audit UI/UX: "audit ui", "audit ux", "ui ux review", "ui/ux audit", "review ui".
  - Visual & Polish: "ui redesign", "make ui premium", "modernize ui", "enhance design", "beautify page", "buat ui lebih bagus".
  - Accessibility & Responsive: "fix layout", "responsive fix", "a11y audit", "fix spacing", "fix alignment", "tampilan berantakan".
version: 1.0.0
---

# UI/UX Fixer & Enhancer Skill

A specialized skill for auditing, fixing, polishing, and elevating UI/UX in web applications and desktop components. Ensures interfaces feel modern, responsive, accessible, polished, and delight users without breaking underlying business logic.

---

## EXECUTION ROUTING

Determine the mode based on user intent:

```
if user_intent contains ["audit", "review", "cek ui", "evaluasi"]:
    EXECUTE Mode 1: Audit & Punch List
elif user_intent contains ["fix", "perbaiki", "repair", "tampilan berantakan", "alignment"]:
    EXECUTE Mode 2: Targeted UI Fix
elif user_intent contains ["polish", "redesign", "buat lebih bagus", "modernize", "beautify"]:
    EXECUTE Mode 3: Aesthetic & UX Elevation
elif user_intent contains ["responsive", "mobile", "layout", "breakpoint"]:
    EXECUTE Mode 4: Responsive & Mobile Alignment
else:
    EXECUTE Default Workflow (Audit + Fix & Polish)
```

---

## 1. THE 5 PILLARS OF UI/UX EXCELLENCE

Every UI modification made by this skill must satisfy these 5 pillars:

### Pillar 1: Visual Hierarchy & Spacing (Layout)
- **Spatial System**: Strictly use a 4px/8px incremental grid for padding and margins (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
- **Visual Weight**: Primary actions stand out immediately; secondary actions are muted; tertiary actions are ghost/text buttons.
- **Whitespace Discipline**: Avoid clutter. Group related items closely (`gap: 8px`), separate distinct sections with generous breathing room (`gap: 32px` or `48px`).
- **Scannability**: Clear heading hierarchy (`h1` -> `h2` -> `h3`). Keep line lengths optimal (45-75 characters per line for reading text).

### Pillar 2: Typography & Clarity
- **Font Stack**: Use clean, modern system font stacks or Google Fonts (e.g., `Inter`, `Roboto`, `Plus Jakarta Sans`, `Outfit`, `Geist`).
- **Line Height**: `1.2`–`1.3` for display titles; `1.5`–`1.6` for body text.
- **Headings**: Headings must always be upright (no all-italic headers). Emphasize key terms with weight (`font-weight: 600` or `700`) or theme accent colors.
- **Text Wrapping**: Set `overflow-wrap: anywhere` or `break-word` on headings and dynamic text to prevent container overflow on narrow screens.

### Pillar 3: Color, Contrast & Elevation
- **Color Harmony**: Use tokenized design tokens (e.g., `var(--color-bg)`, `var(--color-surface)`, `var(--color-accent)`). Avoid raw inline hex values when tokens exist.
- **WCAG AA Contrast**: Ensure text contrast ratio is at least **4.5:1** for normal text and **3:1** for large text/icons against their backgrounds.
- **Depth & Elevation**: Use subtle multi-layered box shadows (`box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.08)`) or modern translucent glassmorphism (`backdrop-filter: blur(12px)`) instead of harsh, heavy borders.
- **Intent Colors**: Consistent semantics for feedback: Blue/Purple (Primary/Info), Green (Success), Amber/Yellow (Warning), Red (Danger/Error).

### Pillar 4: Micro-interactions & Interactive States
- **Mandatory 8-State Support**: Every interactive element (buttons, cards, inputs) MUST support styling for:
  1. `default`: Baseline clean state.
  2. `hover`: Subtile scale (`transform: translateY(-1px)`) or background highlight.
  3. `:focus-visible`: Clear, high-contrast outline (`outline: 2px solid var(--accent-color); outline-offset: 2px`).
  4. `:active`: Click feedback (`transform: translateY(0)` or slight press down).
  5. `disabled`: Reduced opacity (`opacity: 0.5; cursor: not-allowed`).
  6. `loading`: Spinner or pulse skeleton; block double-clicks (`pointer-events: none`).
  7. `error`: Red accent border/text with error message below.
  8. `success`: Subtle green accent border/check icon.
- **Transitions**: Apply smooth, snappy transitions (`transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1)`). Never use sluggish transitions > 300ms for micro-actions.

### Pillar 5: Accessibility (a11y) & Mobile Responsiveness
- **Touch Targets**: All clickable buttons and interactive items must be at least **44x44px** on mobile.
- **ARIA & Accessibility**: Add `aria-label` to icon-only buttons. Use semantic tags (`<button>`, `<header>`, `<main>`, `<nav>`, `<aside>`, `<section>`).
- **Responsive Layout**: Verify layout renders cleanly across widths: `320px`, `375px`, `768px`, `1024px`, and `1440px`.
- **Zero Horizontal Overflow**: Apply `overflow-x: clip` or `max-width: 100%` to prevent accidental horizontal scrollbars.

---

## 2. MODES OF EXECUTION

### Mode 1: Audit (`ui-ux audit <target>`)
Inspect the target file/component, evaluate against the 5 Pillars, and output a concise report with actionable punch list items.
Format:
```markdown
## UI/UX Audit Report: [<filename>]

### 🔴 Critical Issues (UX Blockers / Accessibility)
- [ ] **L12-L15**: Icon button lacks `aria-label` or visible text.
- [ ] **L45**: Contrast ratio between `#888` text and white background is only 2.8:1 (fails WCAG AA).

### 🟡 Visual & Alignment Enhancements
- [ ] **L30**: Inconsistent padding (`padding: 7px 15px`). Standardize to 8px/16px spatial grid.
- [ ] **L60**: Missing `:focus-visible` state on custom button component.

### 🟢 Micro-interaction Opportunities
- [ ] Add smooth hover lift effect on card containers (`transition: transform 0.2s ease`).
- [ ] Add skeleton loading indicator during data fetch.
```

### Mode 2: Targeted UI Fix (`ui-ux fix <target>`)
Fix functional UI/UX bugs (alignment, overlap, broken responsive layout, contrast failures, missing state feedback).
- Preserve existing logic and component API contracts.
- Adjust CSS styles, classes, flex/grid layouts, and HTML structure safely.

### Mode 3: Aesthetic & UX Elevation (`ui-ux polish <target>`)
Elevate standard/plain UIs into modern, high-end, premium designs.
- Implement curated color tokens and dark/light mode balance.
- Add polished micro-interactions, smooth hover effects, active feedback, and refined typography.
- Refine form fields with sleek focus rings, floating labels, or subtle background fills.
- Add empty states with custom icons/illustrations when lists are empty.

### Mode 4: Responsive & Mobile Alignment (`ui-ux responsive <target>`)
Ensure seamless responsiveness on mobile and tablet devices.
- Convert multi-column desktop grids into single-column responsive stacks (`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`).
- Ensure navigation menus collapse gracefully into mobile drawers or bottom nav bars.
- Prevent text clipping and awkward word wrapping on narrow displays.

---

## 3. UI/UX ANTI-PATTERNS CHEATSHEET

| Anti-Pattern | Why It Hurts UX | Correct Approach |
| --- | --- | --- |
| **Missing Hover/Active States** | User feels UI is frozen or non-interactive | Add `:hover` background shift and `:active` scale change |
| **Harsh Pure Black Text (`#000000`)** | High visual fatigue on white screens | Use off-black (`#111827`, `#0f172a`, or OKLCH `l: 0.2`) |
| **Heavy Dark Borders Everywhere** | Creates visual noise and grid-lock feel | Use subtle borders (`rgba(0,0,0,0.06)`) or box-shadows |
| **Generic Loader / No Feedback** | User clicks repeatedly thinking it failed | Disable button + show inline spinner or skeleton UI |
| **Fixed Pixel Widths (`width: 600px`)** | Causes overflow and scrollbar breaks on mobile | Use `max-width: 600px; width: 100%` |
| **Outline None (`outline: none`)** | Breaks keyboard navigation accessibility | Use `:focus-visible { outline: 2px solid var(--accent); }` |
| **All-Caps Body Copy** | Hard to read for sustained attention | Reserve `uppercase` only for small section tags/labels |

---

## 4. PRE-EMIT QUALITY CHECKLIST

Before finalizing any UI refactoring code, run this mental check:
1. **Did I preserve all functionality & prop contracts?** (Yes)
2. **Does every interactive element have hover, focus-visible, and active feedback?** (Yes)
3. **Is the typography hierarchy clear and scannable?** (Yes)
4. **Is the layout mobile-friendly with no horizontal scrollbars?** (Yes)
5. **Is the color contrast accessible (WCAG AA compliant)?** (Yes)

---

*UI/UX Fixer Skill — Installed and Active for t-line project.*
