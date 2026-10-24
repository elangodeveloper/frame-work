# Design Token Architecture & System

## 1. Hierarchy of Tokens
JARVIS organizes tokens into a three-tier token architecture:
1. **Global (Primitive) Tokens**: Raw palette and scale definitions (e.g., --jarvis-palette-blue-500: #3b82f6).
2. **Semantic (System) Tokens**: Contextual roles mapping global values to meaning (e.g., --jarvis-color-primary: var(--jarvis-palette-blue-500)).
3. **Component Tokens**: Scoped overrides assigned specifically to component contracts (e.g., --jarvis-btn-bg: var(--jarvis-color-primary)).

## 2. Token Categories
- **Colors**: --jarvis-color-primary, --jarvis-color-secondary, --jarvis-color-surface, --jarvis-color-background, --jarvis-color-text, --jarvis-color-border.
- **Spacing Scale**: Modular 4px scale (--jarvis-space-1: 0.25rem up to --jarvis-space-16: 4rem).
- **Typography**: Responsive font families, weights, letter-spacing, and line-heights.
- **Radii**: --jarvis-radius-sm, --jarvis-radius-md, --jarvis-radius-lg, --jarvis-radius-full.
- **Elevations (Shadows)**: --jarvis-shadow-sm, --jarvis-shadow-md, --jarvis-shadow-lg.

## 3. TypeScript Integration
Tokens are exposed statically via JARVIS_TOKENS in @jarvis/styles.
