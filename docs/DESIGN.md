---
version: alpha
name: diffy
description: The visual system for diffy, a self-hosted AI pull-request reviewer. A near-black canvas (`#010102`, never pure black) with light gray text (`#f7f8f8`) and one chromatic accent, **diffy Violet** (`#8257e6`), used for the primary action, the focus ring and the brand mark. Hierarchy comes from a four-step charcoal surface ladder and 1px hairlines, not from shadows. Display type is Inter at weight 600 with negative tracking. Dense, technical and calm; the review itself is the protagonist.

colors:
  primary: "#8257e6"
  on-primary: "#ffffff"
  primary-hover: "#9d7bf0"
  primary-pressed: "#6f45d4"
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#8a8f98"
  ink-tertiary: "#62666d"
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#18191a"
  surface-4: "#191a1b"
  surface-5: "#202123"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  hairline-tertiary: "#3e3e44"
  semantic-error: "#f0587a"
  semantic-success: "#27a644"
  stage-queued: "#dfa88f"
  stage-reading: "#9fc9a2"
  stage-reviewing: "#9fbbe0"
  stage-posting: "#c0a8dd"
  stage-done: "#c08532"

typography:
  display-lg:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -1.0px
  display-md:
    fontFamily: "'Inter', sans-serif"
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.7px
  headline:
    fontFamily: "'Inter', sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.4px
  card-title:
    fontFamily: "'Inter', sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: -0.1px
  body:
    fontFamily: "'Inter', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "'Inter', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  button:
    fontFamily: "'Inter', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0
  eyebrow:
    fontFamily: "'Inter', sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.4px
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 80px

components:
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    height: 56px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-5}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  card:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 24px
  finding-card:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.card-title}"
    rounded: "{rounded.lg}"
    padding: 20px
  code-block:
    backgroundColor: "{colors.surface-4}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: 16px
  text-input:
    backgroundColor: "{colors.surface-4}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 36px
  badge:
    backgroundColor: "{colors.surface-5}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  error-box:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.semantic-error}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  table-row:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: 12px 16px
---

## Overview

diffy is a developer tool you leave open next to your pull requests, so it should recede. The canvas is **near-black** (`{colors.canvas}`, #010102, with a faint blue cast), text is light gray (`{colors.ink}`, #f7f8f8), and the single chromatic color is **diffy Violet** (`{colors.primary}`, #8257e6). Violet marks the one primary action on a page, the focus ring and the brand mark. It never fills a card, never decorates, and never sits beside a second accent.

Depth comes from a **four-step surface ladder** (`surface-1` to `surface-4`) and 1px hairlines (`{colors.hairline}`). There are no shadows and no gradients. Type is **Inter** at weight 600 for headings with negative tracking, 400 for body, and JetBrains Mono for every path, hash, snippet and fix prompt.

**Key Characteristics:**
- **Dark only.** The sidebar is `{colors.surface-1}`; the page panel next to it is one step lighter (`{colors.surface-2}`), and cards, inputs and hover states step lighter again. Lighter always means closer to the reader. `{colors.canvas}` (#010102) is the deepest color, kept for full-bleed backgrounds and not used by the app shell.
- One accent. Review status uses the stage pastels and the semantic colors; severity has its own scale (critical, high, medium, low). Severity always pairs color with a word and never uses violet, so an accent element never reads as a warning.
- 8px radius on buttons and inputs, 12px on cards, fully rounded pills.
- Anything the model wrote (summaries, titles, explanations) renders as plain text, never as HTML.

## Colors

| Role | Token | Value |
|---|---|---|
| Primary action | `primary` / `primary-hover` / `primary-pressed` | #8257e6 / #9d7bf0 / #6f45d4 |
| Sidebar | `surface-1` (the `sidebar` token) | #0f1011 |
| Page panel | `surface-2` (the `background` token) | #141516 |
| Cards | `surface-3` (`card`) | #18191a |
| Popovers, inputs, code | `surface-4` | #191a1b |
| Hover, secondary, active link | `surface-5` (`secondary`, `accent`, `sidebar-accent`) | #202123 |
| Text | `ink`, `ink-muted`, `ink-subtle` | #f7f8f8, #d0d6e0, #8a8f98 |
| Borders | `hairline`, `hairline-strong` | #23252a, #34343a |
| Semantics | `semantic-error`, `semantic-success` | #f0587a, #27a644 |

White text on `primary` is about 4.9:1.

## Status pills

Queued (peach) and Running (blue) use the stage pastels with dark text. Posted uses the success color, Failed the error color, Skipped a neutral surface. `stage-reading`, `stage-posting` and `stage-done` are defined for finer pipeline stages and no screen uses them yet.

## In the app

`apps/web/src/app/globals.css` holds these values (Inter and JetBrains Mono come from `@fontsource-variable`, so nothing is fetched from a CDN). The `<html>` element always carries the `dark` class, because shadcn's components key their dark styles off it.

## Layout

A left **sidebar** holds the wordmark, the main links with icons (Dashboard, Reviews, Repositories) and, pinned to the bottom, Settings. The sidebar sits on `surface-1` and the page is an inset panel one step lighter: a 12px-rounded surface with a hairline border and 40px padding, content left-aligned and filling the panel up to 1536px, so collapsing the sidebar gives the page the extra room. The active link is a `sidebar-accent` pill. There is a 32px gap between the wordmark and the first link.

The sidebar **collapses** from 240px to a 64px icon rail in 200ms (width only; the icons never move, the labels and wordmark slide shut and fade). The choice is saved in the browser, and `prefers-reduced-motion` turns the animation off. On a narrow screen the sidebar becomes a bar above the page.

The wordmark is "diffy" in lowercase, set in **Playwrite CZ** (`font-brand`, 30px, weight 400 with a 0.5px stroke so it reads as heavy as the logo mark, bundled through `@fontsource-variable/playwrite-cz`). It is the only place that font is used.

## Known Gaps

- Animation timings are out of scope.
- There is no light theme.
