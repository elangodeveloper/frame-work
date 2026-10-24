# Jarvis Syntax Design & Analysis

## 1. Current Template Syntax
* **Static Attributes**: `<button class="p-button">`
* **Property Bindings**: `<button [disabled]="isLoading">`
* **Event Bindings**: `<button (click)="handleClick">`
* **Two-Way Bindings**: `<input [(value)]="query">`
* **Interpolations**: `<span>{{ title }}</span>`<button>

## 2. Evaluation Against Modern Frameworks
* **Angular**: JARVIS shares familiar bracket syntax, reducing developer cognitive load.
* **Vue / Svelte**: Vue uses `:prop` / `@event`, Svelte uses `(prop)` / `on:event`. JARVIS bracket syntax makes unidirectional vs bidirectional bindings explicit.
* **Syntax Ambiguities & Edge Cases**:
  - Embedded quotes inside property expressions require robust quote-handling.
  - Event payload conventions: JARVIS supports `<dollar>event` injection.
