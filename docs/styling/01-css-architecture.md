# JARVIS CSS Architecture & Reusable Styling Specification

## 1. Overview & Vision
The JARVIS styling system represents a centralized, Object-Oriented (OOAD) and token-driven CSS architecture designed for enterprise-grade frontend applications. Rather than implementing ad-hoc styles in isolation across hundreds of components, JARVIS unifies design tokens, foundational resets, themes, UI component contracts, and utilities within @jarvis/styles.

## 2. Core Architectural Pillars
- **Object-Oriented Analysis and Design (OOAD)**: Styles follow encapsulation, abstraction, and reusability. Base classes establish shared styling contracts (e.g. .jarvis-btn), while specialized modifiers provide polymorphism (.jarvis-btn-primary, .jarvis-btn-secondary).
- **Separation of Concerns**: Structure, presentation, and tokens reside in distinct layers.
- **Design Tokens as Source of Truth**: All variables (colors, spacing, typography, radii, elevations) are declared as CSS custom properties with predictable namespacing (--jarvis-*).
- **CSS Cascade Layers Precedence**: Layer ordering prevents specificity wars between foundation, component styles, and utility engines (Tailwind CSS).
