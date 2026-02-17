# ShadowOps UI Style Guide

This guide defines the core design tokens and UI rules used across the ShadowOps dashboard.

## Color Tokens
- --bg: #f6f7f9 (app background)
- --surface: #ffffff (card/table surface)
- --surface-2: #f3f5f8 (muted surface)
- --border: #e5e7eb (borders)
- --text: #0f172a (primary text)
- --muted: #6b7280 (secondary text)
- --brand: #1f3b7a (primary brand)
- --brand-2: #2b7f5f (accent brand)
- --danger: #dc2626 (errors/late)
- --warning: #f59e0b (warnings/at risk)
- --success: #16a34a (success/on track)
- --focus: #3b82f6 (focus ring)

## Typography
- --font-sans: System UI sans stack
- --font-mono: System monospace stack
- Page title: 26px, semibold
- Section headers: 14–16px, semibold
- Body: 13–14px, relaxed line-height (1.6)
- Table: 12–13px, numeric columns use tabular lining

## Spacing & Shape
- Radii: sm 6px, md 10px, lg 14px
- Shadows: sm 0 1px 3px, md 0 8px 24px
- Spacing (8pt grid): 4, 8, 12, 16, 24, 32

## Component Rules
- Cards: surface background, 1px border, sm shadow, md radius, consistent padding
- Buttons: primary = --brand, secondary = neutral surface with border, danger = --danger
- Inputs: 36–40px height, neutral border, focus ring = --focus
- Badges: pill shape, colors mapped to status (success/warning/danger)
- Tables: sticky header + first column, subtle zebra striping, row hover highlight; numeric columns right-aligned; dates muted
- Charts: minimal grid lines, brand for primary series, neutral for others; readable labels

## Branding
- Header includes logo (use `/public/shadowops.svg` when available; currently placeholder `/vite.svg`).
- Favicon can reuse the logo asset.
- Title and meta reflect "ShadowOps — Manufacturing Command Hub".

Implementation lives in `src/styles/theme.css` and overrides in `src/App.css`. Use CSS variables rather than hard-coded colors wherever possible.
