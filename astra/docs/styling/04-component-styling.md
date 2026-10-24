# Component Styling & Design Contracts

## 1. OOAD Component Styling
Reusable components implement clear styling contracts adhering to Open-Closed and Single-Responsibility principles:
- **Base Contract**: Establishes layout, box-sizing, display properties, and font baseline.
- **Variant Modifiers**: Applies semantic color tokens and visual treatment.
- **Size Modifiers**: Controls padding, font-size, and spacing tokens uniformly.
- **State Classes**: Declares :hover, :focus-visible, :disabled, and .is-loading states with accessibility compliance.

## 2. Example: Jarvis Button Contract (.jarvis-btn)
Base class .jarvis-btn is extended by .jarvis-btn-primary, .jarvis-btn-secondary, etc.
