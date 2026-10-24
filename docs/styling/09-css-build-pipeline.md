# CSS Build Pipeline & Packaging

## 1. Package Structure
The styling system is distributed as @jarvis/styles:
packages/styles/
├── package.json
├── src/
│   ├── foundation/reset.css
│   ├── tokens/variables.css
│   ├── themes/themes.css
│   ├── components/components.css
│   ├── utilities/utilities.css
│   ├── index.css
│   └── index.ts
└── tests/
    └── styles.test.ts

## 2. Build & Consumption Modes
1. Single Entry Point: Import @jarvis/styles/css into the application entry point.
2. Modular Imports: Import individual files (@jarvis/styles/tokens, @jarvis/styles/theme) for minimal bundle sizes.
3. TypeScript API: Import provideTheme and JARVIS_TOKENS directly into application controllers and services.
