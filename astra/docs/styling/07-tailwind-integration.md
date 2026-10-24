# Tailwind CSS Integration & Layer Precedence

## 1. Seamless Coexistence
JARVIS is architected to seamlessly coexist with Tailwind CSS without style collisions or unexpected specificity overrides.

## 2. CSS Cascade Layer Order
The cascade layer precedence is strictly enforced:
`css
@layer theme, jarvis-base, primeng, jarvis-components, jarvis-utilities, tailwind;
`
Because tailwind is ordered after jarvis-components, developers can use Tailwind utility classes (e.g. mt-4, shadow-2xl) on top of JARVIS components cleanly.
