# PrimeNG Theme Integration & Token Harmonization

## 1. PrimeNG v20 Token Mapping
JARVIS provides native adapters for PrimeNG UI widgets (jarvis-p-button, jarvis-p-input, jarvis-p-table, etc.). To ensure visual unity, JARVIS token values map directly to PrimeNG theme custom properties.

## 2. Layer Isolation
PrimeNG styles are loaded under @layer primeng, ensuring that JARVIS component styles (@layer jarvis-components) and developer utilities (@layer tailwind) can override or complement PrimeNG styling without using !important.
