# CSS Encapsulation & Scoping

## 1. Encapsulation Paradigms in JARVIS
JARVIS supports three distinct CSS encapsulation strategies:
1. **Global Framework Styling**: Provided by @jarvis/styles, defining shared tokens, resets, component classes, and utility classes.
2. **Component-Scoped Styling**: Declared via styleUrl or styles in the @Component decorator.
3. **Shadow DOM (Future Web Components)**: Optional native browser encapsulation.

## 2. Scoped Styling via styleUrl
When a component declares an external stylesheet via styleUrl or styleUrls, the JARVIS compiler runtime loads the stylesheet and injects a dedicated style element with id jarvis-style-[selector] into the document head upon instantiation.
